import { readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { detectProject } from "./detect/index.js";
import { createNodeFsProbe, isSafeRelativePath } from "./fs.js";
import { applyPlan, buildPlan, diffPlan, renderFlake } from "./plan.js";
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

export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export interface RunOptions extends GenerateInput {
  verbose: boolean;
  check: boolean;
}

export type ParsedArguments =
  | { kind: "run"; options: RunOptions }
  | { kind: "help" }
  | { kind: "version" };

const USAGE = [
  "Usage: flake-generate [options] [dir]",
  "",
  "Generate a clean flake.nix from a project's lockfiles and markers.",
  "",
  "Options:",
  "  -o, --output <path>  output file relative to dir (default: flake.nix)",
  "  -f, --force          overwrite existing files",
  "      --envrc          also write .envrc containing 'use flake'",
  "  -n, --dry-run        show what would be written",
  "      --stdout         print flake.nix instead of writing",
  "  -c, --check          fail if generated files are missing or outdated",
  "  -v, --verbose        show detected markers",
  "  -h, --help           show this help",
  "  -V, --version        show the version",
  "",
].join("\n");

export function parseArguments(argv: readonly string[]): ParsedArguments {
  const options: RunOptions = {
    dir: ".",
    output: "flake.nix",
    force: false,
    envrc: false,
    dryRun: false,
    stdout: false,
    verbose: false,
    check: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === undefined) break;
    switch (arg) {
      case "-h":
      case "--help":
        return { kind: "help" };
      case "-V":
      case "--version":
        return { kind: "version" };
      case "-o":
      case "--output": {
        const value = argv[++i];
        if (value === undefined || value.length === 0) {
          throw new CliError(`${arg} requires a path`);
        }
        options.output = value;
        break;
      }
      case "-f":
      case "--force":
        options.force = true;
        break;
      case "--envrc":
        options.envrc = true;
        break;
      case "-n":
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--stdout":
        options.stdout = true;
        break;
      case "-c":
      case "--check":
        options.check = true;
        break;
      case "-v":
      case "--verbose":
        options.verbose = true;
        break;
      default: {
        const inline = /^--output=(.*)$/.exec(arg);
        if (inline?.[1] !== undefined) {
          options.output = inline[1];
          break;
        }
        if (arg.startsWith("-")) throw new CliError(`unknown option: ${arg}`);
        positional.push(arg);
      }
    }
  }

  if (positional.length > 1) throw new CliError("only one project directory may be given");
  if (options.dryRun && options.stdout) {
    throw new CliError("--dry-run cannot be used with --stdout");
  }
  if (options.check && (options.dryRun || options.stdout || options.force)) {
    throw new CliError("--check cannot be used with --dry-run, --stdout or --force");
  }
  options.dir = positional[0] ?? ".";
  return { kind: "run", options };
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

export async function run(argv: readonly string[]): Promise<number> {
  const parsed = parseArguments(argv);
  if (parsed.kind === "help") {
    process.stdout.write(USAGE);
    return 0;
  }
  if (parsed.kind === "version") {
    process.stdout.write(`${packageVersion()}\n`);
    return 0;
  }

  const options = parsed.options;
  if (options.check) {
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

  const result = await generate(options);
  report(result, options);
  return 0;
}
