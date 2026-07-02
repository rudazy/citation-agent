"use client";

import { type ReactNode } from "react";
import { AppKitProvider } from "@/components/wallet/appkit-provider";
import { WalletAgentRestoreListener } from "@/components/wallet/wallet-agent-restore-listener";
import { WagmiAccountRestoreSync } from "@/components/wallet/wagmi-account-restore-sync";

export function WalletProviders({ children }: { children: ReactNode }) {
  return (
    <AppKitProvider cookies={null}>
      {children}
      <WalletAgentRestoreListener />
      <WagmiAccountRestoreSync />
    </AppKitProvider>
  );
}