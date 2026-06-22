import { formatUnits } from "viem";

const GATEWAY_API = "https://gateway-api-testnet.circle.com/v1/balances";
const ARC_DOMAIN = 26;

export type GatewayBalanceSnapshot = {
  walletUsdc: string;
  gateway: {
    total: string;
    available: string;
    withdrawing: string;
    withdrawable: string;
  };
};

function parseGatewayAmount(value: string): string {
  return value.includes(".") ? value : formatUnits(BigInt(value), 6);
}

export async function fetchGatewayBalanceSnapshot(
  depositor: string,
  walletUsdc: string,
): Promise<GatewayBalanceSnapshot> {
  const empty = {
    walletUsdc,
    gateway: {
      total: "0",
      available: "0",
      withdrawing: "0",
      withdrawable: "0",
    },
  };

  try {
    const response = await fetch(GATEWAY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        token: "USDC",
        sources: [{ domain: ARC_DOMAIN, depositor }],
      }),
    });

    if (!response.ok) return empty;

    const data = (await response.json()) as {
      balances?: Array<{
        balance?: string;
        withdrawing?: string;
        withdrawable?: string;
      }>;
    };
    const row = data.balances?.find((b) => true) ?? data.balances?.[0];
    if (!row) return empty;

    const available = parseGatewayAmount(row.balance ?? "0");
    const withdrawing = parseGatewayAmount(row.withdrawing ?? "0");
    const withdrawable = parseGatewayAmount(row.withdrawable ?? "0");
    const total = (parseFloat(available) + parseFloat(withdrawing)).toFixed(6);

    return {
      walletUsdc,
      gateway: { total, available, withdrawing, withdrawable },
    };
  } catch {
    return empty;
  }
}