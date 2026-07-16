import { NextResponse } from "next/server";
import {
  getTargetClaims,
  getTargetSummariesResult,
  invalidateAttestationCache,
} from "@/lib/attestation-index";

/** User-facing message only — never forward raw viem/RPC bodies. */
const LIVE_UNAVAILABLE =
  "Live chain data is temporarily unavailable. Showing last known claims.";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const target = params.get("target")?.trim();
  if (params.get("refresh") === "1") invalidateAttestationCache();

  try {
    if (target) {
      const detail = await getTargetClaims(target);
      return NextResponse.json(
        {
          ...detail,
          // Strip internal diagnostics from the public payload.
          liveUnavailable: !detail.complete && detail.claims.length === 0,
          notice:
            detail.partial || !detail.complete
              ? detail.claims.length > 0
                ? detail.partial
                  ? "Partial results, still syncing"
                  : undefined
                : LIVE_UNAVAILABLE
              : undefined,
        },
        {
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    const result = await getTargetSummariesResult();
    const hasRows = result.targets.length > 0;

    // Hard failure only when we have nothing to show.
    if (!result.complete && !hasRows) {
      console.error(
        "[attestation/claims] index empty and incomplete:",
        result.errorMessage ?? "unknown",
      );
      return NextResponse.json(
        {
          targets: [],
          complete: false,
          partial: false,
          liveUnavailable: true,
          notice: LIVE_UNAVAILABLE,
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store, max-age=0" },
        },
      );
    }

    if (result.errorMessage) {
      console.warn(
        "[attestation/claims] partial or incomplete index:",
        result.errorMessage,
      );
    }

    return NextResponse.json(
      {
        targets: result.targets,
        complete: result.complete,
        partial: result.partial,
        liveUnavailable: false,
        notice: result.partial
          ? "Partial results, still syncing"
          : !result.complete
            ? LIVE_UNAVAILABLE
            : undefined,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    console.error(
      "[attestation/claims] unhandled:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        targets: [],
        complete: false,
        partial: false,
        liveUnavailable: true,
        notice: LIVE_UNAVAILABLE,
        error: LIVE_UNAVAILABLE,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  }
}
