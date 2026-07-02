/** Server-safe WalletConnect env helpers (no wagmi imports). */

export function getWalletConnectProjectId(): string {
  return process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";
}

export function isWalletConnectConfigured(): boolean {
  return getWalletConnectProjectId().length > 0;
}

export function isWalletUiAvailable(): boolean {
  if (typeof window === "undefined") return isWalletConnectConfigured();
  return isWalletConnectConfigured() || Boolean(window.ethereum);
}