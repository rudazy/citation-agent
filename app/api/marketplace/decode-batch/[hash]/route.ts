import { NextRequest, NextResponse } from "next/server";
import { decodeBatch, serializeDecodedBatch } from "@/lib/decode-batch";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params;
  if (!hash.startsWith("0x")) {
    return NextResponse.json({ error: "invalid tx hash" }, { status: 400 });
  }

  try {
    const decoded = await decodeBatch(hash as `0x${string}`);
    return NextResponse.json(serializeDecodedBatch(decoded));
  } catch (e) {
    return NextResponse.json(
      { error: String((e as Error).message ?? e) },
      { status: 400 },
    );
  }
}