/**
 * Client-side operator helpers: detect whether the connected wallet is the
 * operator, and produce a signed auth payload for operator-only API calls.
 * The operator address comes from NEXT_PUBLIC_OPERATOR_ADDRESS (env, not
 * hardcoded in a component).
 */

import type { EthereumProvider } from "@/lib/ethereum-provider";

const OPERATOR_MESSAGE_PREFIX = "TrustGate operator access";

export function getOperatorAddress(): string | null {
  const raw = process.env.NEXT_PUBLIC_OPERATOR_ADDRESS?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw.toLowerCase();
}

/** Case-insensitive match of a connected wallet against the operator address. */
export function isOperator(address: string | null | undefined): boolean {
  const operator = getOperatorAddress();
  return !!operator && !!address && address.toLowerCase() === operator;
}

export type OperatorAuth = {
  address: `0x${string}`;
  timestamp: string;
  signature: string;
};

/** Prompt the operator's wallet to sign a fresh timestamped access message. */
export async function signOperatorAuth(
  ethereum: EthereumProvider,
  account: `0x${string}`,
): Promise<OperatorAuth> {
  const timestamp = Date.now().toString();
  const message = `${OPERATOR_MESSAGE_PREFIX} ${timestamp}`;
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, account],
  })) as string;
  return { address: account, timestamp, signature };
}

export function operatorHeaders(auth: OperatorAuth): Record<string, string> {
  return {
    "x-operator-address": auth.address,
    "x-operator-timestamp": auth.timestamp,
    "x-operator-signature": auth.signature,
  };
}
