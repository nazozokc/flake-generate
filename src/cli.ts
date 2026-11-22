import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RunOptions } from "./args.js";
import { parseArguments, usage } from "./args.js";
import { createNodeFsProbe } from "./fs.js";
import { type GenerateInput, type GenerateResult, generate } from "./generate.js";
import { diffPlan } from "./plan.js";

export type { ParsedArguments, RunOptions } from "./args.js";
export { CliError, parseArguments, usage } from "./args.js";
export type { GenerateInput, GenerateResult } from "./generate.js";
export { generate } from "./generate.js";

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

function report(result: GenerateResult, options: RunOptions): void {
  const out = (message: string): void => {
    process.stdout.write(`${message}\n`);
  };
  const err = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };

  for (const detection of result.info.detections) {
    err(`detected ${detection.label}: ${detection.packages.join(", ")}`);
  }
  if (options.verbose) {
    for (const detection of result.info.detections) {
      err(`markers ${detection.label}: ${detection.markers.join(", ")}`);
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

async function runCheck(options: RunOptions): Promise<number> {
  const input: GenerateInput = {
    dir: options.dir,
    output: options.output,
    force: true,
    envrc: options.envrc,
    dryRun: true,
    stdout: false,
  };
  const result = await generate(input);
  const mismatches = diffPlan(result.plan, createNodeFsProbe(resolve(options.dir)));
  if (mismatches.length === 0) {
    process.stdout.write("up to date\n");
    return 0;
  }
  for (const path of mismatches) {
    process.stderr.write(`outdated: ${path}\n`);
  }
  return 1;
}

export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArguments(argv);
  if (parsed.kind === "help") {
    process.stdout.write(usage());
    return 0;
  }
  if (parsed.kind === "version") {
    process.stdout.write(`${packageVersion()}\n`);
    return 0;
  }

  const options = parsed.options;
  if (options.check) return runCheck(options);

  const result = await generate(options);
  report(result, options);
  return 0;
}
