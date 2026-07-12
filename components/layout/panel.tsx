import { cn } from "@/lib/utils";

type PanelProps = {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  id?: string;
};

export function Panel({ children, className, glow = false, id }: PanelProps) {
  return (
    <div
      id={id}
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