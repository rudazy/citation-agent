import { Badge } from "@/components/ui/badge";
import { Coins, FileSearch } from "lucide-react";

export function MarketplaceHero() {
  return (
    <section className="relative overflow-hidden rounded-lg border border-border bg-[#0a0a0a] text-[#f5f5f5] p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#f5c842]/15 blur-3xl"
      />

      <div className="relative space-y-5">
        <Badge className="bg-[#f5c842]/15 text-[#f5c842] border border-[#f5c842]/30 hover:bg-[#f5c842]/15">
          Crypto research marketplace
        </Badge>

        <div className="space-y-3 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide leading-snug">
            Researchers sell crypto research. Agents buy it.
          </h1>
          <p className="text-sm sm:text-[15px] leading-relaxed text-[#a3a3a3] font-mono">
            Browse the catalog, unlock reports with USDC, or publish your own.
            The demo moment: a human buys research, then an agent buys the same
            report — automatically, through Circle Gateway.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 max-w-xl">
          <div className="flex gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-3">
            <FileSearch size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
            <div>
              <p className="text-sm font-medium">For researchers</p>
              <p className="text-xs text-[#666] font-mono">
                Publish paywalled reports and earn per unlock
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-3">
            <Coins size={16} className="mt-0.5 shrink-0 text-[#f5c842]" />
            <div>
              <p className="text-sm font-medium">For agents</p>
              <p className="text-xs text-[#666] font-mono">
                Wallet on Arc pays via Gateway — no MetaMask popup per purchase
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}