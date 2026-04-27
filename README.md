# OmniPro 220 Expert Assistant

> A multimodal reasoning agent for the Vulcan OmniPro 220 multiprocess welding system — built for the Prox founding engineer challenge.

<img src="product.webp" alt="Vulcan OmniPro 220" width="400" /> <img src="product-inside.webp" alt="Vulcan OmniPro 220 — inside panel" width="400" />

---

## Running It

```bash
git clone <this-repo>
cd <this-repo>
cp .env.example .env        # add your Anthropic API key
npm install
npm run dev                 # open http://localhost:3000
```

That's it. Node 18+ required.

---

## What It Does

The agent answers deep technical questions about the Vulcan OmniPro 220 and **generates visual responses, not just text**.

| Ask about… | Agent generates… |
|---|---|
| Wiring / polarity / cable setup | SVG wiring diagram with colored cables and labeled sockets |
| Duty cycle at a given amperage | Interactive calculator — weld time vs. rest time |
| Settings for a process/material/thickness | Styled parameter table with highlighted recommendations |
| Troubleshooting a weld problem | Step-by-step diagnostic flowchart |
| Weld bead diagnosis | Visual guide comparing bead profiles |
| Process selection (MIG vs Flux vs TIG) | Comparison table with trade-offs |

You can also upload a photo of your weld and get a diagnosis.

---

## Architecture

### Knowledge extraction

The 48-page owner's manual, quick-start guide, and process selection chart were read as images (rendered at 150 DPI with poppler). Every specification, table, diagram, and procedure was manually extracted and encoded into a structured knowledge base in `src/lib/knowledge.ts`.

Key sections:
- Complete specs for all 4 processes × 2 voltages (duty cycles, current ranges, OCV)
- Full polarity setup for MIG/DCEP, Flux-Cored/DCEN, TIG/DCEP, and Stick/DCEP
- Wire feed mechanism setup, feed roller sizes, tension calibration
- Shielding gas selection by process and material
- LCD settings procedure step-by-step
- Weld diagnosis for 8 wire weld defects and 5 stick defects
- Complete troubleshooting tables
- Welding technique (CTWD, push/drag angle, TIG rod technique)

The knowledge is baked into the system prompt with prompt caching (`cache_control: ephemeral`) so every request after the first hits the cache. The system prompt is ~3,500 tokens; with caching enabled the per-request cost drops significantly.

### Agent loop

```
User message (text + optional image)
    ↓
claude-opus-4-7 with system prompt + create_artifact tool
    ↓ stream
Text tokens → streamed to frontend in real time
Tool call (create_artifact) → HTML extracted, streamed as SSE artifact event
    ↓
Tool result sent back → agent continues streaming explanation text
    ↓
Done event → streaming cursor removed
```

The `create_artifact` tool is the core mechanism. The agent is instructed (via the system prompt) that calling this tool is **mandatory** when the question involves anything visual. The tool takes:
- `title` — short label shown in the artifact card
- `artifact_type` — one of: `wiring_diagram`, `duty_cycle_chart`, `settings_matrix`, `troubleshooting_flowchart`, `comparison_table`, `calculator`, `diagnosis_guide`, `how_to_guide`
- `html` — a complete, self-contained HTML document

The HTML is rendered in a sandboxed `<iframe srcDoc>` in the right panel. This is the same approach used by Claude.ai's artifact system.

### Design decisions

**Why bake knowledge into the system prompt rather than use RAG?**
At 48 pages and 3,500 tokens of structured knowledge, the whole manual fits comfortably in context. RAG adds retrieval latency, chunking complexity, and retrieval failures. For a single-product assistant, a rich system prompt wins on simplicity, accuracy, and latency. Prompt caching makes the cost negligible.

**Why claude-opus-4-7?**
The hardest part of this challenge is generating correct, beautiful, self-contained HTML artifacts on the first try. Opus consistently produces complete, well-styled, interactive HTML while Sonnet occasionally truncates or produces incomplete documents.

**Why streaming with tool use?**
Text starts appearing immediately while the artifact is being generated in parallel. Users see the response forming in real time rather than waiting for the full round-trip. The SSE protocol makes it easy to multiplex text tokens and artifact events on the same connection.

**Artifact rendering as sandboxed iframe:**
`sandbox="allow-scripts allow-same-origin"` gives artifacts full interactivity (sliders, click handlers, animations) while blocking navigation, form submission, and top-level access. This matches how Claude.ai renders its artifacts.

---

## Project Structure

```
src/
  app/
    page.tsx           — full chat UI (streaming, image upload, artifact panel)
    globals.css        — dark theme, animations, markdown styles
    layout.tsx         — page metadata
    api/
      chat/
        route.ts       — streaming API: agent loop, tool use, SSE
  lib/
    knowledge.ts       — complete Vulcan OmniPro 220 knowledge base + system prompt
    tools.ts           — create_artifact tool definition
```

