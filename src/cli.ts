import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { detectProject } from "./detect/index.js";
import { createNodeFsProbe, isSafeRelativePath } from "./fs.js";
import { applyPlan, buildPlan, renderFlake } from "./plan.js";
import type { Plan, ProjectInfo } from "./types.js";

export function packageVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      version?: unknown;
    };
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

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

interface CommandOptions {
  output: string;
  force?: boolean;
  envrc?: boolean;
  dryRun?: boolean;
  stdout?: boolean;
  verbose?: boolean;
}

function report(result: GenerateResult, options: CommandOptions): void {
  const out = (message: string): void => {
    process.stdout.write(`${message}\n`);
  };
  const err = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };

  if (options.verbose) {
    for (const detection of result.info.detections) {
      err(`detected ${detection.ecosystem}: ${detection.markers.join(", ")}`);
    }
  }
  for (const warning of result.plan.warnings) {
    err(`warning: ${warning}`);
  }

  if (options.stdout) {
    process.stdout.write(result.flake);
    return;
  }
  if (options.dryRun) {
    if (result.plan.actions.length === 0) {
      out("nothing to write");
    }
    for (const action of result.plan.actions) {
      out(`would write ${action.path}`);
    }
    return;
  }
  if (result.written.length === 0) {
    err("nothing written");
  }
  for (const path of result.written) {
    err(`wrote ${path}`);
  }
}

export function createProgram(): Command {
  const program = new Command();
  program.exitOverride();

  program
    .name("flake-generate")
    .description("Generate a clean flake.nix from a project's lockfiles and markers")
    .version(packageVersion())
    .argument("[dir]", "project directory", ".")
    .option("-o, --output <path>", "output file relative to dir", "flake.nix")
    .option("-f, --force", "overwrite existing files")
    .option("--envrc", "also write .envrc containing 'use flake'")
    .option("-n, --dry-run", "show what would be written")
    .option("--stdout", "print flake.nix instead of writing")
    .option("-v, --verbose", "show detected markers")
    .action(async (dir: string, options: CommandOptions): Promise<void> => {
      const result = await generate({
        dir,
        output: options.output,
        force: options.force ?? false,
        envrc: options.envrc ?? false,
        dryRun: options.dryRun ?? false,
        stdout: options.stdout ?? false,
      });
      report(result, options);
    });

  return program;
}
