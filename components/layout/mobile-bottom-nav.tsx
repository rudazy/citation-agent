"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, LayoutDashboard, Shield, Store } from "lucide-react";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  active?: "dashboard" | "marketplace";
};

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, id: "dashboard" as const },
  { href: "/dashboard?tab=attestations", label: "Claims", icon: Shield, id: "attestations" as const },
  { href: "/marketplace", label: "Market", icon: Store, id: "marketplace" as const },
  { href: "/dashboard?tab=trace", label: "Trace", icon: Activity, id: "trace" as const },
];

function isActive(
  id: (typeof ITEMS)[number]["id"],
  pathname: string,
  tab: string | null,
  layoutActive?: "dashboard" | "marketplace",
) {
  if (id === "trace") return pathname === "/dashboard" && tab === "trace";
  if (id === "attestations") return pathname === "/dashboard" && tab === "attestations";
  if (id === "marketplace") {
    return pathname.startsWith("/marketplace") || layoutActive === "marketplace";
  }
  return pathname === "/dashboard" && tab !== "trace" && tab !== "attestations";
}

export function MobileBottomNav({ active }: MobileBottomNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-[#0a0a0a]/92 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobile navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5 pb-2">
        {ITEMS.map((item) => {
          const highlight = isActive(item.id, pathname, tab, active);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px] font-medium tracking-wide transition-colors",
                highlight
                  ? "text-[#ff8a3d]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                  highlight && "bg-[#ff8a3d]/12 ring-1 ring-[#ff8a3d]/30",
                )}
              >
                <item.icon size={18} strokeWidth={highlight ? 2.25 : 1.75} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}