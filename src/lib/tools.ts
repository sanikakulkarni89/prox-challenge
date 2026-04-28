import Anthropic from "@anthropic-ai/sdk";

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "render_wiring_diagram",
    description: `Render a structured wiring diagram for the Vulcan OmniPro 220.

Use this tool when the user asks about cable connections, polarity setup, socket assignments, or how to physically connect the welder for a specific process (MIG, TIG, Stick, Flux-Core).

The diagram is stored client-side and a diagram ID is returned so you can reference or update it in follow-up turns.`,
    input_schema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short descriptive title, e.g. 'TIG Setup — DCEN'",
        },
        polarity: {
          type: "string",
          enum: ["DCEP", "DCEN", "AC"],
          description: "Overall polarity / current type for this setup",
        },
        nodes: {
          type: "array",
          description: "Components in the wiring diagram",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "welder",
                  "torch",
                  "electrode_holder",
                  "ground_clamp",
                  "workpiece",
                  "wire_feeder",
                  "gas_cylinder",
                  "socket",
                ],
              },
              x: { type: "number", description: "Horizontal position (0–800)" },
              y: { type: "number", description: "Vertical position (0–600)" },
            },
            required: ["id", "label", "type", "x", "y"],
          },
        },
        edges: {
          type: "array",
          description: "Cables and connections between nodes",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              source: { type: "string", description: "Source node ID" },
              target: { type: "string", description: "Target node ID" },
              label: { type: "string" },
              color: {
                type: "string",
                description: "CSS color, e.g. '#dc2626' for positive, '#2563eb' for negative",
              },
              polarity: {
                type: "string",
                enum: ["positive", "negative", "ground", "gas", "control"],
              },
            },
            required: ["id", "source", "target"],
          },
        },
      },
      required: ["title", "nodes", "edges"],
    },
  },
  {
    name: "update_wiring_diagram",
    description: `Use this to modify an existing wiring diagram in response to user corrections or refinements. Prefer this over render_wiring_diagram when a diagram already exists in the conversation.

Accepts a diagram_id and one or more optional change sets: nodes to add, node IDs to remove, edge patches, or node repositioning. Only include the arrays that actually need changing.`,
    input_schema: {
      type: "object",
      properties: {
        diagram_id: {
          type: "string",
          description: "ID of the existing diagram to modify, as returned by render_wiring_diagram",
        },
        add_nodes: {
          type: "array",
          description: "New nodes to add to the diagram",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: {
                type: "string",
                enum: [
                  "welder",
                  "torch",
                  "electrode_holder",
                  "ground_clamp",
                  "workpiece",
                  "wire_feeder",
                  "gas_cylinder",
                  "socket",
                ],
              },
              x: { type: "number" },
              y: { type: "number" },
            },
            required: ["id", "label", "type", "x", "y"],
          },
        },
        remove_node_ids: {
          type: "array",
          description: "IDs of nodes to remove",
          items: { type: "string" },
        },
        update_edges: {
          type: "array",
          description: "Edge patches — must include the edge id plus any fields to change",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              source: { type: "string" },
              target: { type: "string" },
              label: { type: "string" },
              color: { type: "string" },
              polarity: {
                type: "string",
                enum: ["positive", "negative", "ground", "gas", "control"],
              },
            },
            required: ["id"],
          },
        },
        move_nodes: {
          type: "array",
          description: "Reposition existing nodes",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              x: { type: "number" },
              y: { type: "number" },
            },
            required: ["id", "x", "y"],
          },
        },
      },
      required: ["diagram_id"],
    },
  },
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
