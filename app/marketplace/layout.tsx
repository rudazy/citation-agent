import { AppHeader } from "@/components/brand/app-header";
import { SiteBackground } from "@/components/layout/site-background";

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen flex flex-col">
      <SiteBackground />
      <AppHeader active="marketplace" />
      <main className="relative flex-1 p-6">{children}</main>
    </div>
  );
}