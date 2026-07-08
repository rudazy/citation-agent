import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureAgentSession: vi.fn(),
  getUserAgentWallet: vi.fn(),
  provisionAgentWalletForSession: vi.fn(),
  linkUserAgentWalletToMetaMask: vi.fn(),
}));

vi.mock("@/lib/agent-session", () => ({
  ensureAgentSession: mocks.ensureAgentSession,
}));

vi.mock("@/lib/agent-wallet", () => ({
  provisionAgentWalletForSession: mocks.provisionAgentWalletForSession,
}));

vi.mock("@/lib/user-agent-wallet", () => ({
  getUserAgentWallet: mocks.getUserAgentWallet,
  linkUserAgentWalletToMetaMask: mocks.linkUserAgentWalletToMetaMask,
}));

import { ensurePublisherLinkedToSession } from "./publisher-session-link";

const PUBLISHER = "0x33e27d6dc287B1EA58865DDD9cF9460a53224134" as const;

describe("ensurePublisherLinkedToSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureAgentSession.mockResolvedValue("session-1");
  });

  it("provisions an agent with the publisher as recovery when none exists", async () => {
    mocks.getUserAgentWallet.mockResolvedValue(null);
    mocks.provisionAgentWalletForSession.mockResolvedValue({ address: "0xabc" });

    await ensurePublisherLinkedToSession(PUBLISHER);

    expect(mocks.provisionAgentWalletForSession).toHaveBeenCalledWith({
      recoveryWallet: PUBLISHER,
    });
    expect(mocks.linkUserAgentWalletToMetaMask).not.toHaveBeenCalled();
  });

  it("links the publisher when a session agent already exists", async () => {
    mocks.getUserAgentWallet.mockResolvedValue({ address: "0xabc", linkedWallet: null });

    await ensurePublisherLinkedToSession(PUBLISHER);

    expect(mocks.provisionAgentWalletForSession).not.toHaveBeenCalled();
    expect(mocks.linkUserAgentWalletToMetaMask).toHaveBeenCalledWith(
      "session-1",
      PUBLISHER,
    );
  });
});