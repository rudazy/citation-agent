import { GatewayClient } from "@circle-fin/x402-batching/client";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  http,
  parseEther,
  parseUnits,
} from "viem";
import { arcTestnet } from "viem/chains";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { ensureCanteenRoyaltyReserve } from "./canteen-payout.mts";
import { searchCreatorContent, splitRoyalty, type CreatorContent } from "./citations.ts";
import { formatUnits } from "viem";
import { CANTEEN_USDC_ABI, getCanteenUsdcAddress } from "./canteen-usdc.ts";

const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000" as const;
const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const DEPOSIT_AMOUNT = process.env.DEPOSIT_AMOUNT ?? "1";
const GAS_FUND_AMOUNT = parseEther("0.01");

type CitationMatch = CreatorContent & { endpoint: string };

function buildCitationEndpoint(id: string, query: string): string {
  return `/api/marketplace/citations?id=${id}&query=${encodeURIComponent(query)}`;
}

async function fetchPaidContent(
  gateway: GatewayClient,
  citation: CitationMatch,
) {
  const fullUrl = `${BASE_URL}${citation.endpoint}`;
  console.log(`Fetching paid content from: ${fullUrl}`);

  const result = await gateway.pay<{
    citation?: { body?: string; title?: string; author?: string };
  }>(fullUrl, { method: "GET" });

  if (!result.data?.citation?.body) {
    throw new Error("Fetch failed: missing citation body in response");
  }

  return result;
}

async function withNonceRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const MAX_RETRIES = 5;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = (err as Error).message ?? "";
      const isNonceError =
        msg.includes("replacement transaction underpriced") ||
        msg.includes("nonce too low") ||
        msg.includes("already known");
      if (!isNonceError || attempt === MAX_RETRIES - 1) throw err;
      const delay = 1000 + Math.random() * 2000;
      console.log(`  ${label}: nonce collision, retrying in ${Math.round(delay)}ms...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error("unreachable");
}

export async function runResearchQuery(query: string) {
  const funderKey = process.env.BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!funderKey) {
    console.error("Missing BUYER_PRIVATE_KEY. Run `npm run generate-wallets` first.");
    process.exit(1);
  }

  const matches = searchCreatorContent(query, 3);
  if (matches.length === 0) {
    console.log("No matching citations found for query:", query);
    return;
  }

  console.log(`\nResearch query: "${query}"`);
  console.log(`Matched ${matches.length} citation(s):\n`);
  for (const item of matches) {
    console.log(`  - ${item.title} by ${item.author} ($${item.priceUsdc} USDC)`);
  }

  const ephemeralKey = generatePrivateKey();
  const ephemeralAccount = privateKeyToAccount(ephemeralKey);
  const funderAccount = privateKeyToAccount(funderKey);

  const publicClient = createPublicClient({
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });
  const funderWallet = createWalletClient({
    account: funderAccount,
    chain: arcTestnet,
    transport: http(ARC_TESTNET_RPC),
  });

  console.log(`\nFunding ephemeral wallet ${ephemeralAccount.address}...`);
  const usdcAmount = parseUnits(DEPOSIT_AMOUNT, 6);

  const gasTxHash = await withNonceRetry(
    () =>
      funderWallet.sendTransaction({
        to: ephemeralAccount.address,
        value: GAS_FUND_AMOUNT,
      }),
    "Gas tx",
  );
  await publicClient.waitForTransactionReceipt({ hash: gasTxHash });

  const usdcTxHash = await withNonceRetry(
    () =>
      funderWallet.writeContract({
        address: ARC_TESTNET_USDC,
        abi: erc20Abi,
        functionName: "transfer",
        args: [ephemeralAccount.address, usdcAmount],
      }),
    "USDC tx",
  );
  await publicClient.waitForTransactionReceipt({ hash: usdcTxHash });

  const gateway = new GatewayClient({
    chain: "arcTestnet",
    privateKey: ephemeralKey,
  });

  console.log(`Depositing ${DEPOSIT_AMOUNT} USDC into Gateway...`);
  await gateway.deposit(DEPOSIT_AMOUNT);

  const paidCitations: Array<{
    id: string;
    title: string;
    author: string;
    excerpt: string;
    amount: string;
    royalty: string;
  }> = [];

  let totalSpent = 0;

  for (const item of matches) {
    const citation: CitationMatch = {
      ...item,
      endpoint: buildCitationEndpoint(item.id, query),
    };
    const start = Date.now();

    try {
      const result = await fetchPaidContent(gateway, citation);
      const amount = parseFloat(result.formattedAmount);
      totalSpent += amount;
      const { creatorAmount } = splitRoyalty(item.priceUsdc);

      paidCitations.push({
        id: item.id,
        title: result.data?.citation?.title ?? item.title,
        author: result.data?.citation?.author ?? item.author,
        excerpt:
          result.data?.citation?.body?.split("\n\n")[0] ?? item.excerpt,
        amount: result.formattedAmount,
        royalty: creatorAmount,
      });

      console.log(
        `  Paid ${item.id} -> ${result.formattedAmount} USDC (${Date.now() - start}ms)`,
      );
    } catch (err) {
      console.error(`  Failed ${item.id}:`, (err as Error).message);
    }
  }

  console.log("\n--- Research Synthesis ---\n");
  for (const cite of paidCitations) {
    console.log(`[${cite.author}] ${cite.title}`);
    console.log(`  ${cite.excerpt}`);
    console.log(`  Paid: $${cite.amount} USDC | Creator royalty: $${cite.royalty}\n`);
  }

  console.log("--- Attribution Credits ---");
  for (const cite of paidCitations) {
    console.log(`  * "${cite.title}" — ${cite.author} (citation:${cite.id})`);
  }

  console.log(`\nTotal spent: ${totalSpent.toFixed(6)} USDC across ${paidCitations.length} citation(s)`);

  const totalCreatorRoyalties = paidCitations
    .reduce((sum, cite) => sum + parseFloat(cite.royalty), 0)
    .toFixed(6);

  if (paidCitations.length > 0 && totalCreatorRoyalties !== "0.000000") {
    try {
      const reserve = await ensureCanteenRoyaltyReserve(totalCreatorRoyalties, funderKey);
      if (reserve?.wrapped) {
        console.log(
          `\n[cUSDC] Wrapped ${reserve.royaltyUsdc} USDC for creator royalty reserve`,
        );
        console.log(`[cUSDC] Wrap tx: ${reserve.wrapTx}`);
      }

      const canteenAddress = getCanteenUsdcAddress();
      if (canteenAddress) {
        const cUsdcBalance = await publicClient.readContract({
          address: canteenAddress,
          abi: CANTEEN_USDC_ABI,
          functionName: "balanceOf",
          args: [funderAccount.address],
        });
        console.log(
          `[cUSDC] Agent royalty reserve: ${formatUnits(cUsdcBalance, 6)} cUSDC (${canteenAddress})`,
        );
      }
    } catch (err) {
      console.warn("[cUSDC] Royalty reserve skipped:", (err as Error).message);
    }
  }
}