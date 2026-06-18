import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { TopBarGatewayControls } from "@/components/dashboard/top-bar-gateway-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Activity, LayoutDashboard, Store } from "lucide-react";

type AppHeaderProps = {
  active?: "dashboard" | "marketplace";
  showBack?: boolean;
  backHref?: string;
  backLabel?: string;
  trailing?: React.ReactNode;
  className?: string;
};

export function AppHeader({
  active,
  showBack = false,
  backHref = "/dashboard",
  backLabel = "Dashboard",
  trailing,
  className,
}: AppHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          {showBack && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          )}
          <AppLogo href="/dashboard" />
        </div>

        <nav className="hidden md:flex items-center gap-1 rounded-md border border-border/70 bg-muted/40 p-1">
          <Button
            variant={active === "dashboard" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            asChild
          >
            <Link href="/dashboard">
              <LayoutDashboard size={14} />
              Dashboard
            </Link>
          </Button>
          <Button
            variant={active === "marketplace" ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            asChild
          >
            <Link href="/marketplace">
              <Store size={14} />
              Marketplace
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-[#b35a18] hover:text-[#ff8a3d] hover:bg-[#ff8a3d]/10"
            asChild
          >
            <Link href="/dashboard?tab=trace">
              <Activity size={14} />
              Payment Trace
            </Link>
          </Button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <TopBarGatewayControls />
          {trailing}
        </div>
      </div>
    </header>
  );
}