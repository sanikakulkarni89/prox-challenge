import Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_artifact",
    description: `Generate an interactive visual artifact as a complete, self-contained HTML document.

ALWAYS use this tool for:
- Wiring / polarity / cable setup → SVG wiring diagram with colored cables and labeled sockets
- Duty cycle questions → interactive calculator with amperage slider showing weld/rest times
- Settings configuration → styled parameter table with highlighted rows
- Troubleshooting a problem → step-by-step decision flowchart
- Process comparison → comparison table
- How the wire feed works → annotated mechanism diagram
- Weld diagnosis → visual diagnosis card showing bead cross-sections

Requirements for the generated HTML:
- Complete document: <!DOCTYPE html> through </html>
- Zero external dependencies — all CSS in <style>, all JS inline
- Dark theme: #0f0f0f background, #f97316 orange accents, #e5e5e5 text
- Red (#dc2626) for positive terminals/cables, Blue (#2563eb) for negative
- Responsive at 600px wide minimum
- Interactive where appropriate (sliders, clickable steps, hover states)
- Smooth, polished aesthetics — this will be shown in a side panel

For wiring diagrams specifically, the SVG must show the actual welder body, labeled socket circles (+ red, - blue), colored cable paths drawn with curves, equipment at cable ends, and a DCEP/DCEN badge.`,
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short descriptive title (e.g. 'TIG Cable Setup — DCEP')",
        },
        artifact_type: {
          type: "string",
          enum: [
            "wiring_diagram",
            "duty_cycle_chart",
            "settings_matrix",
            "troubleshooting_flowchart",
            "comparison_table",
            "calculator",
            "diagnosis_guide",
            "how_to_guide",
          ],
          description: "Type of visual content being generated",
        },
        html: {
          type: "string",
          description:
            "Complete self-contained HTML document. Must be thorough and polished.",
        },
      },
      required: ["title", "artifact_type", "html"],
    },
  },
];
