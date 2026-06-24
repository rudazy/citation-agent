import {
  encodeFunctionData,
  maxUint256,
  pad,
  parseUnits,
  zeroAddress,
  type Hex,
} from "viem";
import { fetchGatewayBalanceSnapshot } from "@/lib/gateway-balances";
import { getWalletUsdcBalance } from "@/lib/gateway-metamask";
import type { EthereumProvider } from "@/lib/ethereum-provider";

const GATEWAY_API = "https://gateway-api-testnet.circle.com/v1";
const ARC_DOMAIN = 26;
const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;
const GATEWAY_WALLET = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9" as const;
const GATEWAY_MINTER = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B" as const;

const GATEWAY_MINTER_ABI = [
  {
    name: "gatewayMint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "attestationPayload", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

type BurnIntentMessage = {
  maxBlockHeight: string;
  maxFee: string;
  spec: {
    version: number;
    sourceDomain: number;
    destinationDomain: number;
    sourceContract: Hex;
    destinationContract: Hex;
    sourceToken: Hex;
    destinationToken: Hex;
    sourceDepositor: Hex;
    destinationRecipient: Hex;
    sourceSigner: Hex;
    destinationCaller: Hex;
    value: string;
    salt: Hex;
    hookData: Hex;
  };
};

function addressToBytes32(addr: string): Hex {
  return pad(addr.toLowerCase() as Hex, { size: 32 });
}

function randomSalt(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

function createArcWithdrawBurnIntent(
  account: `0x${string}`,
  amount: bigint,
  recipient: `0x${string}`,
  maxFee: bigint,
): BurnIntentMessage {
  return {
    maxBlockHeight: maxUint256.toString(),
    maxFee: maxFee.toString(),
    spec: {
      version: 1,
      sourceDomain: ARC_DOMAIN,
      destinationDomain: ARC_DOMAIN,
      sourceContract: addressToBytes32(GATEWAY_WALLET),
      destinationContract: addressToBytes32(GATEWAY_MINTER),
      sourceToken: addressToBytes32(ARC_USDC),
      destinationToken: addressToBytes32(ARC_USDC),
      sourceDepositor: addressToBytes32(account),
      destinationRecipient: addressToBytes32(recipient),
      sourceSigner: addressToBytes32(account),
      destinationCaller: addressToBytes32(zeroAddress),
      value: amount.toString(),
      salt: randomSalt(),
      hookData: "0x",
    },
  };
}

async function waitForReceipt(
  ethereum: EthereumProvider,
  hash: string,
  timeoutMs = 120_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const receipt = (await ethereum.request({
      method: "eth_getTransactionReceipt",
      params: [hash],
    })) as { status?: string } | null;
    if (receipt) {
      if (receipt.status === "0x0") {
        throw new Error(`Transaction reverted: ${hash}`);
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Transaction confirmation timed out: ${hash}`);
}

/** Pull creator unlock earnings from Circle Gateway into wallet USDC on Arc (MetaMask-signed). */
export async function withdrawGatewayViaMetaMask(
  ethereum: EthereumProvider,
  account: `0x${string}`,
  amount: string,
  recipient?: `0x${string}`,
): Promise<{ mintTxHash: string; amount: string }> {
  const withdrawAmount = parseUnits(amount, 6);
  const maxFee = parseUnits("2.01", 6);
  const dest = recipient ?? account;

  const walletUsdc = await getWalletUsdcBalance(account);
  const snapshot = await fetchGatewayBalanceSnapshot(account, walletUsdc);
  const available = parseUnits(snapshot.gateway.available || "0", 6);
  if (available < withdrawAmount) {
    throw new Error(
      `Insufficient Gateway balance. Have ${snapshot.gateway.available} USDC, need ${amount}`,
    );
  }

  const message = createArcWithdrawBurnIntent(account, withdrawAmount, dest, maxFee);
  const typedData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      TransferSpec: [
        { name: "version", type: "uint32" },
        { name: "sourceDomain", type: "uint32" },
        { name: "destinationDomain", type: "uint32" },
        { name: "sourceContract", type: "bytes32" },
        { name: "destinationContract", type: "bytes32" },
        { name: "sourceToken", type: "bytes32" },
        { name: "destinationToken", type: "bytes32" },
        { name: "sourceDepositor", type: "bytes32" },
        { name: "destinationRecipient", type: "bytes32" },
        { name: "sourceSigner", type: "bytes32" },
        { name: "destinationCaller", type: "bytes32" },
        { name: "value", type: "uint256" },
        { name: "salt", type: "bytes32" },
        { name: "hookData", type: "bytes" },
      ],
      BurnIntent: [
        { name: "maxBlockHeight", type: "uint256" },
        { name: "maxFee", type: "uint256" },
        { name: "spec", type: "TransferSpec" },
      ],
    },
    primaryType: "BurnIntent",
    domain: { name: "GatewayWallet", version: "1" },
    message,
  };

  const signature = (await ethereum.request({
    method: "eth_signTypedData_v4",
    params: [account, JSON.stringify(typedData)],
  })) as Hex;

  const transferBody = [
    {
      burnIntent: {
        maxBlockHeight: message.maxBlockHeight,
        maxFee: message.maxFee,
        spec: message.spec,
      },
      signature,
    },
  ];

  const transferRes = await fetch(`${GATEWAY_API}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(transferBody),
  });
  const transferJson = (await transferRes.json()) as {
    success?: boolean;
    error?: string;
    message?: string;
    attestation?: Hex;
    signature?: Hex;
  };

  if (
    !transferRes.ok ||
    transferJson.success === false ||
    transferJson.error ||
    !transferJson.attestation ||
    !transferJson.signature
  ) {
    throw new Error(
      transferJson.message ||
        transferJson.error ||
        `Gateway transfer failed (${transferRes.status})`,
    );
  }

  const mintData = encodeFunctionData({
    abi: GATEWAY_MINTER_ABI,
    functionName: "gatewayMint",
    args: [transferJson.attestation, transferJson.signature],
  });

  const mintTxHash = (await ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from: account, to: GATEWAY_MINTER, data: mintData, gas: "0x7a120" }],
  })) as string;

  await waitForReceipt(ethereum, mintTxHash);

  return { mintTxHash, amount };
}