const STORAGE_KEY = "citation-agent:agent-wallet-address";
const LINKED_STORAGE_KEY = "citation-agent:linked-metamask-address";

export function getStoredAgentWalletAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(STORAGE_KEY)?.trim();
    return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeAgentWalletAddress(address: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, address);
  } catch {
    // Private mode or quota — recovery hint only.
  }
}

export function clearStoredAgentWalletAddress(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getStoredLinkedMetaMaskAddress(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(LINKED_STORAGE_KEY)?.trim();
    return value && /^0x[a-fA-F0-9]{40}$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function storeLinkedMetaMaskAddress(address: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LINKED_STORAGE_KEY, address);
  } catch {
    // ignore
  }
}