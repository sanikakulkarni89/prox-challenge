import { getRecentDiagnoses } from "@/lib/weldMemory";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return Response.json({ error: "userId required" }, { status: 400 });
  }

  try {
    const diagnoses = await getRecentDiagnoses(userId, 5);
    return Response.json({ diagnoses });
  } catch (err) {
    console.error("Memory fetch error:", err);
    return Response.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
