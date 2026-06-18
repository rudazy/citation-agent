import { Badge } from "@/components/ui/badge";
import { Coins, FileSearch, Radio, Shield } from "lucide-react";

const FEATURES = [
  {
    icon: FileSearch,
    label: "Pay-per-citation",
    detail: "Agents buy verified sources, not hallucinations",
  },
  {
    icon: Coins,
    label: "cUSDC royalties",
    detail: "70% creator split via branded wrapper token",
  },
  {
    icon: Radio,
    label: "x402 + Gateway",
    detail: "Gasless EIP-712 auth, batched on-chain settlement",
  },
  {
    icon: Shield,
    label: "Full trace",
    detail: "EIP-712 through submitBatch, decoded live",
  },
] as const;

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
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#ff8a3d]/20 blur-3xl"
      />

      <div className="relative space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-[#ff8a3d]/15 text-[#ff8a3d] border border-[#ff8a3d]/30 hover:bg-[#ff8a3d]/15">
            Circle Agent Stack
          </Badge>
          <Badge variant="outline" className="border-[#333] text-[#999] bg-transparent">
            Arc Testnet · 5042002
          </Badge>
        </div>

        <div className="space-y-3 max-w-2xl">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-wide">
            Citation Marketplace
          </h1>
          <p className="text-sm sm:text-[15px] leading-relaxed text-[#a3a3a3] font-mono">
            A paywalled catalog where research agents discover creator citations, settle
            micro-royalties through Circle Gateway, and earn in{" "}
            <span className="text-[#f5c842]">cUSDC</span>. Every purchase is traceable
            from off-chain signature to on-chain batch.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, label, detail }) => (
            <div
              key={label}
              className="flex gap-3 rounded border border-[#1f1f1f] bg-[#111]/80 px-4 py-3"
            >
              <Icon size={16} className="mt-0.5 shrink-0 text-[#ff8a3d]" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-[#666] font-mono">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 pt-1 font-mono text-[11px] text-[#666]">
          <code className="rounded border border-[#1f1f1f] bg-[#141414] px-2 py-1">
            GET /api/marketplace/citations
          </code>
          <code className="rounded border border-[#1f1f1f] bg-[#141414] px-2 py-1">
            GET /api/marketplace/citations?id=…
          </code>
        </div>
      </div>
    </section>
  );
}