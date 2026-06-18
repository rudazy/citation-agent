import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TopBarGatewayControls } from "@/components/dashboard/top-bar-gateway-controls";
import { ArrowLeft } from "lucide-react";

export default function MarketplaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard">
                <ArrowLeft size={14} className="mr-1" />
                Dashboard
              </Link>
            </Button>
            <TopBarGatewayControls />
          </div>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}