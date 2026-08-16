import {
  createPublicClient,
  decodeFunctionData,
  formatUnits,
  http,
  parseEventLogs,
} from "viem";
import { arcTestnet } from "viem/chains";
import {
  ATTESTATION_ABI,
  ATTESTATION_PLATFORM_FEE_UNITS,
  getAttestationAddress,
} from "@/lib/attestation";

export type VerifiedAttestationTx = {
  staker: `0x${string}`;
  target: string;
  stakeUsdc: string;
  platformFeeUsdc: string;
  /**
   * Array index of the stake on the contract, read from the `StakeOpened` event.
   *
   * The arbiter functions address a stake by `(target, index)`, and this is the
   * only exact source for it — inferring it by matching staker and amount breaks
   * as soon as one wallet stakes the same amount twice on one target.
   *
   * Null when the contract emitted no `StakeOpened`, i.e. a pre-v2 stake.
   */
  stakeIndex: number | null;
  contractAddress: `0x${string}`;
};

export async function verifyAttestationTx(
  txHash: `0x${string}`,
): Promise<VerifiedAttestationTx | null> {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) return null;

  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const client = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });

  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (!receipt || receipt.status !== "success") return null;

  const tx = await client.getTransaction({ hash: txHash });
  if (tx.to?.toLowerCase() !== contractAddress.toLowerCase()) return null;

  let decoded: ReturnType<typeof decodeFunctionData>;
  try {
    decoded = decodeFunctionData({ abi: ATTESTATION_ABI, data: tx.input });
  } catch {
    return null;
  }
  if (decoded.functionName !== "attest") return null;

  const [target, , amount] = decoded.args as [string, string, bigint];

  let stakeIndex: number | null = null;
  try {
    const events = parseEventLogs({
      abi: ATTESTATION_ABI,
      eventName: "StakeOpened",
      logs: receipt.logs,
    });
    const own = events.find(
      (e) => e.address.toLowerCase() === contractAddress.toLowerCase(),
    );
    if (own) stakeIndex = Number((own.args as { index: bigint }).index);
  } catch {
    // Pre-v2 contracts never emitted StakeOpened; absence is not an error here.
  }

  return {
    staker: tx.from,
    target: target.trim(),
    stakeUsdc: formatUnits(amount, 6),
    platformFeeUsdc: formatUnits(ATTESTATION_PLATFORM_FEE_UNITS, 6),
    stakeIndex,
    contractAddress,
  };
}

export type ArbiterFunction = "freeze" | "unfreeze" | "release" | "slash";

export type VerifiedArbiterTx = {
  functionName: ArbiterFunction;
  target: string;
  index: number;
  /** Present only for `slash`. */
  beneficiary: `0x${string}` | null;
  sender: `0x${string}`;
};

/**
 * Verify an arbiter transaction the operator sent from their own wallet.
 *
 * The client only ever hands us a tx hash — everything else is read back off the
 * chain, so a caller cannot claim a freeze or a settlement that did not happen,
 * or point a real tx at a different resolution.
 */
export async function verifyArbiterTx(
  txHash: `0x${string}`,
  expect: { functionName: ArbiterFunction; target: string; index: number },
): Promise<VerifiedArbiterTx | null> {
  const contractAddress = getAttestationAddress();
  if (!contractAddress) return null;

  const rpcUrl = process.env.ARC_TESTNET_RPC ?? "https://rpc.testnet.arc.network";
  const client = createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) });

  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (!receipt || receipt.status !== "success") return null;

  const tx = await client.getTransaction({ hash: txHash });
  if (tx.to?.toLowerCase() !== contractAddress.toLowerCase()) return null;

  let decoded: ReturnType<typeof decodeFunctionData>;
  try {
    decoded = decodeFunctionData({ abi: ATTESTATION_ABI, data: tx.input });
  } catch {
    return null;
  }
  if (decoded.functionName !== expect.functionName) return null;

  const args = decoded.args as readonly unknown[];
  const target = typeof args[0] === "string" ? args[0].trim() : "";
  const index = typeof args[1] === "bigint" ? Number(args[1]) : -1;

  if (target.toLowerCase() !== expect.target.trim().toLowerCase()) return null;
  if (index !== expect.index) return null;

  const beneficiary =
    expect.functionName === "slash" && typeof args[2] === "string"
      ? (args[2] as `0x${string}`)
      : null;

  return {
    functionName: expect.functionName,
    target,
    index,
    beneficiary,
    sender: tx.from,
  };
}