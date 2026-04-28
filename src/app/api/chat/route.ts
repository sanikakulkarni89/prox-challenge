import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/knowledge";
import { TOOLS } from "@/lib/tools";
import { saveDiagnosis, saveSession } from "@/lib/weldMemory";

export const runtime = "nodejs";
export const maxDuration = 120;

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

type SSEEvent =
  | { type: "text"; text: string }
  | { type: "artifact"; title: string; artifact_type: string; html: string }
  | { type: "done" }
  | { type: "error"; message: string };

const DEFECT_KEYWORDS = [
  "porosity",
  "undercut",
  "cold lap",
  "spatter",
  "burn through",
  "incomplete fusion",
] as const;

type DefectKeyword = (typeof DEFECT_KEYWORDS)[number];

function detectDefect(text: string): DefectKeyword | null {
  const lower = text.toLowerCase();
  for (const kw of DEFECT_KEYWORDS) {
    if (lower.includes(kw)) return kw;
  }
  return null;
}

function extractAssistantText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function findImageUrl(
  messages: Anthropic.MessageParam[]
): string | undefined {
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const blocks = Array.isArray(msg.content) ? msg.content : [];
    for (const block of blocks) {
      if (block.type === "image") {
        // Cast needed: SDK types only define base64, but runtime may carry url
        const src = block.source as { type: string; url?: string };
        if (src.type === "url" && src.url) return src.url;
      }
    }
  }
  return undefined;
}

function extractParameters(text: string): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  const voltageMatch = text.match(/\b(\d+(?:\.\d+)?)\s*V(?:olts?)?\b/i);
  if (voltageMatch) params.voltage = parseFloat(voltageMatch[1]);

  const ampsMatch = text.match(/\b(\d+(?:\.\d+)?)\s*A(?:mps?)?\b/i);
  if (ampsMatch) params.amperage = parseFloat(ampsMatch[1]);

  const wfsMatch = text.match(/\b(\d+(?:\.\d+)?)\s*IPM\b/i);
  if (wfsMatch) params.wire_speed = parseFloat(wfsMatch[1]);

  const actionSentence = text
    .split(/[.!?]+/)
    .find((s) =>
      /\b(increase|decrease|reduce|adjust|check|clean|replace|swap|verify|ensure|lower|raise)\b/i.test(
        s
      )
    );
  if (actionSentence) params.corrective_action = actionSentence.trim();

  return params;
}

async function maybeSaveDiagnosis(
  finalContent: Anthropic.ContentBlock[],
  initialMessages: Anthropic.MessageParam[],
  userId: string
): Promise<void> {
  const text = extractAssistantText(finalContent);
  const defectType = detectDefect(text);
  if (!defectType) return;

  const session = await saveSession({ userId, machineConfig: {} });
  await saveDiagnosis({
    sessionId: session.id,
    imageUrl: findImageUrl(initialMessages),
    defectType,
    parameters: extractParameters(text),
  });
}

export async function POST(req: Request) {
  try {
    const { messages, userId } = await req.json();

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: SSEEvent) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        };

        try {
          await runAgentLoop(messages, send, userId as string | undefined);
          send({ type: "done" });
        } catch (err) {
          console.error("Agent loop error:", err);
          send({
            type: "error",
            message:
              err instanceof Error
                ? err.message
                : "An unexpected error occurred.",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("Route error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

async function runAgentLoop(
  initialMessages: Anthropic.MessageParam[],
  send: (event: SSEEvent) => void,
  userId?: string
) {
  const systemBlock: Anthropic.TextBlockParam & {
    cache_control?: { type: "ephemeral" };
  } = {
    type: "text",
    text: SYSTEM_PROMPT,
    cache_control: { type: "ephemeral" },
  };

  let messages: Anthropic.MessageParam[] = [...initialMessages];
  let lastFinalContent: Anthropic.ContentBlock[] = [];

  // Max 3 iterations to prevent runaway loops
  for (let iteration = 0; iteration < 3; iteration++) {
    const artifacts: Array<{
      id: string;
      name: string;
      input: Record<string, string>;
    }> = [];
    let currentToolId = "";
    let currentToolName = "";
    let currentToolJson = "";

    const messageStream = client.messages.stream(
      {
        model: "claude-opus-4-7",
        max_tokens: 8192,
        system: [systemBlock] as Anthropic.TextBlockParam[],
        tools: TOOLS,
        messages,
      },
      {
        headers: { "anthropic-beta": "prompt-caching-2024-07-31" },
      }
    );

    for await (const chunk of messageStream) {
      switch (chunk.type) {
        case "content_block_start":
          if (chunk.content_block.type === "tool_use") {
            currentToolId = chunk.content_block.id;
            currentToolName = chunk.content_block.name;
            currentToolJson = "";
          }
          break;

        case "content_block_delta":
          if (chunk.delta.type === "text_delta") {
            send({ type: "text", text: chunk.delta.text });
          } else if (chunk.delta.type === "input_json_delta") {
            currentToolJson += chunk.delta.partial_json;
          }
          break;

        case "content_block_stop":
          if (currentToolJson && currentToolId) {
            try {
              const parsed = JSON.parse(currentToolJson) as Record<
                string,
                string
              >;
              artifacts.push({
                id: currentToolId,
                name: currentToolName,
                input: parsed,
              });
              // Stream artifact to frontend immediately
              send({
                type: "artifact",
                title: parsed.title ?? "Diagram",
                artifact_type: parsed.artifact_type ?? "how_to_guide",
                html: parsed.html ?? "",
              });
            } catch {
              // Ignore malformed tool input
            }
            currentToolId = "";
            currentToolName = "";
            currentToolJson = "";
          }
          break;
      }
    }

    const finalMessage = await messageStream.finalMessage();
    lastFinalContent = finalMessage.content;

    // If no tool calls, we're done
    if (finalMessage.stop_reason !== "tool_use" || artifacts.length === 0) {
      break;
    }

    // Provide tool results and continue
    const toolResults: Anthropic.ToolResultBlockParam[] = artifacts.map(
      (artifact) => ({
        type: "tool_result",
        tool_use_id: artifact.id,
        content:
          "Artifact rendered and displayed to user in the side panel. Continue with your explanation.",
      })
    );

    messages = [
      ...messages,
      { role: "assistant", content: finalMessage.content },
      { role: "user", content: toolResults },
    ];
  }

  // Non-blocking: persist weld diagnosis if the response contains one
  if (userId) {
    void maybeSaveDiagnosis(lastFinalContent, initialMessages, userId).catch(
      (err) => console.error("Failed to save weld diagnosis:", err)
    );
  }
}
