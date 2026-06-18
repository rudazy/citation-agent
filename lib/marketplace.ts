export const GATEWAY_API =
  process.env.GATEWAY_API ?? "https://gateway-api-testnet.circle.com";
export const ARC_EXPLORER = "https://testnet.arcscan.app";
export const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;

export const DEMO_SETTLEMENT_ID = "c9933054-6b34-44bb-8c04-e7e9e1b8352c";

export const PINNED_BATCH_TX: Record<string, `0x${string}`> = {
  [DEMO_SETTLEMENT_ID]:
    "0xfbad1baae7fd9b88f4e1b034a4236da02012870acbd6ae83b583e85528be396e",
};