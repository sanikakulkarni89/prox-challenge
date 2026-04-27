"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type ChangeEvent,
} from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Artifact {
  title: string;
  artifact_type: string;
  html: string;
}

interface ImageAttachment {
  data: string; // base64, no prefix
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  preview: string; // data URL for display
}

type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
        data: string;
      };
    };

interface Message {
  role: "user" | "assistant";
  content: string | ContentBlock[];
  artifact?: Artifact;
  streaming?: boolean;
}

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS = [
  "What's the duty cycle for MIG at 200A on 240V?",
  "How do I set up TIG welding? Show me the wiring.",
  "I'm getting porosity in my flux-cored welds. Help.",
  "What settings for MIG welding 1/4\" mild steel?",
  "Wire feed motor runs but no wire comes out.",
  "MIG vs Flux-Cored — which should I use?",
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function toApiMessages(
  messages: Message[]
): Array<{ role: string; content: string | ContentBlock[] }> {
  return messages
    .filter((m) => !m.streaming)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));
}

function getMessageText(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" class="text-orange-400 underline">$1</a>')
    .replace(/\n\n+/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^(?!<[hup]|<li|<ul|<br)(.+)/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}

// ─── Voice utilities ──────────────────────────────────────────────────────────

function stripMarkdownForSpeech(text: string): string {
  return text
    .replace(/#{1,3}\s+/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\n+/g, " ")
    .trim();
}

function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(stripMarkdownForSpeech(text));
  utt.rate = 1.05;
  utt.pitch = 1;
  window.speechSynthesis.speak(utt);
}

function useVoiceInput(
  onFinal: (text: string) => void,
  onInterim: (text: string) => void
) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const start = useCallback(() => {
    const SR =
      (window as Window & { webkitSpeechRecognition?: typeof SpeechRecognition })
        .webkitSpeechRecognition ?? window.SpeechRecognition;
    if (!SR) {
      alert("Voice input requires Chrome, Edge, or Safari.");
      return;
    }
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onstart = () => setIsListening(true);
    rec.onend = () => {
      setIsListening(false);
      onInterim("");
    };
    rec.onerror = () => {
      setIsListening(false);
      onInterim("");
    };
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const result = e.results[e.results.length - 1];
      const text = result[0].transcript;
      if (result.isFinal) {
        onFinal(text.trim());
        onInterim("");
      } else {
        onInterim(text);
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [onFinal, onInterim]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  return { isListening, toggle };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function LoadingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      <div className="w-2 h-2 rounded-full bg-orange-500 dot-1" />
      <div className="w-2 h-2 rounded-full bg-orange-500 dot-2" />
      <div className="w-2 h-2 rounded-full bg-orange-500 dot-3" />
    </div>
  );
}

function ArtifactTypeIcon({ type }: { type: string }) {
  const icons: Record<string, string> = {
    wiring_diagram: "⚡",
    duty_cycle_chart: "⏱",
    settings_matrix: "⚙",
    troubleshooting_flowchart: "🔍",
    comparison_table: "📊",
    calculator: "🧮",
    diagnosis_guide: "🔬",
    how_to_guide: "📋",
  };
  return <span>{icons[type] ?? "🔧"}</span>;
}

function MessageBubble({
  message,
  onArtifactClick,
}: {
  message: Message;
  onArtifactClick: (artifact: Artifact) => void;
}) {
  const text = getMessageText(message.content);
  const isUser = message.role === "user";

  const imageBlocks =
    typeof message.content !== "string"
      ? message.content.filter(
          (b): b is ContentBlock & { type: "image" } => b.type === "image"
        )
      : [];

  return (
    <div
      className={`message-enter flex gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
          isUser
            ? "bg-zinc-700 text-zinc-200"
            : "bg-orange-500 text-white"
        }`}
      >
        {isUser ? "U" : "V"}
      </div>

      <div className={`max-w-[85%] flex flex-col gap-2 ${isUser ? "items-end" : "items-start"}`}>
        {/* Image attachment preview */}
        {imageBlocks.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {imageBlocks.map((block, i) => (
              <img
                key={i}
                src={`data:${block.source.media_type};base64,${block.source.data}`}
                alt="Uploaded image"
                className="max-w-[200px] max-h-[200px] rounded-lg border border-zinc-700 object-cover"
              />
            ))}
          </div>
        )}

        {/* Text bubble */}
        {text && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              isUser
                ? "bg-zinc-800 text-zinc-100 rounded-tr-sm"
                : "bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-tl-sm"
            } ${message.streaming && !message.artifact ? "streaming-cursor" : ""}`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{text}</p>
            ) : (
              <div
                className="prose-dark"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
              />
            )}
          </div>
        )}

        {/* Loading dots for empty streaming message */}
        {message.streaming && !text && !message.artifact && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3">
            <LoadingDots />
          </div>
        )}

        {/* Read aloud button for assistant messages */}
        {!isUser && text && !message.streaming && (
          <button
            onClick={() => speak(text)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-orange-400 transition-colors py-0.5 self-start"
            title="Read aloud"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            Read aloud
          </button>
        )}

        {/* Artifact card */}
        {message.artifact && (
          <button
            onClick={() => onArtifactClick(message.artifact!)}
            className="flex items-center gap-3 bg-zinc-900 border border-orange-500/30 hover:border-orange-500/60 rounded-xl px-4 py-3 text-left transition-colors group max-w-[280px]"
          >
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center text-lg flex-shrink-0">
              <ArtifactTypeIcon type={message.artifact.artifact_type} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-orange-400 font-medium mb-0.5 uppercase tracking-wider">
                {message.artifact.artifact_type.replace(/_/g, " ")}
              </p>
              <p className="text-sm text-zinc-200 group-hover:text-white truncate font-medium">
                {message.artifact.title}
              </p>
            </div>
            <svg
              className="w-4 h-4 text-zinc-500 group-hover:text-orange-400 flex-shrink-0 ml-auto transition-colors"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function ArtifactPanel({
  artifact,
  onClose,
}: {
  artifact: Artifact | null;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  if (!artifact) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-4">
        <div className="w-16 h-16 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl">
          🔧
        </div>
        <div>
          <p className="text-zinc-400 text-sm font-medium mb-1">
            Diagrams appear here
          </p>
          <p className="text-zinc-600 text-xs leading-relaxed">
            Wiring diagrams, duty cycle charts, settings tables, and
            troubleshooting guides will render in this panel.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-[220px] mt-2">
          {[
            { icon: "⚡", label: "Wiring Diagrams" },
            { icon: "⏱", label: "Duty Cycles" },
            { icon: "⚙", label: "Settings Tables" },
            { icon: "🔍", label: "Troubleshooting" },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-center"
            >
              <div className="text-lg mb-1">{item.icon}</div>
              <p className="text-zinc-500 text-xs">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full artifact-new">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <ArtifactTypeIcon type={artifact.artifact_type} />
          <div className="min-w-0">
            <p className="text-orange-400 text-xs uppercase tracking-wider font-medium">
              {artifact.artifact_type.replace(/_/g, " ")}
            </p>
            <p className="text-zinc-200 text-sm font-semibold truncate">
              {artifact.title}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 ml-2 w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Close diagram"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Artifact iframe */}
      <div className="flex-1 min-h-0">
        <iframe
          ref={iframeRef}
          srcDoc={artifact.html}
          sandbox="allow-scripts allow-same-origin"
          className="w-full h-full border-0"
          title={artifact.title}
        />
      </div>
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-3">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-orange-500 text-xs font-bold uppercase tracking-widest leading-none">VULCAN</p>
            <p className="text-white text-lg font-bold leading-tight">OmniPro 220</p>
          </div>
        </div>
        <p className="text-zinc-400 text-sm max-w-[260px] leading-relaxed">
          Expert AI assistant for your multiprocess welder. Ask anything — I'll
          show you diagrams, not just words.
        </p>
      </div>

      {/* Suggestions */}
      <div className="w-full max-w-sm space-y-2">
        <p className="text-zinc-600 text-xs uppercase tracking-wider font-medium mb-3">
          Try asking
        </p>
        {SUGGESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onSuggestion(q)}
            className="w-full text-left text-sm bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-orange-500/30 rounded-xl px-4 py-3 text-zinc-300 hover:text-zinc-100 transition-all leading-snug group"
          >
            <span className="text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity mr-1">
              →
            </span>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [pendingImage, setPendingImage] = useState<ImageAttachment | null>(null);
  const [mobileTab, setMobileTab] = useState<"chat" | "diagram">("chat");
  const [hasNewArtifact, setHasNewArtifact] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const handleImageUpload = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const [header, data] = dataUrl.split(",");
        const mediaType = header.match(/data:([^;]+)/)?.[1] as
          | ImageAttachment["mediaType"]
          | undefined;
        if (!data || !mediaType) return;
        setPendingImage({ data, mediaType, preview: dataUrl });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    []
  );

  const sendMessage = useCallback(
    async (text: string, image?: ImageAttachment) => {
      if ((!text.trim() && !image) || isLoading) return;

      const userContent: ContentBlock[] = [];
      if (image) {
        userContent.push({
          type: "image",
          source: { type: "base64", media_type: image.mediaType, data: image.data },
        });
      }
      if (text.trim()) {
        userContent.push({ type: "text", text: text.trim() });
      }

      const userMessage: Message = {
        role: "user",
        content:
          userContent.length === 1 && userContent[0].type === "text"
            ? text.trim()
            : userContent,
      };

      const assistantPlaceholder: Message = {
        role: "assistant",
        content: "",
        streaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
      setInput("");
      setPendingImage(null);
      setIsLoading(true);

      const historyMessages = [...messages, userMessage];

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: toApiMessages(historyMessages) }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";
        let latestArtifact: Artifact | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const dataLine = part
              .split("\n")
              .find((l) => l.startsWith("data: "));
            if (!dataLine) continue;

            try {
              const event = JSON.parse(dataLine.slice(6));

              if (event.type === "text") {
                fullText += event.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    content: fullText,
                    artifact: latestArtifact,
                  };
                  return updated;
                });
              } else if (event.type === "artifact") {
                latestArtifact = {
                  title: event.title,
                  artifact_type: event.artifact_type,
                  html: event.html,
                };
                setActiveArtifact(latestArtifact);
                setHasNewArtifact(true);
                setTimeout(() => setHasNewArtifact(false), 2000);
                // Switch mobile tab to diagram
                setMobileTab("diagram");
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    artifact: latestArtifact,
                  };
                  return updated;
                });
              } else if (event.type === "error") {
                fullText += `\n\n*Error: ${event.message}*`;
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: fullText,
                    streaming: false,
                  };
                  return updated;
                });
              } else if (event.type === "done") {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    streaming: false,
                  };
                  return updated;
                });
              }
            } catch {
              // Skip malformed SSE line
            }
          }
        }
      } catch (err) {
        console.error("Send error:", err);
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content:
              "Sorry, something went wrong. Please check your API key and try again.",
            streaming: false,
          };
          return updated;
        });
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      sendMessage(input, pendingImage ?? undefined);
    },
    [input, pendingImage, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input, pendingImage ?? undefined);
      }
    },
    [input, pendingImage, sendMessage]
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen bg-zinc-950 overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 flex items-center justify-between px-4 h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-orange-500 rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <span className="text-orange-500 text-xs font-bold uppercase tracking-widest mr-1">
              VULCAN
            </span>
            <span className="text-white font-semibold text-sm">OmniPro 220</span>
          </div>
          <span className="hidden sm:block text-zinc-600 text-xs ml-1">
            Expert Assistant
          </span>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex lg:hidden items-center bg-zinc-900 rounded-lg p-0.5 gap-0.5">
          {(["chat", "diagram"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize relative ${
                mobileTab === tab
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab}
              {tab === "diagram" && hasNewArtifact && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="hidden lg:flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-zinc-500 text-xs">Connected</span>
        </div>
      </header>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* ── Chat Panel ── */}
        <div
          className={`flex flex-col min-w-0 ${
            mobileTab === "chat" ? "flex w-full" : "hidden"
          } lg:flex lg:w-[52%] lg:border-r lg:border-zinc-800`}
        >
          {/* Messages */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
          >
            {isEmpty ? (
              <EmptyState onSuggestion={(q) => sendMessage(q)} />
            ) : (
              messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  onArtifactClick={(artifact) => {
                    setActiveArtifact(artifact);
                    setMobileTab("diagram");
                  }}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-3">
            {/* Pending image preview */}
            {pendingImage && (
              <div className="flex items-center gap-2 mb-2">
                <div className="relative">
                  <img
                    src={pendingImage.preview}
                    alt="Pending"
                    className="h-12 w-12 object-cover rounded-lg border border-zinc-700"
                  />
                  <button
                    onClick={() => setPendingImage(null)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-700 hover:bg-zinc-600 rounded-full flex items-center justify-center text-zinc-300 text-xs"
                  >
                    ×
                  </button>
                </div>
                <span className="text-zinc-500 text-xs">Image attached</span>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2"
            >
              {/* Image upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-zinc-200 transition-colors"
                title="Attach weld photo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about setup, settings, troubleshooting…"
                rows={1}
                disabled={isLoading}
                className="flex-1 resize-none bg-zinc-900 border border-zinc-700 hover:border-zinc-600 focus:border-orange-500/50 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none transition-colors min-h-[40px] max-h-[160px] disabled:opacity-50"
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={(!input.trim() && !pendingImage) || isLoading}
                className="flex-shrink-0 w-9 h-9 rounded-lg bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-800 disabled:text-zinc-600 flex items-center justify-center text-white transition-colors"
                title="Send (Enter)"
              >
                {isLoading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </form>

            <p className="text-zinc-700 text-xs mt-2 text-center">
              Enter to send · Shift+Enter for new line · Attach a weld photo for diagnosis
            </p>
          </div>
        </div>

        {/* ── Artifact Panel ── */}
        <div
          className={`flex flex-col bg-zinc-950 min-w-0 ${
            mobileTab === "diagram" ? "flex w-full" : "hidden"
          } lg:flex lg:flex-1`}
        >
          <ArtifactPanel
            artifact={activeArtifact}
            onClose={() => {
              setActiveArtifact(null);
              setMobileTab("chat");
            }}
          />
        </div>
      </div>
    </div>
  );
}
