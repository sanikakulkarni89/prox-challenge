# Vulcan OmniPro 220 — AI Welding Agent

A multimodal reasoning agent for the Vulcan OmniPro 220 built on the Anthropic Claude API. Ask it anything about the machine — it won't just answer in text.

## Demo


🎥 [Watch the demo walkthrough](https://www.loom.com/share/561b2d43e8c34c25a9150ac64708c9eb)

---

## What It Does

**Answers questions visually, not just in prose.**

- Asks about polarity setup → renders an SVG wiring diagram
- Asks about duty cycle → renders a color-coded settings matrix
- Asks about process compatibility → renders a cross-referenced compatibility table
- Uploads a weld photo → diagnoses the defect and logs the session to memory

**Remembers your history across sessions.**

The agent stores every diagnosis, parameter set, and outcome to a Postgres database. Next session it says things like *"last time you ran MIG on mild steel at 185A you got undercut — try 170A."* Failed corrective actions are logged too, so it never repeats bad advice.

**Refines diagrams conversationally.**

Say *"move the work clamp to the negative terminal"* after a diagram renders — it patches the existing schematic rather than regenerating from scratch.

**Voice input powered by Deepgram nova-3**, purpose-built for technical vocabulary like DCEP, FCAW, ER70S-6, and duty cycle.

---

## Tech Stack

- **Frontend** — Next.js + React
- **AI** — Anthropic Claude API with tool use for visual rendering
- **Voice** — Deepgram nova-3
- **Database** — Postgres on Neon (procedural weld memory)
- **Cache** — Upstash Redis (query-level response cache)
- **Hosting** — Vercel

---

## Try It

🚀 **[your-app.vercel.app](https://prox-challenge-theta.vercel.app)** — no setup required, just open and ask.

If you'd prefer to run it locally:

```bash
git clone sanikakulkarni89/prox-challenge
cd sanikakulkarni89/prox-challenge
cp .env.example .env  # add your own Anthropic API key
npm install
npm run dev
```

The `.env.example` documents all required keys. App runs at `http://localhost:3000`.

---

## Architecture

```
User (text + image + voice)
        ↓
   Next.js Frontend
        ↓
   Claude API — tool use
   ├── render_wiring_diagram
   ├── render_duty_cycle_matrix
   ├── render_compatibility_table
   ├── update_wiring_diagram (diff-based edits)
   └── render_settings_configurator
        ↓
   Visual rendered inline in chat
        ↓
   Diagnosis auto-saved → Neon Postgres
   Response cached → Upstash Redis
```

---

## Design Decisions

**Tool use over prompting for visuals.** Rather than asking Claude to describe a diagram, structured tool calls force it to emit machine-readable node/edge data that the frontend renders as SVG. The visual is always accurate because it's generated from structured output, not prose interpretation.

**Memory is semantic, not a chat log.** The DB stores defect type, parameters, and outcome — not raw conversation history. This lets the agent reason over past sessions rather than just repeat them.

**Deepgram over Web Speech API.** The browser's built-in speech recognition fails on welding terminology. nova-3 handles domain-specific vocab reliably enough to use in a live demo.

---

Built for the [Prox Founding Engineer Challenge](https://useprox.com/join/challenge).