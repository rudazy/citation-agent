"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wallet } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import {
  depositToGatewayViaMetaMask,
  getWalletUsdcBalance,
} from "@/lib/gateway-metamask";
import {
  formatMarketplaceHelloMemo,
  PAYMENT_MEMO_HEADER,
} from "@/lib/payment-memo";

const ARC_TESTNET_HEX = "0x4cef52";
const ARC_TESTNET = {
  chainId: ARC_TESTNET_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

function b64encode(obj: unknown): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
}

function b64decode(s: string): string {
  return decodeURIComponent(escape(atob(s)));
}

function randomNonceHex(): `0x${string}` {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return `0x${Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function MarketplaceBuyer({
  onSettlement,
}: {
  onSettlement?: (settlementId: string) => void;
}) {
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState("not connected");
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [walletUsdc, setWalletUsdc] = useState<string | null>(null);
  const [gatewayUsdc, setGatewayUsdc] = useState<string | null>(null);
  const [output, setOutput] = useState("—");

  const PAY_AMOUNT = 0.01;
  const gatewayBalance = gatewayUsdc !== null ? Number(gatewayUsdc) : null;
  const gatewayReady =
    gatewayBalance !== null && !Number.isNaN(gatewayBalance) && gatewayBalance >= PAY_AMOUNT;

  const refreshBalances = useCallback(async (addr: string) => {
    try {
      const [wallet, gatewayRes] = await Promise.all([
        getWalletUsdcBalance(addr as `0x${string}`),
        fetch(`/api/marketplace/gateway-balance?address=${addr}`),
      ]);
      setWalletUsdc(wallet);
      if (gatewayRes.ok) {
        const data = (await gatewayRes.json()) as { gateway_usdc?: string };
        setGatewayUsdc(data.gateway_usdc ?? "0");
      } else {
        setGatewayUsdc(null);
      }
    } catch {
      setWalletUsdc(null);
      setGatewayUsdc(null);
    }
  }, []);

  const switchToArc = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("MetaMask not detected");

    const current = (await ethereum.request({ method: "eth_chainId" })) as string;
    if (current.toLowerCase() === ARC_TESTNET_HEX) return;

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_HEX }],
      });
    } catch (switchError) {
      const err = switchError as { code?: number };
      if (err.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
        return;
      }
      throw switchError;
    }
  }, []);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;

    const onChainChanged = (...args: unknown[]) => {
      const chainId = String(args[0] ?? "");
      if (chainId.toLowerCase() === ARC_TESTNET_HEX) {
        setStatus("ready on Arc Testnet");
      } else {
        setStatus("wrong network — switch to Arc Testnet");
      }
    };

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = args[0] as string[] | undefined;
      const next = accounts?.[0] ?? null;
      setAccount(next);
      if (next) {
        void refreshBalances(next);
        setStatus("ready on Arc Testnet");
      } else {
        setWalletUsdc(null);
        setGatewayUsdc(null);
        setStatus("not connected");
      }
    };

    ethereum.on?.("chainChanged", onChainChanged);
    ethereum.on?.("accountsChanged", onAccountsChanged);
    return () => {
      ethereum.removeListener?.("chainChanged", onChainChanged);
      ethereum.removeListener?.("accountsChanged", onAccountsChanged);
    };
  }, [refreshBalances]);

  const connect = useCallback(async () => {
    try {
      const ethereum = window.ethereum;
      if (!ethereum) {
        setStatus("MetaMask not detected");
        return;
      }
      setStatus("connecting…");
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAccount(accounts[0]);
      setStatus("switching to Arc Testnet…");
      await switchToArc();
      await refreshBalances(accounts[0]);
      setStatus("ready on Arc Testnet");
    } catch (e) {
      setStatus(String((e as Error).message ?? e));
    }
  }, [switchToArc, refreshBalances]);

  const fundGateway = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!account || !ethereum) return;
    setFunding(true);
    try {
      setStatus("switching to Arc Testnet…");
      await switchToArc();
      setStatus("approve + deposit to Gateway (MetaMask)…");
      const result = await depositToGatewayViaMetaMask(
        ethereum,
        account as `0x${string}`,
        "1",
      );
      setOutput(JSON.stringify(result, null, 2));
      await refreshBalances(account);
      setStatus("Gateway funded for connected wallet");
    } catch (e) {
      setStatus("fund failed");
      setOutput(String((e as Error).message ?? e));
    } finally {
      setFunding(false);
    }
  }, [account, switchToArc, refreshBalances]);

  const pay = useCallback(async () => {
    if (!account || !window.ethereum) return;
    setBusy(true);
    setOutput("—");
    try {
      setStatus("switching to Arc Testnet…");
      await switchToArc();
      setStatus("fetching 402 challenge…");
      const r1 = await fetch("/api/marketplace/hello");
      if (r1.status !== 402) {
        setStatus(`unexpected ${r1.status}`);
        setOutput(await r1.text());
        return;
      }

      const challenge = JSON.parse(
        b64decode(r1.headers.get("PAYMENT-REQUIRED") ?? ""),
      ) as {
        accepts: Array<{
          network: string;
          payTo: string;
          amount: string;
          maxTimeoutSeconds: number;
          extra: { verifyingContract: string };
        }>;
        resource: unknown;
      };
      const accepted = challenge.accepts[0];
      const chainId = parseInt(accepted.network.split(":")[1], 10);
      const now = Math.floor(Date.now() / 1000);
      const validBefore = (
        now + Math.max(accepted.maxTimeoutSeconds, 7 * 24 * 3600 + 600)
      ).toString();
      const validAfter = (now - 600).toString();
      const nonce = randomNonceHex();

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

      setStatus("waiting for MetaMask signature…");
      const signature = (await window.ethereum.request({
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

      setStatus("settling via facilitator…");
      const r2 = await fetch("/api/marketplace/hello", {
        headers: {
          "payment-signature": b64encode(paymentPayload),
          [PAYMENT_MEMO_HEADER]: formatMarketplaceHelloMemo(),
        },
      });
      const body = await r2.json().catch(async () => await r2.text());
      setOutput(JSON.stringify({ status: r2.status, body }, null, 2));

      if (r2.ok) {
        setStatus("paid — hello received");
        await refreshBalances(account);
        const sid =
          typeof body === "object" && body && "settlement_id" in body
            ? String((body as { settlement_id: string }).settlement_id)
            : null;
        if (sid) onSettlement?.(sid);
      } else {
        const reason =
          typeof body === "object" && body && "reason" in body
            ? String((body as { reason: string }).reason)
            : null;
        setStatus(reason ? `payment failed: ${reason}` : `server returned ${r2.status}`);
      }
    } catch (e) {
      setStatus("error");
      setOutput(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }, [account, onSettlement, switchToArc, refreshBalances]);

  return (
    <Panel glow className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#ff8a3d]/30 bg-[#ff8a3d]/10">
          <Wallet size={18} className="text-[#ff8a3d]" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-wide">Live demo</h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
            Pay $0.01 USDC for <code className="text-[#ff8a3d]/90">/api/marketplace/hello</code> via
            MetaMask. x402 draws from Gateway balance — deposit first if Gateway is $0.
          </p>
        </div>
      </div>

      {account && walletUsdc !== null && gatewayUsdc !== null && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border/60 bg-[#141414]/80 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Wallet</p>
            <p className="font-mono text-sm font-semibold tabular-nums">${walletUsdc}</p>
          </div>
          <div className="rounded-md border border-[#ff8a3d]/20 bg-[#ff8a3d]/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Gateway</p>
            <p className="font-mono text-sm font-semibold tabular-nums text-[#ff8a3d]">${gatewayUsdc}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={connect}>
          Connect MetaMask
        </Button>
        <Badge
          variant={account ? "default" : "secondary"}
          className="font-mono text-xs w-full sm:w-auto justify-center truncate max-w-full"
        >
          {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "not connected"}
        </Badge>
        <span className="text-xs text-muted-foreground font-mono text-center sm:text-left">{status}</span>
      </div>

      {account && walletUsdc !== null && gatewayUsdc !== null && (
        <div className="space-y-2">
          {Number(walletUsdc) > 0 && !gatewayReady && (
            <p className="rounded-md border border-[#ff8a3d]/40 bg-[#ff8a3d]/10 px-3 py-2 text-xs font-mono text-[#ff8a3d] leading-relaxed">
              Wallet has ${walletUsdc} but Gateway has ${gatewayUsdc}. Deposit to Gateway before paying.
            </p>
          )}
          {gatewayUsdc !== null && !gatewayReady && Number(walletUsdc) <= 0 && (
            <p className="rounded-md border border-[#ff8a3d]/40 bg-[#ff8a3d]/10 px-3 py-2 text-xs font-mono text-[#ff8a3d] leading-relaxed">
              Gateway balance is ${gatewayUsdc}. Fund on Arc testnet, then deposit at least $
              {PAY_AMOUNT.toFixed(2)}.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={fundGateway}
          disabled={funding || busy || !account}
        >
          {funding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deposit 1 USDC to Gateway"}
        </Button>
        {account && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => refreshBalances(account)}
            disabled={funding || busy}
          >
            Refresh balances
          </Button>
        )}
      </div>
      <Button
        size="sm"
        className="w-full bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90 font-semibold"
        onClick={pay}
        disabled={!account || busy || funding || !gatewayReady}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay $0.01 and call /hello"}
      </Button>
      <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-[#0a0a0a]/80 p-3 font-mono text-[11px] leading-relaxed">
        {output}
      </pre>
    </Panel>
  );
}