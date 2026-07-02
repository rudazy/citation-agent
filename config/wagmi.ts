import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cookieStorage, createStorage } from "@wagmi/core";
import { arcTestnet } from "viem/chains";
import { getWalletConnectProjectId } from "@/lib/wallet-connect-env";

export const walletConnectProjectId = getWalletConnectProjectId();

export const arcNetwork = arcTestnet;

export const wagmiNetworks = [arcNetwork] as [typeof arcNetwork];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: false,
  projectId: walletConnectProjectId || "placeholder-not-configured",
  networks: wagmiNetworks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;