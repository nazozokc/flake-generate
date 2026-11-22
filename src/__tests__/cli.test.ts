import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { packageVersion, parseArguments } from "../cli.js";

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
});
