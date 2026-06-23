"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
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

function NavLink({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn(
        "h-8 gap-1.5",
        label === "Payment Trace" &&
          !active &&
          "text-[#ff8a3d]/80 hover:text-[#ff8a3d] hover:bg-[#ff8a3d]/10",
        label === "Payment Trace" &&
          active &&
          "bg-[#ff8a3d]/12 text-[#ff8a3d] ring-1 ring-[#ff8a3d]/35",
        active && label !== "Payment Trace" && "bg-secondary text-foreground",
      )}
      asChild
    >
      <Link href={href}>
        <Icon size={14} />
        {label}
      </Link>
    </Button>
  );
}

export function AppHeader({
  active,
  showBack = false,
  backHref = "/marketplace",
  backLabel = "Marketplace",
  trailing,
  className,
}: AppHeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onTraceTab =
    pathname === "/dashboard" && searchParams.get("tab") === "trace";

  const navItems = [
    {
      href: "/marketplace",
      label: "Research",
      icon: Store,
      isActive: active === "marketplace",
    },
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: active === "dashboard" && !onTraceTab,
    },
    {
      href: "/dashboard?tab=trace",
      label: "Payment Trace",
      icon: Activity,
      isActive: onTraceTab,
    },
  ] as const;

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-border/60 bg-[#0a0a0a]/85 backdrop-blur-xl",
        className,
      )}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex items-center gap-2 sm:gap-5 min-w-0 flex-1">
          {showBack && (
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          )}
          <AppLogo href="/marketplace" compact />
        </div>

        <nav className="hidden md:flex items-center gap-1 rounded-md border border-border/60 bg-[#111111]/80 p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              active={item.isActive}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <TopBarGatewayControls />
          {trailing}
        </div>
      </div>
    </header>
  );
}