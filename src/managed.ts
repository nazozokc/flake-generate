import {
  LEGACY_PACKAGES_BEGIN,
  LEGACY_PACKAGES_END,
  PACKAGES_BEGIN,
  PACKAGES_END,
} from "./types.js";

function linesOf(text: string): string[] {
  return text.split("\n");
}

function blockRange(
  lines: readonly string[],
  begins: readonly string[],
  ends: readonly string[],
): { start: number; end: number } | undefined {
  const start = lines.findIndex((line) => begins.includes(line.trim()));
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && ends.includes(line.trim()));
  return end < 0 ? undefined : { start, end };
}

function generatedBlock(lines: readonly string[]) {
  return blockRange(lines, [PACKAGES_BEGIN], [PACKAGES_END]);
}

/** Existing files may still use the markers from before the project rename. */
function existingBlock(lines: readonly string[]) {
  return blockRange(
    lines,
    [PACKAGES_BEGIN, LEGACY_PACKAGES_BEGIN],
    [PACKAGES_END, LEGACY_PACKAGES_END],
  );
}

/** Whether an existing file has a complete managed packages block. */
export function hasManagedBlock(content: string | undefined): boolean {
  return content !== undefined && existingBlock(linesOf(content)) !== undefined;
}

/**
 * Merge a freshly rendered flake into an existing file, keeping edits outside
 * the managed block. Files without a complete block are replaced wholesale.
 */
export function mergeManagedContent(existing: string | undefined, generated: string): string {
  if (existing === undefined) return generated;

  const generatedLines = linesOf(generated);
  const fresh = generatedBlock(generatedLines);
  const current = existingBlock(linesOf(existing));
  if (fresh === undefined || current === undefined) return generated;

  const managed = generatedLines.slice(fresh.start, fresh.end + 1);
  const original = linesOf(existing);
  return [...original.slice(0, current.start), ...managed, ...original.slice(current.end + 1)].join(
    "\n",
  );
}

/** Keep an existing .envrc, appending 'use flake' only when it is missing. */
export function renderEnvrc(existing: string | undefined): string {
  if (existing === undefined) return "use flake\n";
  if (linesOf(existing).some((line) => line.trim() === "use flake")) return existing;

  const base = existing.endsWith("\n") ? existing : `${existing}\n`;
  return `${base}use flake\n`;
}
