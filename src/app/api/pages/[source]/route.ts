import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { SOURCE_LABELS } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { source: string } }
) {
  const { source } = params;

  if (!SOURCE_LABELS[source]) {
    return Response.json({ error: "Unknown source" }, { status: 404 });
  }

  const pagesDir = path.join(process.cwd(), "public", "pages", source);

  if (!fs.existsSync(pagesDir)) {
    return Response.json({
      source,
      label: SOURCE_LABELS[source],
      pages: 0,
      rendered: false,
    });
  }

  const count = fs
    .readdirSync(pagesDir)
    .filter((f) => f.startsWith("page-") && f.endsWith(".png")).length;

  return Response.json({
    source,
    label: SOURCE_LABELS[source],
    pages: count,
    rendered: count > 0,
  });
}
