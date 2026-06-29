import { NextResponse, type NextRequest } from "next/server";
import { getAddress } from "viem";
import { ensureAgentSession } from "@/lib/agent-session";
import { getAgentWalletStatus } from "@/lib/agent-wallet";
import { verifyRestoreByLinkedRequest } from "@/lib/agent-wallet-link-auth";
import { verifyRecoverRequest } from "@/lib/agent-wallet-recover-auth";
import {
  rebindUserAgentWalletByLinkedWallet,
  rebindUserAgentWalletToSession,
} from "@/lib/user-agent-wallet";

export async function POST(req: NextRequest) {
  let body: { agentAddress?: string; mode?: string };
  try {
    body = (await req.json()) as { agentAddress?: string; mode?: string };
  } catch {
    body = {};
  }

  const sessionId = await ensureAgentSession();
  const useLinkedOnly =
    body.mode === "linked" || !body.agentAddress?.trim();

  if (useLinkedOnly) {
    const verified = await verifyRestoreByLinkedRequest(req);
    if (!verified) {
      return NextResponse.json(
        { error: "Connect the MetaMask address you linked and sign to restore." },
        { status: 401 },
      );
    }

    try {
      const rebound = await rebindUserAgentWalletByLinkedWallet(
        verified.linkedWallet,
        sessionId,
      );
      if (!rebound) {
        return NextResponse.json(
          {
            error:
              "No agent wallet is linked to this MetaMask address. Link MetaMask after creating your agent wallet.",
          },
          { status: 404 },
        );
      }

      const status = await getAgentWalletStatus();
      return NextResponse.json({
        ...status,
        recovered: true,
        message:
          "Agent wallet restored via linked MetaMask. Your balances are unchanged.",
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Recovery failed" },
        { status: 400 },
      );
    }
  }

  const rawAddress = body.agentAddress?.trim();
  if (!rawAddress) {
    return NextResponse.json({ error: "agentAddress is required" }, { status: 400 });
  }

  let agentAddress: `0x${string}`;
  try {
    agentAddress = getAddress(rawAddress);
  } catch {
    return NextResponse.json({ error: "Invalid agent wallet address" }, { status: 400 });
  }

  const verified = await verifyRecoverRequest(req, agentAddress);
  if (!verified) {
    return NextResponse.json(
      { error: "Connect MetaMask and sign the recovery message" },
      { status: 401 },
    );
  }

  try {
    const rebound = await rebindUserAgentWalletToSession(
      verified.agentAddress,
      sessionId,
      verified.linkedWallet,
    );
    if (!rebound) {
      return NextResponse.json({ error: "Agent wallet not found" }, { status: 404 });
    }

    const status = await getAgentWalletStatus();
    return NextResponse.json({
      ...status,
      recovered: true,
      message:
        "Agent wallet restored for this browser. Your Gateway balance and wallet USDC are unchanged.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recovery failed" },
      { status: 400 },
    );
  }
}