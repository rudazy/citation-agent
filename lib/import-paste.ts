/**
 * Lightweight import from pasted markdown / research notes.
 * Does not scrape remote URLs — creator pastes content they own.
 */

export type ImportPasteResult = {
  title: string;
  subheading: string;
  body: string;
};

/**
 * Parse pasted markdown into title, teaser, and body.
 * - First ATX heading (#) becomes title when present
 * - First non-empty paragraph after title becomes public teaser
 * - Remainder is paywalled body
 */
export function parseImportPaste(raw: string): ImportPasteResult {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { title: "", subheading: "", body: "" };
  }

  const lines = text.split("\n");
  let title = "";
  let start = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const heading = line.match(/^#\s+(.+)$/);
    if (heading) {
      title = heading[1].trim();
      start = i + 1;
      break;
    }
    // First non-empty line as title if no markdown heading
    title = line.replace(/^#+\s*/, "").trim();
    start = i + 1;
    break;
  }

  while (start < lines.length && !lines[start].trim()) start += 1;

  let subheading = "";
  let bodyStart = start;
  if (start < lines.length) {
    // Collect first paragraph as teaser
    const para: string[] = [];
    let i = start;
    for (; i < lines.length; i++) {
      if (!lines[i].trim()) {
        if (para.length > 0) {
          i += 1;
          break;
        }
        continue;
      }
      // Stop teaser if we hit another heading
      if (/^#{1,6}\s+/.test(lines[i].trim()) && para.length > 0) break;
      para.push(lines[i].trim());
      if (para.join(" ").length > 280) break;
    }
    subheading = para.join(" ").trim().slice(0, 500);
    bodyStart = i;
    while (bodyStart < lines.length && !lines[bodyStart].trim()) bodyStart += 1;
  }

  const body = lines.slice(bodyStart).join("\n").trim();

  return {
    title: title.slice(0, 200),
    subheading,
    body: body || text,
  };
}
