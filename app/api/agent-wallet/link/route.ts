import { NextResponse, type NextRequest } from "next/server";
import { ensureAgentSession } from "@/lib/agent-session";
import { getAgentWalletStatus } from "@/lib/agent-wallet";
import { verifyLinkRequest } from "@/lib/agent-wallet-link-auth";
import { parseRecoveryWallet } from "@/lib/recovery-wallet";
import {
  getUserAgentWallet,
  linkUserAgentWalletToMetaMask,
  pasteRecoveryWalletForSession,
} from "@/lib/user-agent-wallet";

export async function POST(req: NextRequest) {
  const sessionId = await ensureAgentSession();
  const stored = await getUserAgentWallet(sessionId);
  if (!stored) {
    return NextResponse.json(
      { error: "Create your agent wallet before setting a recovery address." },
      { status: 400 },
    );
  }

  const verified = await verifyLinkRequest(req, stored.address);
  if (verified) {
    try {
      await linkUserAgentWalletToMetaMask(sessionId, verified.linkedWallet);
      const status = await getAgentWalletStatus();
      return NextResponse.json({
        ...status,
        linked: true,
        message:
          "Recovery address verified with MetaMask. Restore on any device by connecting this wallet.",
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Link failed" },
        { status: 400 },
      );
    }
  }

  let body: { recoveryWallet?: string } = {};
  try {
    const text = await req.text();
    if (text.trim()) {
      body = JSON.parse(text) as { recoveryWallet?: string };
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recoveryWallet = parseRecoveryWallet(body.recoveryWallet);
  if (!recoveryWallet) {
    return NextResponse.json(
      {
        error:
          "Paste a valid recovery MetaMask address, or connect MetaMask and sign to verify.",
      },
      { status: 400 },
    );
  }

  try {
    await pasteRecoveryWalletForSession(sessionId, recoveryWallet);
    const status = await getAgentWalletStatus();
    return NextResponse.json({
      ...status,
      linked: true,
      pasted: true,
      message:
        "Recovery address saved. Connect that MetaMask on any device and sign to restore this agent wallet.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not save recovery address" },
      { status: 400 },
    );
  }
}