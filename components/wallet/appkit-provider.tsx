"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useEffect } from "react";
import { cookieToInitialState, WagmiProvider, type Config } from "wagmi";
import {
  arcNetwork,
  wagmiAdapter,
  wagmiConfig,
  walletConnectProjectId,
} from "@/config/wagmi";
import { OFFICIAL_SITE_URL } from "@/lib/site-url";
import { registerOpenConnectModal } from "@/lib/wallet-connection-client";

const queryClient = new QueryClient();

const siteMetadata = {
  name: "Citation Agent",
  description:
    "Researchers sell crypto research. AI agents and humans buy it.",
  url: OFFICIAL_SITE_URL,
  icons: [`${OFFICIAL_SITE_URL}/icon.svg`],
};

let appKitInitialized = false;

function ensureAppKit() {
  if (appKitInitialized || !walletConnectProjectId) return;

  const modal = createAppKit({
    adapters: [wagmiAdapter],
    projectId: walletConnectProjectId,
    networks: [arcNetwork],
    defaultNetwork: arcNetwork,
    metadata: siteMetadata,
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

  registerOpenConnectModal(async () => {
    modal.open();
  });

  appKitInitialized = true;
}

type AppKitProviderProps = {
  children: ReactNode;
  cookies: string | null;
};

export function AppKitProvider({ children, cookies }: AppKitProviderProps) {
  useEffect(() => {
    if (walletConnectProjectId) ensureAppKit();
  }, []);

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