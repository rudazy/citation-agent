"use client";

import { getAccount, switchChain } from "@wagmi/core";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import { arcNetwork, wagmiConfig } from "@/config/wagmi";
import { isWalletConnectConfigured } from "@/lib/wallet-connect-env";

let openConnectModalFn: (() => Promise<void>) | null = null;

export function registerOpenConnectModal(fn: () => Promise<void>): void {
  openConnectModalFn = fn;
}

export async function openConnectModal(): Promise<void> {
  if (!openConnectModalFn) {
    throw new Error("WalletConnect modal is not initialized yet.");
  }
  await openConnectModalFn();
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

export async function connectWalletInteractive(): Promise<{
  provider: EthereumProvider;
  address: `0x${string}`;
}> {
  if (isWalletConnectConfigured()) {
    await openConnectModal();
  }

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

  return {
    provider,
    address,
  };
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