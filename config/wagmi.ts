import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cookieStorage, createStorage } from "@wagmi/core";
import { arcTestnet, sepolia } from "viem/chains";
import { getWalletConnectProjectId } from "@/lib/wallet-connect-env";

export const walletConnectProjectId = getWalletConnectProjectId();

/**
 * Arc Testnet is the product chain. Sepolia is included only so WalletConnect /
 * MetaMask mobile can complete the pairing session: many mobile wallets hang
 * forever on "Connecting..." when the dapp proposes *only* an unregistered
 * chain (Arc 5042002). After connect we switch the session to Arc.
 */
export const arcNetwork = arcTestnet;
export const pairingFallbackNetwork = sepolia;

export const wagmiNetworks = [arcNetwork, pairingFallbackNetwork] as [
  typeof arcNetwork,
  typeof pairingFallbackNetwork,
];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: false,
  projectId: walletConnectProjectId || "placeholder-not-configured",
  networks: wagmiNetworks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
