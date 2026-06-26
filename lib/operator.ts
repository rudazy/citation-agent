/**
 * Server-side operator authorization for platform-fee / seller endpoints.
 *
 * The operator is the immutable platform fee recipient of the deployed
 * Attestation contract, supplied via env (not hardcoded in any component).
 * Requests prove operator identity by signing a short timestamped message with
 * that wallet; the signature is verified here so fee data and seller actions are
 * never exposed to a non-operator, even by direct API calls.
 */

import { verifyMessage } from "viem";
import { consumeAuthSignature } from "@/lib/signature-replay-store";

export const OPERATOR_MESSAGE_PREFIX = "TrustGate operator access";

/** Signed messages older than this are rejected (limits replay). */
export const OPERATOR_AUTH_MAX_AGE_MS = 15 * 60 * 1000;

export function getOperatorAddress(): `0x${string}` | null {
  const raw = (
    process.env.NEXT_PUBLIC_OPERATOR_ADDRESS ?? process.env.OPERATOR_ADDRESS
  )?.trim();
  if (!raw || !/^0x[a-fA-F0-9]{40}$/.test(raw)) return null;
  return raw.toLowerCase() as `0x${string}`;
}

export function isOperatorAddress(address: string | null | undefined): boolean {
  const operator = getOperatorAddress();
  return !!operator && !!address && address.trim().toLowerCase() === operator;
}

/** Deterministic message the operator signs. Server rebuilds it from the timestamp header. */
export function operatorMessage(timestamp: string): string {
  return `${OPERATOR_MESSAGE_PREFIX} ${timestamp}`;
}

/**
 * Verify the request carries a fresh, valid operator signature. Returns false
 * on any problem; never throws.
 */
export async function verifyOperatorRequest(request: Request): Promise<boolean> {
  const address = request.headers.get("x-operator-address");
  const timestamp = request.headers.get("x-operator-timestamp");
  const signature = request.headers.get("x-operator-signature");

  if (!address || !timestamp || !signature) return false;
  if (!isOperatorAddress(address)) return false;
  if (!/^\d+$/.test(timestamp)) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > OPERATOR_AUTH_MAX_AGE_MS) {
    return false;
  }

  try {
    const valid = await verifyMessage({
      address: address as `0x${string}`,
      message: operatorMessage(timestamp),
      signature: signature as `0x${string}`,
    });
    if (!valid) return false;

    return consumeAuthSignature(
      "operator",
      address,
      signature,
      OPERATOR_AUTH_MAX_AGE_MS,
    );
  } catch {
    return false;
  }
}
