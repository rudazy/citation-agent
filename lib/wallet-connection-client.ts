"use client";

import type { AppKit } from "@reown/appkit/react";
import { getAccount, switchChain, watchAccount } from "@wagmi/core";
import {
  resolveInjectedProvider,
  type EthereumProvider,
} from "@/lib/ethereum-provider";
import { arcNetwork, wagmiConfig } from "@/config/wagmi";
import { isWalletConnectConfigured } from "@/lib/wallet-connect-env";

let openConnectModalFn: (() => Promise<void>) | null = null;
let appKitModal: AppKit | null = null;

export function registerOpenConnectModal(fn: () => Promise<void>): void {
  openConnectModalFn = fn;
}

export function registerAppKitModal(modal: AppKit): void {
  appKitModal = modal;
}

export async function openConnectModal(): Promise<void> {
  if (!openConnectModalFn) {
    throw new Error("WalletConnect modal is not initialized yet.");
  }
  await openConnectModalFn();
}

function hasInjectedEthereum(): boolean {
  return Boolean(resolveInjectedProvider());
}

export function waitForWalletConnection(
  timeoutMs = 300_000,
): Promise<`0x${string}` | null> {
  const existing = getAccount(wagmiConfig);
  if (existing.isConnected && existing.address) {
    return Promise.resolve(existing.address as `0x${string}`);
  }

  return new Promise((resolve) => {
    let settled = false;
    /** True once AppKit reports the connect sheet is visible. */
    let sawModalOpen = false;
    /** True once the sheet has closed again (wallet handoff or cancel). */
    let sheetClosed = false;
    /**
     * True once a wallet handoff starts (QR scanned / deep link / extension
     * prompt). After this, the modal often closes while the user is still in
     * their wallet app — that must NOT count as cancel.
     */
    let sawConnecting = false;
    let cancelGraceTimer: ReturnType<typeof setTimeout> | null = null;

    const clearCancelGrace = () => {
      if (cancelGraceTimer) {
        clearTimeout(cancelGraceTimer);
        cancelGraceTimer = null;
      }
    };

    const finish = (address: `0x${string}` | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearCancelGrace();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      unwatch();
      unsubscribeModal?.();
      resolve(address);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    const startCancelGrace = (returnedFromWallet = false) => {
      if (settled || cancelGraceTimer) return;
      // While the tab is hidden the user is inside their wallet app; timers
      // are throttled and must not count toward cancellation. The
      // visibilitychange handler restarts the countdown on return.
      if (document.visibilityState === "hidden") return;
      const graceMs = returnedFromWallet
        ? 12_000
        : sawConnecting || hasInjectedEthereum()
          ? 8_000
          : 1_500;
      cancelGraceTimer = setTimeout(() => {
        void (async () => {
          const again = getAccount(wagmiConfig);
          if (again.isConnected && again.address) {
            finish(again.address as `0x${string}`);
            return;
          }
          try {
            const provider = await getEthereumProvider();
            if (provider) {
              const accounts = (await provider.request({
                method: "eth_accounts",
              })) as string[];
              if (accounts[0] && /^0x[a-fA-F0-9]{40}$/.test(accounts[0])) {
                finish(accounts[0] as `0x${string}`);
                return;
              }
            }
          } catch {
            // ignore
          }
          finish(null);
        })();
      }, graceMs);
    };

    // Mobile: tapping a wallet in the sheet backgrounds this tab while the
    // user approves in the wallet app. Pause the cancel countdown while
    // hidden and grant a fresh window once the tab is visible again so the
    // WalletConnect session has time to settle.
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearCancelGrace();
        return;
      }
      if (sheetClosed && !settled) startCancelGrace(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const unwatch = watchAccount(wagmiConfig, {
      onChange(account) {
        if (account.isConnected && account.address) {
          finish(account.address as `0x${string}`);
        }
      },
    });

    const unsubscribeModal = appKitModal?.subscribeState((state) => {
      if (!state.initialized) return;

      if (state.open) {
        sawModalOpen = true;
        sheetClosed = false;
        clearCancelGrace();
      }
      if (state.loading || state.connectingWallet) {
        sawConnecting = true;
      }

      const account = getAccount(wagmiConfig);
      if (account.isConnected && account.address) {
        finish(account.address as `0x${string}`);
        return;
      }

      // Sheet closed: MetaMask extension often opens AFTER the sheet dismisses,
      // and on mobile the wallet app takes over. Give the handoff a grace
      // window before treating the close as a cancel.
      if (sawModalOpen && !state.open) {
        sheetClosed = true;
        startCancelGrace();
      }
    });
  });
}

export async function getEthereumProvider(): Promise<EthereumProvider | undefined> {
  const account = getAccount(wagmiConfig);
  if (account.isConnected && account.connector) {
    try {
      const provider = await account.connector.getProvider();
      if (
        provider &&
        typeof (provider as EthereumProvider).request === "function"
      ) {
        return provider as EthereumProvider;
      }
    } catch {
      // Fall through to injected wallet.
    }
  }

  return resolveInjectedProvider();
}

/** Read already-authorized wallet address only — never opens a connect popup. */
export async function getAuthorizedAccount(
  ethereum?: EthereumProvider,
): Promise<`0x${string}` | null> {
  const wagmiAccount = getAccount(wagmiConfig);
  if (wagmiAccount.isConnected && wagmiAccount.address) {
    return wagmiAccount.address as `0x${string}`;
  }

  const provider = ethereum ?? (await getEthereumProvider());
  if (!provider) return null;

  try {
    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as string[];
    const first = accounts[0];
    return first && /^0x[a-fA-F0-9]{40}$/.test(first)
      ? (first as `0x${string}`)
      : null;
  } catch {
    return null;
  }
}

export async function getConnectedWalletAddress(): Promise<`0x${string}` | null> {
  return getAuthorizedAccount();
}

export type ConnectedWallet = {
  provider: EthereumProvider;
  address: `0x${string}`;
  /**
   * Set when the wallet connected but could not be moved onto Arc Testnet
   * (typical for MetaMask mobile over WalletConnect, which cannot add custom
   * chains remotely). Connection still succeeds; transaction paths re-run the
   * strict chain switch when it actually matters.
   */
  chainWarning?: string;
};

/**
 * Post-connect housekeeping: best-effort switch to Arc plus agent-wallet
 * restore. A chain-switch failure must never fail the connection itself.
 */
async function settleArcAfterConnect(
  provider: EthereumProvider,
): Promise<string | undefined> {
  const { switchToArcTestnet, tryRestoreAgentWalletOnConnect } = await import(
    "@/lib/attestation-client"
  );
  let chainWarning: string | undefined;
  try {
    // Generous window: on mobile the switch/add prompt appears inside the
    // wallet app and the user needs time to read and approve it. Only wallets
    // that silently drop the request burn the full timeout.
    await switchToArcTestnet(provider, { timeoutMs: 20_000 });
  } catch (err) {
    chainWarning = err instanceof Error ? err.message : String(err);
  }
  await tryRestoreAgentWalletOnConnect(provider);
  return chainWarning;
}

async function connectViaInjectedWallet(): Promise<ConnectedWallet> {
  // Prefer MetaMask provider directly — do not rely on a stale wagmi connector.
  const provider = resolveInjectedProvider();
  if (!provider) {
    throw new Error(
      "No wallet available. Connect via WalletConnect or install MetaMask.",
    );
  }

  // Always request accounts on explicit Connect so MetaMask must prompt
  // (or re-confirm). eth_accounts alone never opens a popup.
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!accounts[0]) {
    throw new Error("No wallet account selected.");
  }

  const address = accounts[0] as `0x${string}`;
  const chainWarning = await settleArcAfterConnect(provider);

  return { provider, address, chainWarning };
}

