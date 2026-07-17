/**
 * Markdown formatting helpers for the article editor toolbar. Pure functions
 * over (value, selectionStart, selectionEnd) so they are unit-testable and
 * independent of the textarea DOM.
 */

export type FormatResult = {
  next: string;
  /** New selection range after the edit (start === end places a caret). */
  selStart: number;
  selEnd: number;
};

/** Wrap the selection in prefix/suffix; use placeholder when nothing is selected. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  prefix: string,
  suffix: string,
  placeholder: string,
): FormatResult {
  const selected = value.slice(start, end) || placeholder;
  const next = value.slice(0, start) + prefix + selected + suffix + value.slice(end);
  return {
    next,
    selStart: start + prefix.length,
    selEnd: start + prefix.length + selected.length,
  };
}

/** Prefix every line touched by the selection (headings, quotes, lists). */
export function prefixSelectedLines(
  value: string,
  start: number,
  end: number,
  linePrefix: string,
): FormatResult {
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndIdx = value.indexOf("\n", end);
  const lineEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, lineEnd);
  const prefixed = block
    .split("\n")
    .map((line) => `${linePrefix}${line}`)
    .join("\n");
  const next = value.slice(0, lineStart) + prefixed + value.slice(lineEnd);
  return { next, selStart: lineStart, selEnd: lineStart + prefixed.length };
}

/** Next unused numeric footnote marker in the document. */
export function nextFootnoteNumber(value: string): number {
  let max = 0;
  for (const match of value.matchAll(/\[\^(\d+)\]/g)) {
    const n = Number(match[1]);
    if (n > max) max = n;
  }
  return max + 1;
}

/**
 * Insert a footnote reference at the cursor and its definition at the end of
 * the document, selecting the definition placeholder for immediate typing.
 */
export function insertFootnote(value: string, start: number, end: number): FormatResult {
  const n = nextFootnoteNumber(value);
  const ref = `[^${n}]`;
  const placeholder = "Source or note here.";
  const withRef = value.slice(0, start) + ref + value.slice(end);
  const needsGap = withRef.length > 0 && !withRef.endsWith("\n\n");
  const definitionPrefix = `${needsGap ? (withRef.endsWith("\n") ? "\n" : "\n\n") : ""}[^${n}]: `;
  const next = withRef + definitionPrefix + placeholder;
  const defStart = withRef.length + definitionPrefix.length;
  return { next, selStart: defStart, selEnd: defStart + placeholder.length };
}

export const FORMULA_BLOCK_SNIPPET = "\n\n$$\nE = mc^2\n$$\n\n";

export const TABLE_SNIPPET =
  "\n\n| Metric | Value | Change |\n| --- | --- | --- |\n| Example | 1.0 | +0.1 |\n\n";

/**
 * Pre-structured research report skeleton for first-time publishers.
 * Sections mirror how paid crypto research is usually organized.
 */
export const REPORT_TEMPLATE = `## Summary

One paragraph. The single finding a buyer pays for, stated plainly.

## Key data

| Metric | Value | Source |
| --- | --- | --- |
| Example metric | 0.00 | On-chain |

## Analysis

Walk through the evidence. Cite sources as footnotes[^1] and show the math when it matters:

$$
\\text{ratio} = \\frac{\\text{numerator}}{\\text{denominator}}
$$

## Methodology

How the data was gathered and what would falsify the conclusion.

## Risks and caveats

What could make this thesis wrong, and how fast.

[^1]: Replace with your source link or reference.
`;