---

## Original Challenge

## The Product

The [Vulcan OmniPro 220](https://www.harborfreight.com/omnipro-220-industrial-multiprocess-welder-with-120240v-input-57812.html) is a multiprocess welding system sold by Harbor Freight. It supports four welding processes (MIG, Flux-Cored, TIG, and Stick), runs on both 120V and 240V input, and has an LCD-based synergic control system.

Its owner's manual is 48 pages of dense technical content. Duty cycle matrices across multiple voltages and amperages, polarity setup procedures that differ per welding process, wire feed mechanisms with specific tensioner calibrations, wiring schematics, troubleshooting matrices, weld diagnosis diagrams, and a full parts list.

This is exactly the kind of product Prox exists for. Nobody knows how to use this machine straight out of the box but has time to read 48 page manual, but a complicated machine needs expert-level support.

Additional video: https://www.youtube.com/watch?v=kxGDoGcnhBw

## Your Job

Build a multimodal reasoning agent for the Vulcan OmniPro 220 using the Claude Agent SDK. The agent must be able to answer deep technical questions about this product accurately, helpfully, and not just in text.

The manuals are in the `files/` directory.

**There is no limit to how far you can go.** You can integrate voice. You can build a full interactive experience. Sky is the limit. The more ambitious and polished, the better.

## What We're Testing

### 1. Deep Technical Accuracy

Your agent needs to answer questions like these correctly:

- "What's the duty cycle for MIG welding at 200A on 240V?"
- "I'm getting porosity in my flux-cored welds. What should I check?"
- "What polarity setup do I need for TIG welding? Which socket does the ground clamp go in?"

We will test with questions that require cross-referencing multiple manual sections, understanding visual content (diagrams, schematics, charts), and handling ambiguous questions that need clarification from the user.

### 2. Multimodal Responses

This is the most important part. Your agent must not be text-only.

- If someone asks about polarity setup, the agent should draw or show a diagram of which cable goes in which socket, not just describe it.
- If the answer relates to a specific image in the manual (the wire feed mechanism, the front panel controls, the weld diagnosis examples), the agent should surface that image.
- If a question is complex enough, the agent should generate interactive content: a duty cycle calculator, a troubleshooting flowchart, a settings configurator that takes process + material + thickness and outputs recommended wire speed and voltage.

When something is too cognitively hard to explain in words, the agent should draw it. Real-time diagrams, interactive schematics, visual walkthroughs generated through code.

For your agent to handle these responses well you need to reverse engineer Claude artifacts. Here are two places where you can start:
- https://claude.ai/artifacts (see how Claude renders interactive artifacts in chat)
- https://www.reidbarber.com/blog/reverse-engineering-claude-artifacts

### 3. Tone and Helpfulness

Imagine your user just bought this welder and is standing in their garage trying to set it up. They're not an idiot, but they're not a professional welder either.

### 4. Knowledge Extraction Quality

The manual has a mix of text, tables, labeled diagrams, schematics, and decision matrices. Some critical information exists only in images (the welding process selection chart, the weld diagnosis photos, the wiring schematic). We want to see that your agent understands and presents the visual content, not just the text.

## Tech Requirements

- Use the [Anthropic Claude Agent SDK](https://docs.anthropic.com) as the foundation for your agent.
- The project must run locally with a single API key provided via `.env`.
- You are responsible for your own API costs during development.

## How to Present Your Work

**This matters.** Your submission is not just the code — it's how you present it.

- **Build a frontend.** The best way for us to evaluate your agent is if it has a clean, simple UI we can run immediately. This is realistically the only way to properly demo an agent like this.
- **Hosting is a plus.** If you host it somewhere we can access without cloning, that's a strong signal. Not required, but it removes friction and shows initiative.
- **Write a clear README.** Explain how your agent works, what design decisions you made, how knowledge is extracted and represented, and how to run it. Your documentation will be evaluated — we want to see how you think and communicate, not just how you code.
- **Video walkthrough is a huge plus.** Record yourself demoing the agent and explaining your approach. Walk through the hard questions, show how it handles multimodal responses, explain your architecture. This gives us a much richer picture of your work than code alone.

We should be running your agent within 2 minutes of cloning your repo:

```bash
git clone <your-fork>
cd <your-fork>
cp .env.example .env   # we plug in our own Anthropic API key
# your install command (npm install, uv install, etc.)
# your run command (npm run dev, python app.py, etc.)
```

If it takes longer than that to set up, that's a problem.

## What to Submit

1. Fork this repo.
2. Build your solution.
3. Submit your fork URL through the form at [useprox.com/join/challenge](https://useprox.com/join/challenge).

## What Happens Next

We review submissions on a rolling basis and respond to every single one within a few days. Good luck.
