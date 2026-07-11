/** Max SVG source length accepted for render (DoS guard). */
export const SVG_MAX_CHARS = 200_000;

/** True when clipboard / body text looks like an SVG document. */
export function isSvgDocument(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^```(?:svg|xml)\b/i.test(t)) return false;
  return /^<\?xml[\s\S]*?<svg[\s>]/i.test(t) || /^<svg[\s>]/i.test(t);
}

/** True when a react-markdown fenced code className is svg. */
export function isSvgLanguageClass(className?: string | null): boolean {
  if (!className) return false;
  return className.split(/\s+/).some((token) => token === "language-svg");
}

/**
 * Strip common XSS vectors from author-supplied SVG.
 * Not a full SVG sanitizer — blocks scripts, handlers, and external payloads.
 */
export function sanitizeSvgSource(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return null;
  if (trimmed.length > SVG_MAX_CHARS) return null;

  // Extract the root <svg>…</svg> if extra wrapper text snuck in.
  const match = trimmed.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (!match) return null;

  let svg = match[0];

  // Remove dangerous elements entirely.
  svg = svg.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  svg = svg.replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, "");
  svg = svg.replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "");
  svg = svg.replace(/<object\b[\s\S]*?<\/object>/gi, "");
  svg = svg.replace(/<embed\b[^>]*>/gi, "");

  // Event handlers and script URLs.
  svg = svg.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  svg = svg.replace(/javascript\s*:/gi, "");
  svg = svg.replace(/data\s*:\s*text\/html/gi, "");

  // External resource loading via xlink / href on use/image (keep relative/data-less).
  svg = svg.replace(
    /\s(?:xlink:)?href\s*=\s*("|')\s*https?:\/\/[^"']*\1/gi,
    "",
  );

  if (!/<svg\b/i.test(svg)) return null;
  return svg;
}

export function validateSvgSource(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return "SVG is empty";
  if (trimmed.length > SVG_MAX_CHARS) {
    return `SVG must be ${SVG_MAX_CHARS.toLocaleString()} characters or fewer`;
  }
  if (!sanitizeSvgSource(trimmed)) {
    return "Not a valid SVG document";
  }
  return null;
}

/** Markdown fence inserted at the editor cursor for a pasted/drawn SVG. */
export function svgMarkdownAtCursor(svg: string): string {
  const body = svg.trim();
  return `\n\n\`\`\`svg\n${body}\n\`\`\`\n\n`;
}

/**
 * Convert bare `<svg>…</svg>` blocks (outside existing fences) into ```svg fences
 * so react-markdown can hand them to the SVG renderer.
 */
export function fenceBareSvgsInMarkdown(content: string): string {
  if (!content.includes("<svg") && !content.includes("<SVG")) return content;

  const fences: string[] = [];
  const protectedContent = content.replace(/```[\s\S]*?```/g, (block) => {
    fences.push(block);
    return `\0FENCE${fences.length - 1}\0`;
  });

  const withFences = protectedContent.replace(/<svg\b[\s\S]*?<\/svg>/gi, (svg) => {
    return `\n\n\`\`\`svg\n${svg}\n\`\`\`\n\n`;
  });

  return withFences.replace(/\0FENCE(\d+)\0/g, (_, index: string) => fences[Number(index)] ?? "");
}
