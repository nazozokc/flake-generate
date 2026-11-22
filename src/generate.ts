import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { detectProject } from "./detect/index.js";
import { createNodeFsProbe, isSafeRelativePath } from "./fs.js";
import { applyPlan, buildPlan } from "./plan.js";
import { renderFlake } from "./render/flake.js";
import type { Plan, ProjectInfo } from "./types.js";

export interface GenerateInput {
  dir: string;
  output: string;
  force: boolean;
  envrc: boolean;
  dryRun: boolean;
  stdout: boolean;
}

export interface GenerateResult {
  info: ProjectInfo;
  plan: Plan;
  flake: string;
  written: string[];
}

export async function generate(input: GenerateInput): Promise<GenerateResult> {
  if (!isSafeRelativePath(input.output)) {
    throw new Error(`invalid output path: ${input.output} (must be relative without '..')`);
  }

  const root = resolve(input.dir);
  const target = await stat(root).catch(() => undefined);
  if (!target?.isDirectory()) {
    throw new Error(`not a directory: ${input.dir}`);
  }

  const probe = createNodeFsProbe(root);
  const info = detectProject(probe, basename(root));
  const flake = renderFlake(info);
  const plan = buildPlan(
    info,
    flake,
    { output: input.output, force: input.force, envrc: input.envrc },
    probe,
  );
  const written = input.dryRun || input.stdout ? [] : await applyPlan(root, plan);

  return { info, plan, flake, written };
}
