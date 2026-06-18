import {
  type Abi,
  type Address,
  type Chain,
  type Hex,
  type WalletClient,
  encodeFunctionData,
  keccak256,
  stringToHex,
} from "viem";

/** Arc Testnet predeployed Memo contract */
export const ARC_MEMO_CONTRACT =
  "0x5294E9927c3306DcBaDb03fe70b92e01cCede505" as const;

export const MEMO_ABI = [
  {
    type: "function",
    name: "memo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "target", type: "address" },
      { name: "data", type: "bytes" },
      { name: "memoId", type: "bytes32" },
      { name: "memoData", type: "bytes" },
    ],
    outputs: [],
  },
] as const satisfies Abi;

type MemoWriteParams = {
  walletClient: WalletClient;
  chain: Chain;
  account: Address;
  target: Address;
  data: Hex;
  memo: string;
  memoIdSeed: string;
};

export function buildMemoId(seed: string): Hex {
  return keccak256(stringToHex(seed));
}

export function buildMemoBytes(memo: string): Hex {
  return stringToHex(memo);
}

/**
 * Wraps a contract call with Arc's Memo contract so memo events emit on-chain.
 */
export async function writeContractWithArcMemo({
  walletClient,
  chain,
  account,
  target,
  data,
  memo,
  memoIdSeed,
}: MemoWriteParams): Promise<Hex> {
  const memoId = buildMemoId(memoIdSeed);
  const memoBytes = buildMemoBytes(memo);

  return walletClient.writeContract({
    account,
    chain,
    address: ARC_MEMO_CONTRACT,
    abi: MEMO_ABI,
    functionName: "memo",
    args: [target, data, memoId, memoBytes],
  });
}

export function encodeContractCallData(
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
): Hex {
  return encodeFunctionData({
    abi,
    functionName,
    args,
  });
}