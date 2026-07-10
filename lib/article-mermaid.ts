/** Max mermaid source length accepted for render (DoS guard). */
export const MERMAID_MAX_CHARS = 20_000;

/** Default flowchart template inserted by the body editor. */
export const DEFAULT_MERMAID_TEMPLATE = `flowchart TD
  A[Start] --> B[Step]
  B --> C[End]`;

/**
 * True when a react-markdown fenced code `className` is mermaid
 * (e.g. `language-mermaid` or `language-mmd`).
 */
export function isMermaidLanguageClass(className?: string | null): boolean {
  if (!className) return false;
  return className
    .split(/\s+/)
    .some((token) => token === "language-mermaid" || token === "language-mmd");
}

/** Reject empty / oversized diagram sources before rendering. */
export function validateMermaidSource(source: string): string | null {
  const trimmed = source.trim();
  if (!trimmed) return "Diagram is empty";
  if (trimmed.length > MERMAID_MAX_CHARS) {
    return `Diagram must be ${MERMAID_MAX_CHARS.toLocaleString()} characters or fewer`;
  }
  return null;
}

/** Markdown fence inserted at the editor cursor for a new diagram. */
export function mermaidMarkdownAtCursor(
  chart: string = DEFAULT_MERMAID_TEMPLATE,
): string {
  return `\n\n\`\`\`mermaid\n${chart.trim()}\n\`\`\`\n\n`;
}

/**
 * True when the body contains a mermaid / mmd fenced block (closed or still open).
 * Used to surface the live preview when diagrams are present.
 */
export function bodyHasMermaidFence(body: string): boolean {
  return /```(?:mermaid|mmd)\b/i.test(body);
}
