"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { REFERRAL_QUERY_PARAM } from "@/lib/referral";
import { captureReferral } from "@/lib/referral-client";

/**
 * Stores the `?ref=` code a visitor arrived with so a later unlock credits the
 * curator who routed them. Renders nothing and never blocks the page: unknown
 * codes are discarded server-side.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const ref = searchParams.get(REFERRAL_QUERY_PARAM);

  useEffect(() => {
    if (!ref) return;
    void captureReferral(ref);
  }, [ref]);

  return null;
}
