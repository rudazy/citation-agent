import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Field = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function MobileDataCard({
  fields,
  className,
}: {
  fields: Field[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card/60 p-3 space-y-2.5",
        className,
      )}
    >
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-0.5 min-w-0">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {field.label}
          </span>
          <div className={cn("text-sm min-w-0 break-words", field.className)}>
            {field.value}
          </div>
        </div>
      ))}
    </div>
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
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        {loadingMessage ?? "Loading…"}
      </p>
    );
  }

  if (empty) {
    return (
      <p className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return <div className="space-y-3 md:hidden">{children}</div>;
}

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "confirmed"
      ? "default"
      : status === "failed"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}