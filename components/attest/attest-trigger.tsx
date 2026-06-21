"use client";

import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AttestTriggerProps {
  target: string;
  onAttest: (target: string) => void;
  label?: string;
  size?: "sm" | "default" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
  showIcon?: boolean;
}

export function AttestTrigger({
  target,
  onAttest,
  label = "Attest",
  size = "sm",
  variant = "outline",
  className,
  showIcon = true,
}: AttestTriggerProps) {
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={cn(
        "gap-1.5 border-[#ff8a3d]/30 text-[#ff8a3d] hover:bg-[#ff8a3d]/10 hover:text-[#ff8a3d]",
        variant === "default" && "bg-[#ff8a3d] text-[#0a0a0a] hover:bg-[#ff8a3d]/90 border-transparent",
        className,
      )}
      onClick={() => onAttest(target)}
    >
      {showIcon && <Shield size={14} />}
      {label}
    </Button>
  );
}