"use client";

import Link from "next/link";
import { parseMentionSegments } from "@/lib/mentions";
import { cn } from "@/lib/utils";

type Props = {
  text: string;
  className?: string;
};

/** Renders free text with @username tokens linked to public profiles. */
export function MentionText({ text, className }: Props) {
  const segments = parseMentionSegments(text);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <span key={`t-${i}`}>{seg.value}</span>;
        }
        return (
          <Link
            key={`m-${i}-${seg.username}`}
            href={seg.href}
            className="text-[#f5c842] hover:underline"
          >
            @{seg.username}
          </Link>
        );
      })}
    </span>
  );
}
