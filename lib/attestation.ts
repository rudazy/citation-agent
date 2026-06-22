export const ARC_TESTNET_CHAIN_ID = 5042002;

export const ATTESTATION_ABI = [
  {
    type: "function",
    name: "USDC",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MIN_STAKE",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "PLATFORM_FEE",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "platformFeeRecipient",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "attest",
    inputs: [
      { name: "target", type: "string" },
      { name: "claim", type: "string" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getAttestations",
    inputs: [{ name: "target", type: "string" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "staker", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "claim", type: "string" },
          { name: "target", type: "string" },
          { name: "timestamp", type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "attestationCount",
    inputs: [{ name: "target", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalStaked",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Attested",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "claim", type: "string", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
] as const;

export const MIN_STAKE_USDC = 0.1;
export const MIN_STAKE_UNITS = BigInt(100_000); // 0.1 USDC, 6 decimals
export const ATTESTATION_PLATFORM_FEE_USDC = 0.1;
export const ATTESTATION_PLATFORM_FEE_UNITS = BigInt(100_000);
export const MIN_CLAIM_CHARS = 4;

/** Total USDC pulled from the staker wallet: stake locked on-chain + flat platform fee. */
export function totalAttestationCostUsdc(stakeUsdc: number): number {
  return stakeUsdc + ATTESTATION_PLATFORM_FEE_USDC;
}

export function totalAttestationCostUnits(stakeUnits: bigint): bigint {
  return stakeUnits + ATTESTATION_PLATFORM_FEE_UNITS;
}

export function getAttestationAddress(): `0x${string}` | null {
  const address = process.env.ATTESTATION_ADDRESS ?? process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  return address as `0x${string}`;
}