import { NextResponse } from "next/server";
import {
  getTargetClaims,
  getTargetSummaries,
  invalidateAttestationCache,
} from "@/lib/attestation-index";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = params.get("target")?.trim();
  if (params.get("refresh") === "1") invalidateAttestationCache();

  try {
    if (target) {
      const detail = await getTargetClaims(target);
      return NextResponse.json(detail, {
        headers: { "Cache-Control": "no-store, max-age=0" },
      });
    }

    const targets = await getTargetSummaries();
    return NextResponse.json(
      { targets },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load attestations" },
      { status: 500 },
    );
  }
}