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
        // AttestationV2 stake record — 9 fields. A short decode does NOT throw,
        // it silently mislabels trailing values, so keep this in exact order.
        components: [
          { name: "staker", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "claim", type: "string" },
          { name: "target", type: "string" },
          { name: "timestamp", type: "uint256" },
          { name: "unlockAt", type: "uint256" },
          { name: "frozenAt", type: "uint256" },
          { name: "firstFrozenAt", type: "uint256" },
          // 0 Active · 1 Withdrawn · 2 Released · 3 Slashed · 4 Reclaimed
          { name: "status", type: "uint8" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reclaimExpiredFreeze",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "freeze",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unfreeze",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "release",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "slash",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
      { name: "beneficiary", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "isWithdrawable",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isReclaimable",
    inputs: [
      { name: "target", type: "string" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lifetimeStaked",
    inputs: [{ name: "", type: "string" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "totalEscrowed",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "arbiter",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lockPeriod",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "SLASH_DELAY",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_FREEZE_DURATION",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
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
    // Unchanged between v1 and v2, so the event indexer works against both.
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
  {
    type: "event",
    name: "StakeOpened",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unlockAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StakeWithdrawn",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StakeReclaimed",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "frozenAt", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StakeReleased",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StakeSlashed",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
      { name: "beneficiary", type: "address", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "StakeFrozen",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
    ],
  },
  {
    type: "event",
    name: "StakeUnfrozen",
    inputs: [
      { name: "target", type: "string", indexed: true },
      { name: "index", type: "uint256", indexed: true },
      { name: "staker", type: "address", indexed: true },
    ],
  },
] as const;

/** AttestationV2 stake lifecycle status, matching the contract's enum order. */
export const STAKE_STATUS = {
  Active: 0,
  Withdrawn: 1,
  Released: 2,
  Slashed: 3,
  Reclaimed: 4,
} as const;

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

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function parseAddress(value: string | undefined | null): `0x${string}` | null {
  const trimmed = value?.trim();
  if (!trimmed || !ADDRESS_RE.test(trimmed)) return null;
  return trimmed as `0x${string}`;
}

/** The contract new stakes are written to. */
export function getAttestationAddress(): `0x${string}` | null {
  return parseAddress(
    process.env.ATTESTATION_ADDRESS ?? process.env.NEXT_PUBLIC_ATTESTATION_ADDRESS,
  );
}

/**
 * Superseded contracts kept for read-only history.
 *
 * Attestation v1 has no exit path of any kind, so its stakes are frozen there
 * permanently — but the claims they represent are still real and must keep
 * rendering after the cutover to v2. Comma-separated so a future v3 needs no
 * code change.
 */
export function getHistoricalAttestationAddresses(): `0x${string}`[] {
  const raw = process.env.ATTESTATION_V1_ADDRESS ?? "";
  const current = getAttestationAddress()?.toLowerCase() ?? null;

  const out: `0x${string}`[] = [];
  const seen = new Set<string>(current ? [current] : []);

  for (const part of raw.split(",")) {
    const address = parseAddress(part);
    if (!address) continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

/** Every contract the claims index should read: current first, then history. */
export function getIndexedAttestationAddresses(): `0x${string}`[] {
  const current = getAttestationAddress();
  return current
    ? [current, ...getHistoricalAttestationAddresses()]
    : getHistoricalAttestationAddresses();
}

/**
 * Deploy block for a historical contract, so its backfill does not rescan from
 * genesis. Falls back to 0 only when unset — a wrong-but-early block is slow,
 * a wrong-but-late block silently loses history.
 */
export function historicalDeployBlock(): bigint {
  const raw = process.env.ATTESTATION_V1_DEPLOY_BLOCK?.trim();
  if (raw && /^\d+$/.test(raw)) return BigInt(raw);
  return BigInt(0);
}