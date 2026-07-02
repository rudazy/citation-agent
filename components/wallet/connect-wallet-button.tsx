"use client";

import { Loader2, Wallet } from "lucide-react";
import { type ButtonHTMLAttributes, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { isWalletUiAvailable } from "@/lib/wallet-connection";
import { connectWalletInteractive } from "@/lib/wallet-connection-client";
import { cn } from "@/lib/utils";

type ConnectWalletButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
  connectedLabel?: string;
  connectedAddress?: string | null;
  onConnected?: (address: `0x${string}`) => void | Promise<void>;
  size?: "sm" | "default";
};

export function ConnectWalletButton({
  label = "Connect wallet",
  connectedLabel,
  connectedAddress,
  onConnected,
  size = "sm",
  className,
  disabled,
  ...props
}: ConnectWalletButtonProps) {
  const [connecting, setConnecting] = useState(false);

  const short =
    connectedAddress && connectedAddress.length >= 10
      ? `${connectedAddress.slice(0, 6)}…${connectedAddress.slice(-4)}`
      : null;

  const handleClick = async () => {
    if (!isWalletUiAvailable()) {
      toast.error("Wallet unavailable", {
        description: "Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID or install MetaMask.",
      });
      return;
    }

    setConnecting(true);
    try {
      const { address } = await connectWalletInteractive();
      await onConnected?.(address);
    } catch (err) {
      toast.error("Could not connect wallet", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={disabled || connecting}
      onClick={() => void handleClick()}
      className={cn(
        "border-[#333] font-mono text-[10px] text-[#ccc] hover:bg-[#141414]",
        className,
      )}
      {...props}
    >
      {connecting ? (
        <>
          <Loader2 size={12} className="animate-spin" />
          Connecting…
        </>
      ) : short ? (
        connectedLabel ?? `Connected ${short}`
      ) : (
        <>
          <Wallet size={12} />
          {label}
        </>
      )}
    </Button>
  );
}