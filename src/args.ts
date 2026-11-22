import type { GenerateInput } from "./generate.js";

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

export function usage(): string {
  return USAGE;
}

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
