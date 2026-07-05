"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

type Props = {
  src?: string | Blob;
  alt?: string;
};

export function MarkdownImage({ src, alt }: Props) {
  const [failed, setFailed] = useState(false);
  const url = typeof src === "string" ? src.trim() : "";

  if (!url || failed) {
    return (
      <span className="my-4 flex items-center justify-center gap-2 rounded border border-[#333] bg-[#111] px-3 py-8 font-mono text-[10px] text-[#666]">
        <ImageOff size={14} className="text-[#555]" />
        {alt?.trim() ? `Image unavailable — ${alt}` : "Image unavailable"}
      </span>
    );
  }

  return (
    <span className="my-4 block w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt ?? ""}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className="max-h-[480px] w-full max-w-full rounded border border-[#333] bg-[#0a0a0a] object-contain"
      />
    </span>
  );
}