/**
 * Detect unlock failures caused by low Circle Gateway balance (not wallet USDC).
 * Settlement and facilitator responses use several reason strings.
 */
export function isInsufficientGatewayBalance(reason: string): boolean {
  const normalized = reason.trim().toLowerCase();
  if (!normalized) return false;

  if (normalized.includes("insufficient wallet usdc")) return false;
  if (normalized.includes("agent wallet has no usdc to deposit")) return false;
  if (normalized.includes("fund your agent wallet via circle faucet")) return false;

  if (normalized.includes("insufficient_balance")) return true;
  if (normalized.includes("insufficient_funds")) return true;
  if (normalized.includes("insufficient available balance")) return true;
  if (normalized.includes("payment settlement failed")) return true;

  return false;
}

/** Deposit at least the report price, with a sensible floor (default 1 USDC). */
export function suggestGatewayDepositAmount(
  priceUsdc: string,
  floorUsdc = "1",
): string {
  const price = Number(priceUsdc);
  const floor = Number(floorUsdc);
  if (Number.isNaN(price) || price <= 0) return floorUsdc;

  const needed = Math.max(Number.isNaN(floor) ? 1 : floor, price);
  const rounded = Math.ceil(needed * 100) / 100;

  if (rounded >= 1 && Number.isInteger(rounded)) {
    return String(Math.trunc(rounded));
  }

  return rounded.toFixed(2).replace(/\.?0+$/, "") || floorUsdc;
}

export function gatewayDepositPromptMessage(
  depositAmount: string,
  priceUsdc: string,
): string {
  return `Your wallet has USDC, but you need to deposit it into your payment balance before unlocking. Deposit ${depositAmount} USDC to continue (report price: $${priceUsdc}).`;
}