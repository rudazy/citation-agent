/**
 * Helpers for LaTeX / KaTeX in research report bodies.
 * Footnote definitions are especially fragile: complex $…$ fractions need to
 * stay readable even when KaTeX layout CSS is late or overridden.
 */

/** Turn common TeX fragments into a linear unicode form for footnotes / fallbacks. */
export function latexToPlain(tex: string): string {
  let s = tex.trim();
  // Nested fractions are rare in footnotes; one-level is enough.
  for (let i = 0; i < 4; i++) {
    const next = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, "($1)/($2)");
    if (next === s) break;
    s = next;
  }
  s = s
    .replace(/\\times/g, "×")
    .replace(/\\cdot/g, "·")
    .replace(/\\approx/g, "≈")
    .replace(/\\leq/g, "≤")
    .replace(/\\geq/g, "≥")
    .replace(/\\neq/g, "≠")
    .replace(/\\pm/g, "±")
    .replace(/\\infty/g, "∞")
    .replace(/\\%/g, "%")
    .replace(/\\,/g, " ")
    .replace(/\\;/g, " ")
    .replace(/\\left|\\right/g, "")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\mathrm\{([^{}]*)\}/g, "$1")
    .replace(/[_^]\{([^{}]+)\}/g, "$1")
    .replace(/[_^]([A-Za-z0-9])/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/\\([a-zA-Z]+)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return s;
}

/**
 * Replace inline $…$ math inside GFM footnote definitions with plain text.
 * Body math (outside [^n]: lines) is left for KaTeX.
 *
 * Why: footnote #1 with a fraction was either missing or copied as a KaTeX
 * DOM dump when layout CSS did not apply inside the footnotes list.
 */
export function plainMathInFootnoteDefinitions(markdown: string): string {
  if (!markdown.includes("[^") || !markdown.includes("$")) return markdown;

  return markdown
    .split("\n")
    .map((line) => {
      // Footnote definition line: [^1]: …
      const match = line.match(/^(\[\^[^\]]+\]:\s*)([\s\S]*)$/);
      if (!match) return line;
      const [, prefix, body] = match;
      // Only inline $…$ (not $$ display blocks — rare in footnotes).
      const plainBody = body.replace(/\$([^$\n]+)\$/g, (_, tex: string) =>
        latexToPlain(tex),
      );
      return prefix + plainBody;
    })
    .join("\n");
}
