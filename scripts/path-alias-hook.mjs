/**
 * Resolve @/* TypeScript path aliases when running CLI entrypoints with Node
 * (Next.js handles these automatically; plain node does not).
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXTENSIONS = [".ts", ".mts", ".tsx", ".js", ".mjs", ".json"];

function resolveAlias(specifier) {
  const rel = specifier.slice(2);
  const base = path.join(process.cwd(), rel);
  if (path.extname(base)) {
    return fs.existsSync(base) ? base : null;
  }
  for (const ext of EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const absolute = resolveAlias(specifier);
    if (!absolute) {
      return nextResolve(specifier, context);
    }
    return nextResolve(pathToFileURL(absolute).href, context);
  }
  return nextResolve(specifier, context);
}