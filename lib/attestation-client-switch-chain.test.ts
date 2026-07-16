import { describe, expect, it } from "vitest";
import {
  ARC_SWITCH_HELP,
  ARC_TESTNET_HEX,
  switchToArcTestnet,
  type EthereumProvider,
} from "@/lib/attestation-client";

const SEPOLIA_HEX = "0xaa36a7";

type Call = { method: string; params?: unknown[] };

/** Scripted provider: per-method handlers plus a call log. */
function fakeProvider(handlers: {
  chainIds: string[];
  onSwitch?: () => Promise<unknown>;
  onAdd?: () => Promise<unknown>;
}): { provider: EthereumProvider; calls: Call[] } {
  const calls: Call[] = [];
  let chainIdReads = 0;
  const provider: EthereumProvider = {
    request: async ({ method, params }) => {
      calls.push({ method, params });
      if (method === "eth_chainId") {
        const idx = Math.min(chainIdReads, handlers.chainIds.length - 1);
        chainIdReads += 1;
        return handlers.chainIds[idx];
      }
      if (method === "wallet_switchEthereumChain") {
        if (handlers.onSwitch) return handlers.onSwitch();
        return null;
      }
      if (method === "wallet_addEthereumChain") {
        if (handlers.onAdd) return handlers.onAdd();
        return null;
      }
      throw new Error(`Unexpected method ${method}`);
    },
  };
  return { provider, calls };
}

describe("switchToArcTestnet", () => {
  it("no-ops when the wallet is already on Arc", async () => {
    const { provider, calls } = fakeProvider({ chainIds: [ARC_TESTNET_HEX] });
    await switchToArcTestnet(provider, { timeoutMs: 200 });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("eth_chainId");
  });

  it("switches directly when the wallet already knows Arc", async () => {
    const { provider, calls } = fakeProvider({ chainIds: [SEPOLIA_HEX] });
    await switchToArcTestnet(provider, { timeoutMs: 200 });
    expect(calls.map((c) => c.method)).toEqual([
      "eth_chainId",
      "wallet_switchEthereumChain",
    ]);
  });

  it("adds Arc on EIP-3085 code 4902 and verifies the resulting chain", async () => {
    let added = false;
    const { provider, calls } = fakeProvider({
      chainIds: [SEPOLIA_HEX, ARC_TESTNET_HEX],
      onSwitch: () => {
        if (!added) return Promise.reject({ code: 4902 });
        return Promise.resolve(null);
      },
      onAdd: () => {
        added = true;
        return Promise.resolve(null);
      },
    });
    await switchToArcTestnet(provider, { timeoutMs: 200 });
    expect(calls.some((c) => c.method === "wallet_addEthereumChain")).toBe(true);
  });

  it("treats WalletConnect unapproved-chain rejections like unknown chains", async () => {
    let added = false;
    const { provider, calls } = fakeProvider({
      chainIds: [SEPOLIA_HEX, ARC_TESTNET_HEX],
      onSwitch: () => {
        if (!added) {
          return Promise.reject(
            new Error('Unrecognized chain ID "eip155:5042002".'),
          );
        }
        return Promise.resolve(null);
      },
      onAdd: () => {
        added = true;
        return Promise.resolve(null);
      },
    });
    await switchToArcTestnet(provider, { timeoutMs: 200 });
    expect(calls.some((c) => c.method === "wallet_addEthereumChain")).toBe(true);
  });

  it("throws actionable guidance when the add request is silently ignored", async () => {
    const { provider } = fakeProvider({
      // Chain never changes: the wallet accepted nothing.
      chainIds: [SEPOLIA_HEX],
      onSwitch: () => Promise.reject({ code: 4902 }),
      onAdd: () => Promise.resolve(null),
    });
    await expect(
      switchToArcTestnet(provider, { timeoutMs: 200 }),
    ).rejects.toThrow(ARC_SWITCH_HELP);
  });

  it("rethrows genuine user rejections instead of trying to add the chain", async () => {
    const { provider, calls } = fakeProvider({
      chainIds: [SEPOLIA_HEX],
      onSwitch: () =>
        Promise.reject(new Error("User rejected the request.")),
    });
    await expect(
      switchToArcTestnet(provider, { timeoutMs: 200 }),
    ).rejects.toThrow(/User rejected/);
    expect(calls.some((c) => c.method === "wallet_addEthereumChain")).toBe(
      false,
    );
  });

  it("times out instead of hanging when the wallet drops the request", async () => {
    const { provider } = fakeProvider({
      chainIds: [SEPOLIA_HEX],
      // Never resolves — MetaMask mobile over WalletConnect can drop requests.
      onSwitch: () => new Promise(() => {}),
    });
    await expect(
      switchToArcTestnet(provider, { timeoutMs: 100 }),
    ).rejects.toThrow(/timed out/);
  });
});
