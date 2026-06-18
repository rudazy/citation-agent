import Link from "next/link";
import { cn } from "@/lib/utils";

export function AppLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-9 w-9 shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="5" fill="#0a0a0a" />
      <path
        d="M11 9L7 16L11 23"
        stroke="#f5f5f5"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
      <path
        d="M21 9L25 16L21 23"
        stroke="#f5f5f5"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
      <circle cx="16" cy="16" r="2.25" fill="#f5c842" />
      <path d="M9 26H23" stroke="#1f1f1f" strokeWidth="1" />
    </svg>
  );
}

type AppLogoProps = {
  href?: string;
  showSubtitle?: boolean;
  compact?: boolean;
  className?: string;
};

export function AppLogo({
  href = "/dashboard",
  showSubtitle = true,
  compact = false,
  className,
}: AppLogoProps) {
  const content = (
    <div className={cn("flex items-center gap-3 min-w-0", className)}>
      <AppLogoMark />
      <div className="min-w-0 leading-tight">
        <p
          className={cn(
            "font-semibold tracking-wide text-foreground truncate",
            compact ? "text-sm" : "text-base sm:text-[15px]",
          )}
        >
          Citation Agent
          <span className="text-muted-foreground font-normal"> + </span>
          <span className="text-[#c8a832]">CanteenUSDC</span>
        </p>
        {showSubtitle && !compact && (
          <p className="hidden sm:block text-[11px] font-mono text-muted-foreground truncate">
            x402 nanopayments on Arc Testnet
          </p>
        )}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <Link href={href} className="hover:opacity-90 transition-opacity">
      {content}
    </Link>
  );
}