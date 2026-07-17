"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchProfile } from "@/lib/profile-client";
import { PROFILE_SETUP_PATH, profileHomePath } from "@/lib/profile-home";
import { cn } from "@/lib/utils";

/**
 * Header nav item for the signed-in user's own profile area. With a username
 * it links to /u/{username}; without one it links to the compulsory account
 * setup state at /profile.
 */
export function ProfileNavLink() {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const initial = setTimeout(() => {
      void fetchProfile().then((status) => {
        if (!cancelled) setUsername(status.username);
      });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(initial);
    };
  }, []);

  const href = profileHomePath(username);
  const active = pathname === href || (!username && pathname === PROFILE_SETUP_PATH);

  return (
    <Button
      variant={active ? "secondary" : "ghost"}
      size="sm"
      className={cn("h-8 gap-1.5", active && "bg-secondary text-foreground")}
      asChild
    >
      <Link href={href}>
        <UserRound size={14} />
        Profile
      </Link>
    </Button>
  );
}
