import { Suspense } from "react";
import { logout } from "@/app/actions";
import { AppHeader } from "@/components/brand/app-header";
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
      <main className="relative flex-1 p-6">
        <Suspense fallback={<div className="text-sm text-muted-foreground font-mono">Loading dashboard…</div>}>
          {children}
        </Suspense>
      </main>
    </div>
  );
}