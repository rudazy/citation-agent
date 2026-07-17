"use client";

import Link from "next/link";
import { AppLogo } from "@/components/brand/app-logo";
import { ProfileNavLink } from "@/components/brand/profile-nav-link";
import { NotificationsBell } from "@/components/marketplace/notifications-bell";
import { TopBarGatewayControls } from "@/components/dashboard/top-bar-gateway-controls";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Store } from "lucide-react";

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
      className={cn("h-8 gap-1.5", active && "bg-secondary text-foreground")}
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
  // Payment Trace left the top nav; it remains reachable as the dashboard
  // trace tab (/dashboard?tab=trace) and the marketplace trace card.
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
      isActive: active === "dashboard",
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
          <ProfileNavLink />
        </nav>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <NotificationsBell />
          <TopBarGatewayControls />
          {trailing}
        </div>
      </div>
    </header>
  );
}