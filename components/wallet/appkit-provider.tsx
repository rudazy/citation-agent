"use client";

import { createAppKit, type AppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  arcNetwork,
  wagmiAdapter,
  wagmiConfig,
  walletConnectProjectId,
} from "@/config/wagmi";
import { buildWalletConnectMetadata } from "@/lib/wallet-connect-metadata";
import {
  registerAppKitModal,
  registerOpenConnectModal,
} from "@/lib/wallet-connection-client";

const queryClient = new QueryClient();

let appKitModal: AppKit | null = null;

if (walletConnectProjectId) {
  const metadata = buildWalletConnectMetadata(
    typeof window !== "undefined" ? window.location.origin : undefined,
  );

  appKitModal = createAppKit({
    adapters: [wagmiAdapter],
    projectId: walletConnectProjectId,
    networks: [arcNetwork],
    defaultNetwork: arcNetwork,
    metadata,
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
    },
  });

  registerAppKitModal(appKitModal);
  registerOpenConnectModal(async () => {
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