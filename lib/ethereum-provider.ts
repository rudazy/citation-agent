export type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  providers?: EthereumProvider[];
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

/**
 * Prefer the MetaMask injector when several extensions share window.ethereum
 * (common with Phantom/Rabby/Coinbase). Otherwise the default proxy may never
 * surface a MetaMask popup on eth_requestAccounts.
 */
export function resolveInjectedProvider(): EthereumProvider | undefined {
  if (typeof window === "undefined") return undefined;
  const eth = window.ethereum;
  if (!eth) return undefined;

  const list = Array.isArray(eth.providers) ? eth.providers : [];
  if (list.length > 0) {
    const metamask = list.find((p) => p?.isMetaMask);
    if (metamask) return metamask;
    return list[0];
  }

  return eth;
}

export {};