/**
 * Browser-side Circle Gateway x402 payment (MetaMask EIP-712).
 * Shared by marketplace demo and citation unlock flows.
 */

import type { EthereumProvider } from "@/lib/ethereum-provider";
import { PAYMENT_MEMO_HEADER } from "@/lib/payment-memo";

type PaymentChallenge = {
  accepts: Array<{
    network: string;
    payTo: string;
    amount: string;
    maxTimeoutSeconds: number;
    extra: { verifyingContract: string };
  }>;
  resource: unknown;
};

function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

function b64encode(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

export async function payGatewayWithMetaMask(params: {
  path: string;
  account: `0x${string}`;
  ethereum: EthereumProvider;
  memo?: string;
}): Promise<{ ok: boolean; status: number; data: unknown }> {
  const { path, account, ethereum, memo } = params;

  const r1 = await fetch(path);
  if (r1.status !== 402) {
    const text = await r1.text();
    return {
      ok: r1.ok,
      status: r1.status,
      data: text ? tryParseJson(text) : null,
    };
  }

  const requiredHeader = r1.headers.get("PAYMENT-REQUIRED");
  if (!requiredHeader) {
    return { ok: false, status: 402, data: { error: "Missing PAYMENT-REQUIRED header" } };
  }

  const challenge = JSON.parse(b64decode(requiredHeader)) as PaymentChallenge;
  const accepted = challenge.accepts[0];
  if (!accepted) {
    return { ok: false, status: 402, data: { error: "No payment accepts in challenge" } };
  }

  const chainId = parseInt(accepted.network.split(":")[1], 10);
  const now = Math.floor(Date.now() / 1000);
  const validBefore = (
    now + Math.max(accepted.maxTimeoutSeconds, 7 * 24 * 3600 + 600)
  ).toString();
  const validAfter = (now - 600).toString();
  const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}` as `0x${string}`;

  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        { name: "verifyingContract", type: "address" },
      ],
      TransferWithAuthorization: [
        { name: "from", type: "address" },
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "validAfter", type: "uint256" },
        { name: "validBefore", type: "uint256" },
        { name: "nonce", type: "bytes32" },
      ],
    },
    primaryType: "TransferWithAuthorization",
    domain: {
      name: "GatewayWalletBatched",
      version: "1",
      chainId,
      verifyingContract: accepted.extra.verifyingContract,
    },
    message: {
      from: account,
      to: accepted.payTo,
      value: accepted.amount,
      validAfter,
      validBefore,
      nonce,
    },
  };

  const signature = (await ethereum.request({
    method: "eth_signTypedData_v4",
    params: [account, JSON.stringify(typedData)],
  })) as string;

  const paymentPayload = {
    x402Version: 2,
    payload: {
      signature,
      authorization: {
        from: account,
        to: accepted.payTo,
        value: accepted.amount,
        validAfter,
        validBefore,
        nonce,
      },
    },
    accepted,
    resource: challenge.resource,
  };

  const headers: Record<string, string> = {
    "payment-signature": b64encode(paymentPayload),
  };
  if (memo) headers[PAYMENT_MEMO_HEADER] = memo;

  const r2 = await fetch(path, { headers });
  const body = await r2.json().catch(async () => await r2.text());

  return { ok: r2.ok, status: r2.status, data: body };
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}