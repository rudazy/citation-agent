"use client";

import dynamic from "next/dynamic";
import { type ReactNode } from "react";

const WalletProviders = dynamic(
  () =>
    import("@/components/wallet/wallet-providers").then((m) => m.WalletProviders),
  { ssr: false },
);

export function WalletProvidersLoader({ children }: { children: ReactNode }) {
  return <WalletProviders>{children}</WalletProviders>;
}