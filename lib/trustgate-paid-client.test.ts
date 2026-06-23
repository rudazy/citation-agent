import { afterEach, describe, expect, it, vi } from "vitest";
import { payAndFetchScore, payWithSessionAgent } from "./trustgate-paid-client";
import type { EthereumProvider } from "@/lib/ethereum-provider";

const ADDR = "0x22d7a91aaaeb75cb3f51bb20751b068d8a9b714f" as const;
const ACCOUNT = "0x0f293d22dee9fccfc13ce095a2c1d4293a670449" as const;
const ARC_HEX = "0x4cef52";
const CHALLENGE = {
  recipient: "0x52E17bC482d00776d73811680CbA9914e83E33CC",
  amount: "0.001",
  chainId: 5042002,
  network: "arc-testnet",
};
const SCORE = { score: 20, tier: "LOW", recommendation: "TIME_LOCKED" };

function mockJson(body: unknown): Response {
  return { ok: true, json: async () => body } as unknown as Response;
}

function walletReturning(handler: (method: string) => unknown): EthereumProvider {
  return {
    request: vi.fn(async (args: { method: string }) => handler(args.method)),
  } as unknown as EthereumProvider;
}

afterEach(() => vi.restoreAllMocks());

describe("payAndFetchScore", () => {
  it("returns a cached score without asking the wallet to pay (no second charge)", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(mockJson({ status: "cached", score: SCORE }));
    const ethereum = walletReturning(() => null);

    const result = await payAndFetchScore({ address: ADDR, ethereum, account: ACCOUNT });

    expect(result).toEqual({ status: "cached", score: SCORE });
    expect(ethereum.request).not.toHaveBeenCalled();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("pays once and posts the proof on a fresh challenge", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(mockJson({ status: "challenge", challenge: CHALLENGE }))
      .mockResolvedValueOnce(mockJson({ status: "ok", score: SCORE }));

    const ethereum = walletReturning((method) => {
      if (method === "eth_chainId") return ARC_HEX;
      if (method === "eth_sendTransaction") return "0xpaymenttx";
      if (method === "eth_getTransactionReceipt") return { status: "0x1" };
      return null;
    });

    const result = await payAndFetchScore({ address: ADDR, ethereum, account: ACCOUNT });

    expect(result).toEqual({ status: "ok", score: SCORE });

    const calls = (ethereum.request as ReturnType<typeof vi.fn>).mock.calls;
    const sends = calls.filter((c) => c[0].method === "eth_sendTransaction");
    expect(sends).toHaveLength(1);

    const postCall = fetchSpy.mock.calls[1];
    expect(postCall[0]).toBe("/api/trustgate/score");
    const body = JSON.parse((postCall[1] as RequestInit).body as string);
    expect(body.address).toBe(ADDR);
    expect(body.proof.txHash).toBe("0xpaymenttx");
    expect(body.proof.from).toBe(ACCOUNT);
    expect(body.proof.network).toBe("arc-testnet");
    expect(body.proof.amount).toBe("0.001");
    expect(body.proof.recipient).toBe(CHALLENGE.recipient);
  });

  it("returns cancelled (no charge) when the user rejects the wallet prompt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockJson({ status: "challenge", challenge: CHALLENGE }),
    );
    const ethereum = walletReturning((method) => {
      if (method === "eth_chainId") return ARC_HEX;
      if (method === "eth_sendTransaction") throw { code: 4001, message: "User rejected" };
      return null;
    });

    const result = await payAndFetchScore({ address: ADDR, ethereum, account: ACCOUNT });
    expect(result).toEqual({ status: "cancelled" });
  });
});

describe("payWithSessionAgent", () => {
  it("returns the score on a successful server-side agent payment", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJson({ status: "ok", score: SCORE }));
    expect(await payWithSessionAgent(ADDR)).toEqual({ status: "ok", score: SCORE });
  });

  it("passes through a cached score without charging again", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJson({ status: "cached", score: SCORE }));
    expect(await payWithSessionAgent(ADDR)).toEqual({ status: "cached", score: SCORE });
  });

  it("surfaces a short insufficient-funds message instead of failing hard", async () => {
    const reason =
      "Agent wallet needs 0.001 USDC to pay the fee (has 0). Fund it via https://faucet.circle.com/";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockJson({ status: "failed", reason }));
    const result = await payWithSessionAgent(ADDR);
    expect(result.status).toBe("failed");
    expect(result.status === "failed" && result.reason).toContain("needs 0.001 USDC");
  });
});
