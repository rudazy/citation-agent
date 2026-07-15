"use client";

import type { AppKit } from "@reown/appkit/react";
import { getAccount, switchChain, watchAccount } from "@wagmi/core";
import type { EthereumProvider } from "@/lib/ethereum-provider";
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
  return typeof window !== "undefined" && Boolean(window.ethereum);
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
    /**
     * True once a wallet handoff starts (QR scanned / deep link / extension
     * prompt). After this, the modal often closes while the user is still in
     * their wallet app — that must NOT count as cancel.
     */
    let sawConnecting = false;

    const finish = (address: `0x${string}` | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      unwatch();
      unsubscribeModal?.();
      resolve(address);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

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
      }
      if (state.loading || state.connectingWallet) {
        sawConnecting = true;
        return;
      }

      const account = getAccount(wagmiConfig);
      if (account.isConnected && account.address) {
        finish(account.address as `0x${string}`);
        return;
      }

      // User closed the modal before choosing a wallet.
      // Do not cancel if a wallet handoff is in flight (mobile deep link).
      if (sawModalOpen && !state.open && !sawConnecting) {
        finish(null);
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

  return window.ethereum;
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

async function connectViaInjectedWallet(): Promise<{
  provider: EthereumProvider;
  address: `0x${string}`;
}> {
  let provider = await getEthereumProvider();
  if (!provider) {
    throw new Error(
      "No wallet available. Connect via WalletConnect or install MetaMask.",
    );
  }

  let accounts = (await provider.request({
    method: "eth_accounts",
  })) as string[];

  if (!accounts[0]) {
    accounts = (await provider.request({
      method: "eth_requestAccounts",
    })) as string[];
  }

  if (!accounts[0]) {
    throw new Error("No wallet account selected.");
  }

  provider = (await getEthereumProvider()) ?? provider;
  const address = accounts[0] as `0x${string}`;

  const { switchToArcTestnet, tryRestoreAgentWalletOnConnect } = await import(
    "@/lib/attestation-client"
  );
  await switchToArcTestnet(provider);
  await tryRestoreAgentWalletOnConnect(provider);

  return { provider, address };
}

async function connectViaWalletConnectModal(): Promise<{
  provider: EthereumProvider;
  address: `0x${string}`;
}> {
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

  const { switchToArcTestnet, tryRestoreAgentWalletOnConnect } = await import(
    "@/lib/attestation-client"
  );
  await switchToArcTestnet(provider);
  await tryRestoreAgentWalletOnConnect(provider);

  return { provider, address };
}

export async function connectWalletInteractive(): Promise<{
  provider: EthereumProvider;
  address: `0x${string}`;
}> {
  const existing = getAccount(wagmiConfig);
  if (existing.isConnected && existing.address) {
    const provider = await getEthereumProvider();
    if (provider) {
      const { switchToArcTestnet, tryRestoreAgentWalletOnConnect } = await import(
        "@/lib/attestation-client"
      );
      await switchToArcTestnet(provider);
      await tryRestoreAgentWalletOnConnect(provider);
      return {
        provider,
        address: existing.address as `0x${string}`,
      };
    }
  }

  // Desktop extension: open MetaMask (or other injected) directly.
  // More reliable than routing every click through the WalletConnect sheet.
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