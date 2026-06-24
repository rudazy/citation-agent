"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { GatewayWithdrawDialog } from "@/components/gateway/gateway-withdraw-dialog";
import { BanknoteArrowDown } from "lucide-react";
import {
  fetchAgentWalletStatus,
  getConnectedAccount,
  switchToArcTestnet,
  type AgentWalletStatusResponse,
} from "@/lib/attestation-client";
import { getWalletUsdcBalance } from "@/lib/gateway-metamask";
import type { EthereumProvider } from "@/lib/ethereum-provider";
import "@/lib/ethereum-provider";

type GatewaySource = "agent" | "metamask";

export function TopBarGatewayControls() {
  const [wallet, setWallet] = useState<AgentWalletStatusResponse | null>(null);

  const [metamaskAvailable, setMetamaskAvailable] = useState(false);
  const [metamaskAccount, setMetamaskAccount] = useState<`0x${string}` | null>(null);
  const [metamaskGateway, setMetamaskGateway] = useState("0");
  const [metamaskWalletUsdc, setMetamaskWalletUsdc] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [source, setSource] = useState<GatewaySource>("metamask");

  const fetchBalances = useCallback(async () => {
    try {
      const next = await fetchAgentWalletStatus();
      setWallet(next);
    } catch {
      setWallet(null);
    }
  }, []);

  const fetchMetamaskBalances = useCallback(async (account: `0x${string}`) => {
    try {
      const [walletUsdc, gatewayRes] = await Promise.all([
        getWalletUsdcBalance(account),
        fetch(`/api/marketplace/gateway-balance?address=${account}`),
      ]);
      setMetamaskWalletUsdc(walletUsdc);
      if (gatewayRes.ok) {
        const data = (await gatewayRes.json()) as { gateway_usdc?: string };
        setMetamaskGateway(data.gateway_usdc ?? "0");
      } else {
        setMetamaskGateway("0");
      }
    } catch {
      setMetamaskWalletUsdc(null);
      setMetamaskGateway("0");
    }
  }, []);

  const syncMetamaskAccount = useCallback(async () => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) {
      setMetamaskAccount(null);
      return;
    }
    try {
      const accounts = (await ethereum.request({ method: "eth_accounts" })) as string[];
      const first = accounts[0];
      if (first && /^0x[a-fA-F0-9]{40}$/.test(first)) {
        const account = first as `0x${string}`;
        setMetamaskAccount(account);
        await fetchMetamaskBalances(account);
      } else {
        setMetamaskAccount(null);
        setMetamaskGateway("0");
        setMetamaskWalletUsdc(null);
      }
    } catch {
      setMetamaskAccount(null);
    }
  }, [fetchMetamaskBalances]);

  useEffect(() => {
    setMetamaskAvailable(typeof window !== "undefined" && Boolean(window.ethereum));
    void fetchBalances();
    void syncMetamaskAccount();
  }, [fetchBalances, syncMetamaskAccount]);

  useEffect(() => {
    const ethereum = window.ethereum;
    if (!ethereum?.on) return;
    const onAccounts = () => void syncMetamaskAccount();
    ethereum.on("accountsChanged", onAccounts);
    return () => {
      ethereum.removeListener?.("accountsChanged", onAccounts);
    };
  }, [syncMetamaskAccount]);

  const connectMetamask = useCallback(async () => {
    const ethereum: EthereumProvider | undefined = window.ethereum;
    if (!ethereum) return;
    setConnecting(true);
    try {
      await switchToArcTestnet(ethereum);
      const account = await getConnectedAccount(ethereum);
      setMetamaskAccount(account);
      setSource("metamask");
      await fetchMetamaskBalances(account);
    } finally {
      setConnecting(false);
    }
  }, [fetchMetamaskBalances]);

  const hasAgentWallet = wallet?.configured === true && !!wallet.address;
  const agentAvailable = wallet?.gateway?.available ?? wallet?.gatewayUsdc ?? "0";

  const refreshAll = useCallback(() => {
    void fetchBalances();
    if (metamaskAccount) {
      void fetchMetamaskBalances(metamaskAccount);
    }
  }, [fetchBalances, fetchMetamaskBalances, metamaskAccount]);

  const handleOpen = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  return (
    <div className="flex items-center shrink-0">
      <GatewayWithdrawDialog
        role="agent"
        maxAvailable={agentAvailable}
        dualWallet={{
          source,
          onSourceChange: setSource,
          metamaskAvailable,
          metamaskConnected: Boolean(metamaskAccount),
          onConnectMetamask: connectMetamask,
          connectingMetamask: connecting,
          agent: {
            configured: hasAgentWallet,
            maxAvailable: agentAvailable,
            walletAddress: wallet?.address ?? undefined,
            nativeGas: wallet?.nativeGas ?? undefined,
            walletUsdc: wallet?.usdcBalance ?? undefined,
          },
          metamask: {
            maxAvailable: metamaskGateway,
            account: metamaskAccount,
            walletUsdc: metamaskWalletUsdc ?? undefined,
          },
        }}
        onOpen={handleOpen}
        onSuccess={refreshAll}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 border-[#f5c842]/35 text-[10px] sm:text-xs text-[#f5c842] hover:bg-[#f5c842]/10"
          >
            <BanknoteArrowDown size={12} />
            Withdraw
          </Button>
        }
      />
    </div>
  );
}