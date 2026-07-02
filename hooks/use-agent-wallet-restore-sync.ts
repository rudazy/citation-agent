"use client";

import { useEffect } from "react";
import type { AgentWalletStatusResponse } from "@/lib/attestation-client";
import { subscribeAgentWalletRestored } from "@/lib/agent-wallet-events";

/** Re-run `onRestored` when any connect path restores the session agent wallet. */
export function useAgentWalletRestoreSync(
  onRestored: (status: AgentWalletStatusResponse) => void,
): void {
  useEffect(
    () =>
      subscribeAgentWalletRestored((detail) => {
        onRestored(detail as AgentWalletStatusResponse);
      }),
    [onRestored],
  );
}