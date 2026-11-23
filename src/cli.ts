import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RunOptions } from "./args.js";
import { parseArguments, usage } from "./args.js";
import { createNodeFsProbe } from "./fs.js";
import { type GenerateInput, type GenerateResult, generate } from "./generate.js";
import { diffPlan, diffText } from "./plan.js";
import type { FsProbe } from "./types.js";
import {
  colorizeDiff,
  createUi,
  detectionLine,
  header,
  info,
  limitDiff,
  success,
  summary,
  type Ui,
  warning,
} from "./ui.js";

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

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function reportFindings(result: GenerateResult, options: RunOptions, ui: Ui): void {
  const err = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };

  err("");
  err(header(ui, packageVersion(), resolve(options.dir)));
  err("");
  for (const detection of result.info.detections) err(detectionLine(ui, detection));
  for (const message of result.plan.warnings) err(warning(ui, message));
}

function report(result: GenerateResult, options: RunOptions, probe: FsProbe, ui: Ui): void {
  const err = (message: string): void => {
    process.stderr.write(`${message}\n`);
  };

  reportFindings(result, options, ui);

  if (options.stdout) {
    process.stdout.write(result.flake);
    return;
  }

  if (options.dryRun) {
    if (result.plan.actions.length === 0) {
      err(info(ui, "nothing to write"));
      return;
    }
    for (const action of result.plan.actions) {
      const diff = diffText(action.path, probe.readText(action.path), action.content);
      err(info(ui, `would write ${action.path}`));
      if (diff.length === 0) err(summary(ui, "unchanged"));
      else err(colorizeDiff(ui, diff));
    }
    return;
  }

  if (result.written.length === 0) {
    err(info(ui, "nothing to write; use --force to replace an unmanaged file"));
  } else {
    for (const path of result.written) err(success(ui, `wrote ${path}`));
  }

  const packages = result.info.detections.reduce((total, item) => total + item.packages.length, 0);
  err(
    summary(
      ui,
      [
        countLabel(result.info.detections.length, "ecosystem", "ecosystems"),
        countLabel(packages, "package", "packages"),
        countLabel(result.written.length, "file", "files"),
      ].join(" · "),
    ),
  );
}

async function runCheck(options: RunOptions, probe: FsProbe, ui: Ui): Promise<number> {
  const input: GenerateInput = {
    dir: options.dir,
    output: options.output,
    force: true,
    envrc: options.envrc,
    dryRun: true,
    stdout: false,
  };
  const result = await generate(input);
  reportFindings(result, options, ui);

  const expected = [options.output, ...(options.envrc ? [".envrc"] : [])];
  const blocked = expected.filter((path) => probe.kind(path) === "other");
  const mismatches = diffPlan(result.plan, probe);
  if (blocked.length === 0 && mismatches.length === 0) {
    process.stdout.write("up to date\n");
    return 0;
  }

  for (const path of blocked) {
    process.stderr.write(`unwritable: ${path} (not a regular file)\n`);
  }
  for (const path of mismatches) {
    const action = result.plan.actions.find((candidate) => candidate.path === path);
    const diff = action === undefined ? "" : diffText(path, probe.readText(path), action.content);
    process.stderr.write(`outdated: ${path}\n`);
    if (diff.length > 0) {
      const max = options.verbose ? Number.MAX_SAFE_INTEGER : 20;
      process.stderr.write(`${colorizeDiff(ui, limitDiff(diff, max))}\n`);
    }
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
  const ui = createUi(options.verbose);
  const probe = createNodeFsProbe(resolve(options.dir));
  if (options.check) return runCheck(options, probe, ui);

  const result = await generate(options);
  report(result, options, probe, ui);
  return 0;
}
