import { assertWritableTarget, writeFileAtomic } from "./fs.js";
import { hasManagedBlock, mergeManagedContent, renderEnvrc } from "./managed.js";
import type { BuildPlanOptions, FsProbe, Plan, ProjectInfo, WriteAction } from "./types.js";

export function buildPlan(
  info: ProjectInfo,
  flake: string,
  options: BuildPlanOptions,
  probe: FsProbe,
): Plan {
  const existingFlake = probe.readText(options.output);
  const candidates: WriteAction[] = [
    {
      kind: "write",
      path: options.output,
      label: "flake.nix",
      content: mergeManagedContent(existingFlake, flake),
    },
  ];
  if (options.envrc) {
    candidates.push({
      kind: "write",
      path: ".envrc",
      label: ".envrc",
      content: renderEnvrc(probe.readText(".envrc")),
    });
  }
  if (options.ignoreExisting) return { actions: candidates, warnings: [...info.warnings] };

  const updatable = new Set<string>();
  if (hasManagedBlock(existingFlake)) updatable.add(options.output);
  if (options.envrc) updatable.add(".envrc");

  const warnings = [...info.warnings];
  const actions: WriteAction[] = [];
  for (const candidate of candidates) {
    const kind = probe.kind(candidate.path);
    if (kind === "other") {
      warnings.push(`${candidate.path} is not a regular file; skipped`);
      continue;
    }
    if (kind === "file" && !options.force && !updatable.has(candidate.path)) {
      warnings.push(`${candidate.path} already exists; skipped (use --force to overwrite)`);
      continue;
    }
    if (probe.readText(candidate.path) === candidate.content) continue;
    actions.push(candidate);
  }

  return { actions, warnings };
}

export function diffPlan(plan: Plan, probe: FsProbe): string[] {
  return plan.actions
    .filter((action) => probe.readText(action.path) !== action.content)
    .map((action) => action.path);
}

interface Change {
  kind: "same" | "add" | "remove";
  text: string;
}

const PREFIX: Readonly<Record<Change["kind"], string>> = {
  same: " ",
  add: "+",
  remove: "-",
};

function linesOf(text: string): string[] {
  const lines = text.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

function changes(before: readonly string[], after: readonly string[]): Change[] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    const row = table[i];
    const next = table[i + 1];
    if (row === undefined || next === undefined) continue;
    for (let j = after.length - 1; j >= 0; j--) {
      const same = before[i] === after[j] ? (next[j + 1] ?? 0) + 1 : 0;
      row[j] = Math.max(same, next[j] ?? 0, row[j + 1] ?? 0);
    }
  }

  const result: Change[] = [];
  let i = 0;
  let j = 0;
  while (i < before.length && j < after.length) {
    const left = before[i];
    const right = after[j];
    if (left === right) {
      result.push({ kind: "same", text: left ?? "" });
      i++;
      j++;
    } else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
      result.push({ kind: "remove", text: left ?? "" });
      i++;
    } else {
      result.push({ kind: "add", text: right ?? "" });
      j++;
    }
  }
  while (i < before.length) {
    result.push({ kind: "remove", text: before[i] ?? "" });
    i++;
  }
  while (j < after.length) {
    result.push({ kind: "add", text: after[j] ?? "" });
    j++;
  }
  return result;
}

function compact(edits: readonly Change[], context: number): Change[] {
  const keep = new Set<number>();
  for (let index = 0; index < edits.length; index++) {
    if (edits[index]?.kind === "same") continue;
    for (
      let neighbor = Math.max(0, index - context);
      neighbor <= Math.min(edits.length - 1, index + context);
      neighbor++
    ) {
      keep.add(neighbor);
    }
  }
  return edits.filter((_, index) => keep.has(index));
}

export function diffText(path: string, actual: string | undefined, expected: string): string {
  const before = linesOf(actual ?? "");
  const after = linesOf(expected);
  const edits = compact(changes(before, after), 2);
  if (edits.every((edit) => edit.kind === "same")) return "";

  return [
    `--- ${actual === undefined ? "/dev/null" : `a/${path}`}`,
    `+++ b/${path}`,
    `@@ -1,${before.length} +1,${after.length} @@`,
    ...edits.map((edit) => `${PREFIX[edit.kind]}${edit.text}`),
  ].join("\n");
}

export async function applyPlan(root: string, plan: Plan): Promise<string[]> {
  for (const action of plan.actions) {
    await assertWritableTarget(root, action.path);
  }

  const written: string[] = [];
  for (const action of plan.actions) {
    await writeFileAtomic(root, action.path, action.content);
    written.push(action.path);
  }
  return written;
}
