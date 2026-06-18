import { Suspense } from "react";
import { logout } from "@/app/actions";
import { AppHeader } from "@/components/brand/app-header";
import { AppLogo } from "@/components/brand/app-logo";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteBackground } from "@/components/layout/site-background";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <SiteBackground />
      <Suspense
        fallback={
          <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
              <AppLogo href="/dashboard" compact />
            </div>
          </header>
        }
      >
        <AppHeader
          active="dashboard"
          trailing={
            <form action={logout}>
              <Button variant="ghost" size="icon" type="submit" aria-label="Log out">
                <LogOut size={16} className="text-muted-foreground" />
              </Button>
            </form>
          }
        />
      </Suspense>
      <main className="relative flex-1 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 safe-bottom animate-fade-up">
        <Suspense fallback={<div className="text-sm text-muted-foreground font-mono">Loading dashboard…</div>}>
          {children}
        </Suspense>
      </main>
      <Suspense fallback={null}>
        <MobileBottomNav active="dashboard" />
      </Suspense>
    </div>
  );
}