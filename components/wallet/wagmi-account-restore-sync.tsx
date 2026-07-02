"use client";

/**
 * Restore is triggered from explicit connect handlers only (see connectWalletInteractive).
 * Intentionally empty to avoid WalletConnect / MetaMask popups on page load.
 */
export function WagmiAccountRestoreSync() {
  return null;
}