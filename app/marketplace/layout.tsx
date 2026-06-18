import { Suspense } from "react";
import { AppHeader } from "@/components/brand/app-header";
import { AppLogo } from "@/components/brand/app-logo";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SiteBackground } from "@/components/layout/site-background";

export default function MarketplaceLayout({
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
        <AppHeader active="marketplace" />
      </Suspense>
      <main className="relative flex-1 overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6 safe-bottom animate-fade-up">
        {children}
      </main>
      <Suspense fallback={null}>
        <MobileBottomNav active="marketplace" />
      </Suspense>
    </div>
  );
}