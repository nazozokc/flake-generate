import { assertWritableTarget, writeFileAtomic } from "./fs.js";
import type { BuildPlanOptions, FsProbe, Plan, ProjectInfo, WriteAction } from "./types.js";

export function buildPlan(
  info: ProjectInfo,
  flake: string,
  options: BuildPlanOptions,
  probe: FsProbe,
): Plan {
  const candidates: WriteAction[] = [
    { kind: "write", path: options.output, label: "flake.nix", content: flake },
  ];
  if (options.envrc) {
    candidates.push({ kind: "write", path: ".envrc", label: ".envrc", content: "use flake\n" });
  }

  const warnings = [...info.warnings];
  const actions: WriteAction[] = [];
  for (const candidate of candidates) {
    const kind = probe.kind(candidate.path);
    if (kind === "other") {
      warnings.push(`${candidate.path} is not a regular file; skipped`);
      continue;
    }
    if (kind === "file" && !options.force) {
      warnings.push(`${candidate.path} already exists; skipped (use --force to overwrite)`);
      continue;
    }
    actions.push(candidate);
  }

  return { actions, warnings };
}

export function diffPlan(plan: Plan, probe: FsProbe): string[] {
  return plan.actions
    .filter((action) => probe.readText(action.path) !== action.content)
    .map((action) => action.path);
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
