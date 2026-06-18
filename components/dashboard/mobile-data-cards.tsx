import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Field = {
  label: string;
  value: ReactNode;
  className?: string;
  highlight?: boolean;
};

export function MobileDataCard({
  fields,
  className,
}: {
  fields: Field[];
  className?: string;
}) {
  const primary = fields[0];
  const rest = fields.slice(1);

  return (
    <article
      className={cn(
        "panel-surface overflow-hidden transition-colors hover:border-[#ff8a3d]/25",
        className,
      )}
    >
      {primary && (
        <div className="border-b border-border/60 bg-[#141414]/60 px-3.5 py-2.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {primary.label}
          </span>
          <div className={cn("mt-1 text-sm font-mono min-w-0 break-all", primary.className)}>
            {primary.value}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3 gap-y-3 p-3.5">
        {rest.map((field) => (
          <div
            key={field.label}
            className={cn(
              "min-w-0",
              field.highlight && "col-span-2 rounded-md border border-[#ff8a3d]/20 bg-[#ff8a3d]/5 px-2.5 py-2",
            )}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {field.label}
            </span>
            <div className={cn("mt-0.5 text-sm min-w-0 break-words", field.className)}>
              {field.value}
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

export function MobileDataCardList({
  children,
  empty,
  loading,
  loadingMessage,
}: {
  children: ReactNode;
  empty?: ReactNode;
  loading?: boolean;
  loadingMessage?: string;
}) {
  if (loading) {
    return (
      <div className="panel-surface flex items-center justify-center gap-2 py-14 text-sm text-muted-foreground font-mono">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#ff8a3d]/30 border-t-[#ff8a3d]" />
        {loadingMessage ?? "Loading…"}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="panel-surface border-dashed py-14 text-center text-sm text-muted-foreground font-mono px-4">
        {empty}
      </div>
    );
  }

  return <div className="space-y-3 lg:hidden">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  if (status === "confirmed" || status === "completed") {
    return (
      <Badge className="bg-[#ff8a3d]/15 text-[#ff8a3d] border border-[#ff8a3d]/30 hover:bg-[#ff8a3d]/15">
        {status}
      </Badge>
    );
  }
  const variant = status === "failed" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}