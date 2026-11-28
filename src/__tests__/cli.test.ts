import { readFileSync } from "node:fs";
import { appendFile, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CliError, packageVersion, parseArguments, run, usage } from "../cli.js";

const directories: string[] = [];

afterEach(async () => {
  for (const dir of directories.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("packageVersion", () => {
  it("follows package.json so releases never drift", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(packageVersion()).toBe(pkg.version);
  });
});

describe("parseArguments", () => {
  it("rejects mutually exclusive output modes", () => {
    expect(() => parseArguments(["--stdout", "--dry-run"])).toThrow(
      "--dry-run cannot be used with --stdout",
    );
  });

  it("parses a directory, inline output and flags", () => {
    expect(parseArguments(["../app", "--output=config/flake.nix", "-f", "--envrc"])).toEqual({
      kind: "run",
      options: {
        dir: "../app",
        output: "config/flake.nix",
        force: true,
        envrc: true,
        dryRun: false,
        stdout: false,
        verbose: false,
        check: false,
      },
    });
  });

  it("uses the current directory by default", () => {
    const parsed = parseArguments([]);
    expect(parsed.kind).toBe("run");
    if (parsed.kind === "run") expect(parsed.options.dir).toBe(".");
  });

  it("handles help and version without running", () => {
    expect(parseArguments(["--help"])).toEqual({ kind: "help" });
    expect(parseArguments(["-V"])).toEqual({ kind: "version" });
  });

  it("parses --check and rejects it with write modes", () => {
    const parsed = parseArguments(["-c"]);
    expect(parsed.kind).toBe("run");
    if (parsed.kind === "run") expect(parsed.options.check).toBe(true);

    expect(() => parseArguments(["--check", "--stdout"])).toThrow("--check cannot be used with");
    expect(() => parseArguments(["-c", "-f"])).toThrow("--check cannot be used with");
  });

  it("rejects unknown options, extra directories and missing values", () => {
    expect(() => parseArguments(["--bogus"])).toThrow("unknown option: --bogus");
    expect(() => parseArguments(["one", "two"])).toThrow("only one project directory");
    expect(() => parseArguments(["--output"])).toThrow("--output requires a path");
  });

  it("suggests the closest known option for a typo", () => {
    try {
      parseArguments(["--forcee"]);
      throw new Error("expected an error");
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      if (error instanceof CliError) expect(error.hint).toBe("did you mean --force?");
    }
  });
});

describe("usage", () => {
  it("documents examples and exit codes", () => {
    expect(usage()).toContain("Examples:");
    expect(usage()).toContain("Exit codes:");
  });
});

describe("run --check", () => {
  it("accepts edits outside the managed block", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nix-flake-generate-managed-"));
    directories.push(dir);
    await writeFile(join(dir, "pnpm-lock.yaml"), "");

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(await run([dir])).toBe(0);
      await appendFile(join(dir, "flake.nix"), "\n# hand written\n");
      stdout.mockClear();

      expect(await run([dir, "--check"])).toBe(0);
      const output = stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(output).toContain("up to date");
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
    }
  });

  it("reports and fails on a target it cannot write", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nix-flake-generate-check-"));
    directories.push(dir);
    await writeFile(join(dir, "target"), "keep\n");
    await symlink(join(dir, "target"), join(dir, "flake.nix"));

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(await run([dir, "--check"])).toBe(1);
      const output = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(output).toContain("unwritable: flake.nix");
      expect(output).toContain("not a regular file; skipped");
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
    }
  });
});

describe("run --stdout", () => {
  it("does not report skipped writes when it writes nothing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "nix-flake-generate-stdout-"));
    directories.push(dir);
    await writeFile(join(dir, "flake.nix"), "{ outputs = _: {}; }\n");

    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    try {
      expect(await run(["--stdout", dir])).toBe(0);
      const err = stderr.mock.calls.map(([chunk]) => String(chunk)).join("");
      const out = stdout.mock.calls.map(([chunk]) => String(chunk)).join("");
      expect(err).not.toContain("already exists; skipped");
      expect(out).toContain("Generated by nix-flake-generate");
    } finally {
      stderr.mockRestore();
      stdout.mockRestore();
    }
  });
});
