"use client";

import { createAppKit, type AppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  arcNetwork,
  pairingFallbackNetwork,
  wagmiAdapter,
  wagmiConfig,
  walletConnectProjectId,
} from "@/config/wagmi";
import { buildWalletConnectMetadata } from "@/lib/wallet-connect-metadata";
import {
  registerAppKitModal,
  registerOpenConnectModal,
} from "@/lib/wallet-connection-client";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      throwOnError: false,
    },
  },
});

let appKitModal: AppKit | null = null;

if (walletConnectProjectId) {
  const metadata = buildWalletConnectMetadata(
    typeof window !== "undefined" ? window.location.origin : undefined,
  );

  const arcRpc =
    process.env.NEXT_PUBLIC_ARC_TESTNET_RPC?.trim() ||
    "https://rpc.testnet.arc.network";

  appKitModal = createAppKit({
    adapters: [wagmiAdapter],
    projectId: walletConnectProjectId,
    // Sepolia listed second so MetaMask mobile can finish WalletConnect pairing
    // when Arc is not in its chain registry (avoids endless "Connecting...").
    networks: [arcNetwork, pairingFallbackNetwork],
    defaultNetwork: arcNetwork,
    metadata,
    // Keep WalletConnect + injected extensions available in the sheet.
    enableWalletConnect: true,
    enableInjected: true,
    enableCoinbase: true,
    allowUnsupportedChain: true,
    // Prefer our Arc RPC over any stale public default.
    customRpcUrls: {
      "eip155:5042002": [{ url: arcRpc }],
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#f5c842",
      "--w3m-color-mix": "#0a0a0a",
      "--w3m-color-mix-strength": 40,
      "--w3m-font-family": "var(--font-geist-sans), system-ui, sans-serif",
      "--w3m-border-radius-master": "4px",
    },
    features: {
      analytics: false,
      email: false,
      socials: false,
      // Prefer wallet list first (MetaMask / WC deep links), not email/social.
      connectMethodsOrder: ["wallet"],
    },
    allWallets: "SHOW",
  });

  registerAppKitModal(appKitModal);
  registerOpenConnectModal(async () => {
    // Open connect sheet; do not await connection here — handoff continues
    // after the sheet closes when the mobile wallet app opens.
    await appKitModal!.open({ view: "Connect" });
  });
}

type AppKitProviderProps = {
  children: ReactNode;
  cookies: string | null;
};

export function AppKitProvider({ children, cookies }: AppKitProviderProps) {
  const initialState = cookieToInitialState(wagmiConfig as Config, cookies);

  return (
    <WagmiProvider
      config={wagmiConfig as Config}
      initialState={initialState}
      reconnectOnMount={false}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}