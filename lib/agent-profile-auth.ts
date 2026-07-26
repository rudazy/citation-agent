/**
 * Shared session-agent + profile gate for identity-bearing marketplace actions
 * (follow, endorse). Provisions a session agent wallet on first use, then
 * requires a claimed username — anonymous wallets cannot carry a public stamp.
 */

import { NextResponse } from "next/server";
import { provisionAgentWalletForSession } from "@/lib/agent-wallet";
import { getProfileByWallet } from "@/lib/platform-profile";
import { resolveUserAgent } from "@/lib/resolve-user-agent";

export type AgentProfileOk = {
  ok: true;
  agent: { address: `0x${string}` };
  profile: { id: string; username: string };
};

export type AgentProfileErr = { ok: false; response: NextResponse };

export type AgentProfileResult = AgentProfileOk | AgentProfileErr;

export async function requireAgentProfile(options?: {
  /** Shown when the caller has a wallet but has not claimed a username yet. */
  usernameRequiredMessage?: string;
}): Promise<AgentProfileResult> {
  let agent = await resolveUserAgent();
  if (!agent) {
    try {
      await provisionAgentWalletForSession();
      agent = await resolveUserAgent();
    } catch (err) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              err instanceof Error ? err.message : "Failed to create agent wallet",
          },
          { status: 500 },
        ),
      };
    }
  }
  if (!agent) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Agent wallet unavailable" },
        { status: 503 },
      ),
    };
  }

  const profile = await getProfileByWallet(agent.address);
  if (!profile) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            options?.usernameRequiredMessage ??
            "Choose a username before continuing",
          code: "username_required",
        },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    agent: { address: agent.address },
    profile: { id: profile.id, username: profile.username },
  };
}
