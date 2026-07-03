import { describe, expect, it } from "vitest";
import {
  buildWalletConnectMetadata,
  resolveWalletConnectOrigin,
} from "./wallet-connect-metadata";

describe("wallet-connect-metadata", () => {
  it("prefers the runtime browser origin for WalletConnect verify", () => {
    expect(resolveWalletConnectOrigin("https://preview.vercel.app")).toBe(
      "https://preview.vercel.app",
    );
  });

  it("falls back to the official site when no runtime origin exists", () => {
    expect(resolveWalletConnectOrigin()).toBe("https://agentcitation.xyz");
    expect(resolveWalletConnectOrigin("   ")).toBe("https://agentcitation.xyz");
  });

  it("builds metadata icons from the same origin", () => {
    const metadata = buildWalletConnectMetadata("https://agentcitation.xyz");
    expect(metadata.url).toBe("https://agentcitation.xyz");
    expect(metadata.icons).toEqual(["https://agentcitation.xyz/icon.svg"]);
  });
});