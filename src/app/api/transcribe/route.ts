import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioFile = formData.get("audio") as File | null;

  if (!audioFile) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 });
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Deepgram API key not configured" }, { status: 500 });
  }

  const audioBuffer = await audioFile.arrayBuffer();

  const dgRes = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": audioFile.type || "audio/webm",
      },
      body: audioBuffer,
    }
  );

  if (!dgRes.ok) {
    const text = await dgRes.text();
    console.error("Deepgram error:", text);
    return NextResponse.json({ error: "Transcription failed" }, { status: 502 });
  }

  const data = await dgRes.json();
  const transcript =
    (data.results?.channels?.[0]?.alternatives?.[0]?.transcript as string) ?? "";

  return NextResponse.json({ transcript });
}
