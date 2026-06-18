import { cn } from "@/lib/utils";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
};

export function Panel({ children, className, glow = false }: PanelProps) {
  return (
    <div
      className={cn(
        "panel-surface",
        glow && "panel-glow border-[#ff8a3d]/20",
        className,
      )}
    >
      {children}
    </div>
  );
}