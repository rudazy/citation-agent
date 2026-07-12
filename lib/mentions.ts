import { normalizeUsernameInput } from "@/lib/username";
import { buildProfilePath } from "@/lib/profile-url";

/** Matches @username tokens (3–24 chars, letters/numbers/underscore). */
export const MENTION_PATTERN = /@([a-zA-Z0-9_]{3,24})\b/g;

export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; username: string; href: string };

/** Split free text into plain text and @mention segments for rendering. */
export function parseMentionSegments(text: string): MentionSegment[] {
  if (!text) return [{ type: "text", value: "" }];

  const segments: MentionSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_PATTERN.source, "g");
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const raw = match[1];
    const username = normalizeUsernameInput(raw) ?? raw.toLowerCase();
    segments.push({
      type: "mention",
      value: match[0],
      username,
      href: buildProfilePath(username),
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: text }];
}

/** Unique usernames mentioned in text (canonical lowercase). */
export function extractMentionUsernames(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(MENTION_PATTERN.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const username = normalizeUsernameInput(match[1]);
    if (username) found.add(username);
  }
  return Array.from(found);
}