async function connectViaWalletConnectModal(): Promise<ConnectedWallet> {
  await openConnectModal();

  const address = await waitForWalletConnection();
  if (!address) {
    throw new Error("Wallet connection cancelled.");
  }

  const provider = await getEthereumProvider();
  if (!provider) {
    throw new Error(
      "Wallet connected but provider is unavailable. Approve the connection in your wallet app, then try again.",
    );
  }

  const chainWarning = await settleArcAfterConnect(provider);

  return { provider, address, chainWarning };
}

export async function connectWalletInteractive(): Promise<ConnectedWallet> {
  const existing = getAccount(wagmiConfig);
  if (existing.isConnected && existing.address) {
    const provider = await getEthereumProvider();
    if (provider) {
      const chainWarning = await settleArcAfterConnect(provider);
      return {
        provider,
        address: existing.address as `0x${string}`,
        chainWarning,
      };
    }
  }

  // Desktop extension: open MetaMask (or other injected) via eth_requestAccounts
  // BEFORE AppKit. Routing through the WC sheet then picking MetaMask often closes
  // the sheet without ever triggering the extension popup.
  if (hasInjectedEthereum()) {
    try {
      return await connectViaInjectedWallet();
    } catch (err) {
      // User rejected the extension prompt — surface that, don't force WC.
      const message = err instanceof Error ? err.message : String(err);
      if (/reject|denied|user cancel/i.test(message)) {
        throw err;
      }
      // No usable injected session (locked extension, etc.) — fall through to WC.
      if (!isWalletConnectConfigured()) {
        throw err;
      }
    }
  }

  if (isWalletConnectConfigured()) {
    return connectViaWalletConnectModal();
  }

  throw new Error(
    "No wallet available. Connect via WalletConnect or install MetaMask.",
  );
}

export async function switchToArcViaWagmi(): Promise<void> {
  const account = getAccount(wagmiConfig);
  if (!account.isConnected) return;

  try {
    await switchChain(wagmiConfig, { chainId: arcNetwork.id });
  } catch {
    // Connector or injected provider may handle chain switch separately.
  }
}