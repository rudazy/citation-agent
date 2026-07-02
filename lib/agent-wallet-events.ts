export type AgentWalletRestoredDetail = {
  configured?: boolean;
  address?: string | null;
  linkedWallet?: string | null;
  recovered?: boolean;
};

export const AGENT_WALLET_RESTORED_EVENT = "citation-agent:agent-wallet-restored";

export function dispatchAgentWalletRestored(status: AgentWalletRestoredDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(AGENT_WALLET_RESTORED_EVENT, { detail: status }),
  );
}

export function subscribeAgentWalletRestored(
  handler: (status: AgentWalletRestoredDetail) => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const listener = (event: Event) => {
    const custom = event as CustomEvent<AgentWalletRestoredDetail>;
    if (custom.detail?.configured) handler(custom.detail);
  };

  window.addEventListener(AGENT_WALLET_RESTORED_EVENT, listener);
  return () => window.removeEventListener(AGENT_WALLET_RESTORED_EVENT, listener);
}