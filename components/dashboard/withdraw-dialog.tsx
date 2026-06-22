"use client";

import { GatewayWithdrawDialog } from "@/components/gateway/gateway-withdraw-dialog";

interface WithdrawDialogProps {
  maxAvailable: string;
  walletAddress?: string | null;
  nativeGas?: string | null;
  walletUsdc?: string | null;
  sellerKeyConfigured?: boolean;
  onWithdraw: () => void;
}

export function WithdrawDialog({
  maxAvailable,
  walletAddress,
  nativeGas,
  walletUsdc,
  sellerKeyConfigured = true,
  onWithdraw,
}: WithdrawDialogProps) {
  return (
    <GatewayWithdrawDialog
      role="seller"
      maxAvailable={maxAvailable}
      walletAddress={walletAddress}
      nativeGas={nativeGas}
      walletUsdc={walletUsdc}
      sellerKeyConfigured={sellerKeyConfigured}
      onSuccess={onWithdraw}
    />
  );
}