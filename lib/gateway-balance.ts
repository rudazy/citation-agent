const GATEWAY_API = "https://gateway-api-testnet.circle.com/v1/balances";
const ARC_DOMAIN = 26;

export async function getGatewayBalance(depositor: string): Promise<{
  balance: string;
  pendingBatch: string;
}> {
  const r = await fetch(GATEWAY_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token: "USDC",
      sources: [{ domain: ARC_DOMAIN, depositor }],
    }),
  });

  if (!r.ok) {
    throw new Error(`Gateway balance lookup failed (${r.status})`);
  }

  const data = (await r.json()) as {
    balances?: Array<{ balance: string; pendingBatch?: string }>;
  };
  const row = data.balances?.[0];
  return {
    balance: row?.balance ?? "0",
    pendingBatch: row?.pendingBatch ?? "0",
  };
}