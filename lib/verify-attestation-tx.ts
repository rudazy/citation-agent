import {
  createPublicClient,
  decodeFunctionData,
  formatUnits,
  http,
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

  return {
    staker: tx.from,
    target: target.trim(),
    stakeUsdc: formatUnits(amount, 6),
    platformFeeUsdc: formatUnits(ATTESTATION_PLATFORM_FEE_UNITS, 6),
  };
}