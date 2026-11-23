import { PACKAGES_BEGIN, PACKAGES_END } from "./types.js";

function linesOf(text: string): string[] {
  return text.split("\n");
}

function blockRange(lines: readonly string[]): { start: number; end: number } | undefined {
  const start = lines.findIndex((line) => line.trim() === PACKAGES_BEGIN);
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && line.trim() === PACKAGES_END);
  return end < 0 ? undefined : { start, end };
}

/** Whether an existing file has a complete managed packages block. */
export function hasManagedBlock(content: string | undefined): boolean {
  return content !== undefined && blockRange(linesOf(content)) !== undefined;
}

/**
 * Merge a freshly rendered flake into an existing file, keeping edits outside
 * the managed block. Files without a complete block are replaced wholesale.
 */
export function mergeManagedContent(existing: string | undefined, generated: string): string {
  if (existing === undefined) return generated;

  const generatedLines = linesOf(generated);
  const generatedBlock = blockRange(generatedLines);
  const existingBlock = blockRange(linesOf(existing));
  if (generatedBlock === undefined || existingBlock === undefined) return generated;

  const managed = generatedLines.slice(generatedBlock.start, generatedBlock.end + 1);
  const original = linesOf(existing);
  return [
    ...original.slice(0, existingBlock.start),
    ...managed,
    ...original.slice(existingBlock.end + 1),
  ].join("\n");
}

/** Keep an existing .envrc, appending 'use flake' only when it is missing. */
export function renderEnvrc(existing: string | undefined): string {
  if (existing === undefined) return "use flake\n";
  if (linesOf(existing).some((line) => line.trim() === "use flake")) return existing;

  const base = existing.endsWith("\n") ? existing : `${existing}\n`;
  return `${base}use flake\n`;
}
