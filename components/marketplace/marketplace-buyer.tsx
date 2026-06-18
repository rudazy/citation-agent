"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

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
  const [output, setOutput] = useState("—");

  const ensureArcTestnet = useCallback(async () => {
    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("MetaMask not detected");
    const current = (await ethereum.request({ method: "eth_chainId" })) as string;
    if (current === ARC_TESTNET_HEX) return;
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_TESTNET_HEX }],
      });
    } catch (e) {
      const err = e as { code?: number };
      if (err.code === 4902) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARC_TESTNET],
        });
      } else {
        throw e;
      }
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const ethereum = window.ethereum;
      if (!ethereum) {
        setStatus("MetaMask not detected");
        return;
      }
      const accounts = (await ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAccount(accounts[0]);
      await ensureArcTestnet();
      setStatus("ready");
    } catch (e) {
      setStatus(String((e as Error).message ?? e));
    }
  }, [ensureArcTestnet]);

  const pay = useCallback(async () => {
    if (!account || !window.ethereum) return;
    setBusy(true);
    setOutput("—");
    try {
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
        headers: { "payment-signature": b64encode(paymentPayload) },
      });
      const body = await r2.json().catch(async () => await r2.text());
      setOutput(JSON.stringify({ status: r2.status, body }, null, 2));

      if (r2.ok) {
        setStatus("paid");
        const sid =
          typeof body === "object" && body && "settlement_id" in body
            ? String((body as { settlement_id: string }).settlement_id)
            : null;
        if (sid) onSettlement?.(sid);
      } else {
        setStatus(`server returned ${r2.status}`);
      }
    } catch (e) {
      setStatus("error");
      setOutput(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }, [account, onSettlement]);

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold tracking-wide">Live demo</h2>
        <p className="text-sm text-muted-foreground">
          Pay $0.01 USDC for <code>/api/marketplace/hello</code> via MetaMask on Arc Testnet.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={connect}>
          Connect MetaMask
        </Button>
        <Badge variant={account ? "default" : "secondary"} className="font-mono text-xs">
          {account ?? "not connected"}
        </Badge>
        <span className="text-xs text-muted-foreground">{status}</span>
      </div>
      <Button size="sm" onClick={pay} disabled={!account || busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay $0.01 and call /hello"}
      </Button>
      <pre className="overflow-auto rounded border bg-muted/40 p-3 font-mono text-xs">
        {output}
      </pre>
    </div>
  );
}