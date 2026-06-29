"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Loader2, Wallet } from "lucide-react";
import { Panel } from "@/components/layout/panel";
import { AgentWalletPanel } from "@/components/agent/agent-wallet-panel";
import {
  depositToGatewayViaMetaMask,
  getWalletUsdcBalance,
} from "@/lib/gateway-metamask";
import {
  depositAgentGatewayViaApi,
  payViaAgentWallet,
} from "@/lib/gateway-pay";
import {
  fetchAgentWalletStatus,
  provisionAgentWallet,
  type AgentWalletStatusResponse,
} from "@/lib/attestation-client";
import { formatMarketplaceHelloMemo } from "@/lib/payment-memo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const ARC_TESTNET_HEX = "0x4cef52";
const ARC_TESTNET = {
  chainId: ARC_TESTNET_HEX,
  chainName: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.testnet.arc.network"],
  blockExplorerUrls: ["https://testnet.arcscan.app"],
};

import type { EthereumProvider } from "@/lib/ethereum-provider";
import "@/lib/ethereum-provider";

type WalletMode = "agent" | "connected";

export function MarketplaceBuyer({
  onSettlement,
}: {
  onSettlement?: (settlementId: string) => void;
}) {
  const [walletMode, setWalletMode] = useState<WalletMode>("agent");
  const [account, setAccount] = useState<string | null>(null);
  const [status, setStatus] = useState("agent wallet");
  const [busy, setBusy] = useState(false);
  const [funding, setFunding] = useState(false);
  const [walletUsdc, setWalletUsdc] = useState<string | null>(null);
  const [gatewayUsdc, setGatewayUsdc] = useState<string | null>(null);
  const [output, setOutput] = useState("—");
  const [agentWallet, setAgentWallet] = useState<AgentWalletStatusResponse | null>(null);
  const [agentWalletLoading, setAgentWalletLoading] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentSetupResetKey, setAgentSetupResetKey] = useState(0);
  const [agentSetupActive, setAgentSetupActive] = useState(false);

  const PAY_AMOUNT = 0.01;
  const gatewayBalance =
    walletMode === "agent"
      ? agentWallet?.gatewayUsdc !== null && agentWallet?.gatewayUsdc !== undefined
        ? Number(agentWallet.gatewayUsdc)
        : null
      : gatewayUsdc !== null
        ? Number(gatewayUsdc)
        : null;
  const gatewayReady =
    gatewayBalance !== null && !Number.isNaN(gatewayBalance) && gatewayBalance >= PAY_AMOUNT;

  const refreshAgentWallet = useCallback(async () => {
    setAgentWalletLoading(true);
    try {
      const result = await fetchAgentWalletStatus();
      setAgentWallet(result);
      if (walletMode === "agent") {
        setStatus(result.configured ? "agent wallet ready" : "configure agent wallet");
      }
    } catch {
      setAgentWallet(null);
      if (walletMode === "agent") setStatus("agent wallet unavailable");
    } finally {
      setAgentWalletLoading(false);
    }
  }, [walletMode]);

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
    void refreshAgentWallet();
  }, [refreshAgentWallet]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on || walletMode !== "connected") return;

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
  }, [refreshBalances, walletMode]);

  const handleCreateAgentWallet = async (recoveryWallet?: string) => {
    setCreatingAgent(true);
    try {
      const result = await provisionAgentWallet({ recoveryWallet });
      setAgentWallet(result);
      toast.success("Agent wallet created", {
        description: "Copy the address and fund it on the Circle faucet.",
      });
    } catch (err) {
      toast.error("Could not create agent wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setCreatingAgent(false);
    }
  };

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
    setFunding(true);
    try {
      if (walletMode === "agent") {
        setStatus("depositing to Gateway (agent)…");
        const result = await depositAgentGatewayViaApi();
        setOutput(JSON.stringify(result, null, 2));
        await refreshAgentWallet();
        setStatus("Gateway funded for agent wallet");
        toast.success("Gateway deposit complete", {
          description: `Available: $${result.gatewayAvailable} USDC`,
        });
        return;
      }

      const ethereum = window.ethereum;
      if (!account || !ethereum) return;
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
      toast.error("Gateway deposit failed", {
        description: (e as Error).message ?? String(e),
      });
    } finally {
      setFunding(false);
    }
  }, [account, switchToArc, refreshBalances, refreshAgentWallet, walletMode]);

  const payWithAgent = useCallback(async () => {
    setBusy(true);
    setOutput("—");
    try {
      setStatus("paying via agent wallet…");
      const result = await payViaAgentWallet({
        path: "/api/marketplace/hello",
        method: "GET",
        memo: formatMarketplaceHelloMemo(),
      });
      setOutput(JSON.stringify(result, null, 2));
      setStatus("paid — hello received");
      await refreshAgentWallet();
      const sid =
        result.data &&
        typeof result.data === "object" &&
        "settlement_id" in result.data
          ? String((result.data as { settlement_id: string }).settlement_id)
          : result.settlementId;
      if (sid) onSettlement?.(sid);
      toast.success("Payment settled", {
        description: `${result.formattedAmount} USDC via agent wallet`,
      });
    } catch (e) {
      setStatus("error");
      setOutput(String((e as Error).message ?? e));
      toast.error("Agent payment failed", {
        description: (e as Error).message ?? String(e),
      });
    } finally {
      setBusy(false);
    }
  }, [onSettlement, refreshAgentWallet]);

  const payWithMetaMask = useCallback(async () => {
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

      const b64decode = (s: string) => decodeURIComponent(escape(atob(s)));
      const b64encode = (obj: unknown) =>
        btoa(unescape(encodeURIComponent(JSON.stringify(obj))));

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
      const nonce = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((x) => x.toString(16).padStart(2, "0"))
        .join("")}` as `0x${string}`;

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
          "X-Payment-Memo": formatMarketplaceHelloMemo(),
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

  const pay = walletMode === "agent" ? payWithAgent : payWithMetaMask;

  const agentWalletReady = walletMode !== "agent" || agentWallet?.configured === true;
  const agentPaymentReady =
    walletMode !== "agent" || (agentWallet?.paymentReady === true && !agentWallet?.configError);
  const canPayAgent =
    walletMode === "agent" && agentWalletReady && agentPaymentReady && !agentWalletLoading;
  const canPayConnected = walletMode === "connected" && !!account && gatewayReady;
  const canPay = walletMode === "agent" ? canPayAgent : canPayConnected;
  const canFund =
    walletMode === "agent"
      ? agentWalletReady && !agentWalletLoading
      : !!account;

  return (
    <Panel glow className="space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#ff8a3d]/30 bg-[#ff8a3d]/10">
          <Wallet size={18} className="text-[#ff8a3d]" />
        </div>
        <div className="min-w-0 space-y-1">
          <h2 className="text-lg font-semibold tracking-wide">Agent buys research</h2>
          <p className="text-xs sm:text-sm text-muted-foreground font-mono leading-relaxed">
            Same catalog as humans — different payer. Fund the agent wallet, deposit to Circle
            Gateway, then unlock reports without a wallet popup. Run the hello-world x402 demo below
            to trace a payment end-to-end.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">Pay with</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || funding}
            onClick={() => {
              if (walletMode === "agent" && agentSetupActive) {
                setAgentSetupResetKey((key) => key + 1);
                return;
              }
              setWalletMode("agent");
              void refreshAgentWallet();
              setStatus("agent wallet");
            }}
            className={cn(
              "relative rounded border px-3 py-3 text-left transition-colors touch-manipulation",
              walletMode === "agent"
                ? "border-[#f5c842]/55 bg-[#f5c842]/10 ring-1 ring-[#f5c842]/20"
                : "border-[#2a2a2a] bg-[#111] hover:border-[#444]",
            )}
          >
            <Badge className="absolute -top-2 right-2 bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30 hover:bg-[#f5c842]/15 text-[9px] px-1.5 py-0">
              Default
            </Badge>
            <div className="flex items-center gap-2">
              <Bot size={14} className="text-[#f5c842]" />
              <span className="text-sm font-medium">Agent wallet</span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-[#666]">
              {walletMode === "agent" && agentSetupActive
                ? "Tap again to go back"
                : "Your wallet on Arc"}
            </p>
          </button>
          <button
            type="button"
            disabled={busy || funding}
            onClick={() => {
              setWalletMode("connected");
              setStatus(account ? "ready on Arc Testnet" : "not connected");
            }}
            className={cn(
              "rounded border px-3 py-3 text-left transition-colors touch-manipulation",
              walletMode === "connected"
                ? "border-[#ff8a3d]/40 bg-[#ff8a3d]/8"
                : "border-[#2a2a2a] bg-[#111] hover:border-[#444]",
            )}
          >
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-[#ff8a3d]" />
              <span className="text-sm font-medium">MetaMask</span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-[#666]">Connected wallet override</p>
          </button>
        </div>
      </div>

      {walletMode === "agent" && (
        <AgentWalletPanel
          wallet={agentWallet}
          loading={agentWalletLoading}
          creating={creatingAgent}
          busy={busy || funding}
          onRefresh={() => void refreshAgentWallet()}
          onCreate={(recoveryWallet) => void handleCreateAgentWallet(recoveryWallet)}
          onRecovered={() => void refreshAgentWallet()}
          minUsdc={PAY_AMOUNT}
          showGatewayBalance
          showWithdraw
          setupResetKey={agentSetupResetKey}
          onSetupActiveChange={setAgentSetupActive}
        />
      )}

      {walletMode === "connected" && account && walletUsdc !== null && gatewayUsdc !== null && (
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

      {walletMode === "connected" && (
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
      )}

      {walletMode === "connected" && account && walletUsdc !== null && gatewayUsdc !== null && (
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

      {walletMode === "agent" && agentWallet?.configError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive leading-relaxed">
          {agentWallet.configError}
        </p>
      )}

      {walletMode === "agent" && (
        <span className="block text-xs text-muted-foreground font-mono">{status}</span>
      )}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={fundGateway}
          disabled={funding || busy || !canFund}
        >
          {funding ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deposit 1 USDC to Gateway"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() =>
            walletMode === "agent"
              ? void refreshAgentWallet()
              : account && void refreshBalances(account)
          }
          disabled={funding || busy || (walletMode === "connected" && !account)}
        >
          Refresh balances
        </Button>
      </div>
      <Button
        size="sm"
        className="w-full bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90 font-semibold"
        onClick={pay}
        disabled={!canPay || busy || funding}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay $0.01 and call /hello"}
      </Button>
      <pre className="max-h-48 overflow-auto rounded-md border border-border/60 bg-[#0a0a0a]/80 p-3 font-mono text-[11px] leading-relaxed">
        {output}
      </pre>
    </Panel>
  );
}