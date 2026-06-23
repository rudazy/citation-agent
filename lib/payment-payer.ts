/** Who pays for x402 unlocks, trust lookups, and similar micropayments. */
export type PaymentPayer = "agent" | "metamask";

/** Agent wallet is always the default; MetaMask is an explicit override. */
export const DEFAULT_PAYMENT_PAYER: PaymentPayer = "agent";