import { chmod, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../cli.js";
import { assertWritableTarget, createNodeFsProbe, writeFileAtomic } from "../fs.js";
import { applyPlan, buildPlan, diffPlan, diffText } from "../plan.js";
import { renderFlake } from "../render/flake.js";
import { LEGACY_PACKAGES_BEGIN, LEGACY_PACKAGES_END, type Plan } from "../types.js";
import { fakeProbe } from "./helpers.js";

const directories: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "nix-flake-generate-"));
  directories.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of directories.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("buildPlan", () => {
  const info = {
    name: "demo",
    detections: [],
    warnings: [],
  };

  it("updates only the managed block and preserves existing .envrc lines", () => {
    const generated = renderFlake(info);
    const existing = generated
      .replace("# No ecosystem detected; add packages here.", "pkgs.old")
      .replace(
        "            shellHook = ''",
        "            # my custom line\n            shellHook = ''",
      );
    const probe = fakeProbe({ "flake.nix": existing, ".envrc": "export FOO=1\n" });
    const plan = buildPlan(
      info,
      generated,
      { output: "flake.nix", force: false, envrc: true },
      probe,
    );

    expect(plan.actions.map((action) => action.path)).toEqual(["flake.nix", ".envrc"]);
    expect(plan.actions[0]?.content).toContain("# my custom line");
    expect(plan.actions[0]?.content).not.toContain("pkgs.old");
    expect(plan.actions[1]?.content).toBe("export FOO=1\nuse flake\n");
    expect(plan.warnings).toEqual([]);
  });

  it("does nothing when the managed block is already current", () => {
    const generated = renderFlake(info);
    const probe = fakeProbe({ "flake.nix": generated });
    const plan = buildPlan(
      info,
      generated,
      { output: "flake.nix", force: false, envrc: false },
      probe,
    );

    expect(plan.actions).toEqual([]);
  });

  it("updates legacy markers and keeps edits outside the block", () => {
    const generated = renderFlake(info);
    const existing = generated
      .replace("# >>> nix-flake-generate:packages", LEGACY_PACKAGES_BEGIN)
      .replace("# <<< nix-flake-generate:packages", LEGACY_PACKAGES_END)
      .replace(
        "            shellHook = ''",
        "            # hand written\n            shellHook = ''",
      );
    const probe = fakeProbe({ "flake.nix": existing });
    const plan = buildPlan(
      info,
      generated,
      { output: "flake.nix", force: false, envrc: false },
      probe,
    );

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]?.content).toContain("# >>> nix-flake-generate:packages");
    expect(plan.actions[0]?.content).toContain("# hand written");
  });

  it("skips an unmanaged file unless forced", () => {
    const probe = fakeProbe({ "flake.nix": "# hand written\n", ".envrc": "use flake\n" });
    const plan = buildPlan(info, "new", { output: "flake.nix", force: false, envrc: true }, probe);

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toContain("flake.nix already exists; skipped (use --force to overwrite)");
  });

  it("replaces an unmanaged file when forced", () => {
    const probe = fakeProbe({ "flake.nix": "old", ".envrc": "use flake\n" });
    const plan = buildPlan(info, "new", { output: "flake.nix", force: true, envrc: true }, probe);

    expect(plan.actions.map((action) => action.path)).toEqual(["flake.nix"]);
    expect(plan.actions[0]?.content).toBe("new");
  });
});

describe("diffPlan", () => {
  const plan: Plan = {
    actions: [
      { kind: "write", path: "flake.nix", label: "flake.nix", content: "new" },
      { kind: "write", path: ".envrc", label: ".envrc", content: "use flake\n" },
    ],
    warnings: [],
  };

  it("reports only missing or changed files", () => {
    expect(diffPlan(plan, fakeProbe({ "flake.nix": "old", ".envrc": "use flake\n" }))).toEqual([
      "flake.nix",
    ]);
    expect(diffPlan(plan, fakeProbe({ "flake.nix": "new", ".envrc": "use flake\n" }))).toEqual([]);
    expect(diffPlan(plan, fakeProbe({ ".envrc": "use flake\n" }))).toEqual(["flake.nix"]);
  });
});

describe("diffText", () => {
  it("renders a new file as additions from /dev/null", () => {
    expect(diffText("flake.nix", undefined, "a\nb\n")).toBe(
      "--- /dev/null\n+++ b/flake.nix\n@@ -1,0 +1,2 @@\n+a\n+b",
    );
  });

  it("renders a changed line with context", () => {
    expect(diffText("flake.nix", "a\nold\nc\n", "a\nnew\nc\n")).toBe(
      "--- a/flake.nix\n+++ b/flake.nix\n@@ -1,3 +1,3 @@\n a\n-old\n+new\n c",
    );
  });

  it("returns an empty string when the contents match", () => {
    expect(diffText("flake.nix", "same\n", "same\n")).toBe("");
  });

  it("keeps two context lines around a change", () => {
    const before = `${Array.from({ length: 10 }, (_, index) => `line ${index}`).join("\n")}\n`;
    const after = before.replace("line 5\n", "changed\n");
    expect(diffText("flake.nix", before, after)).toBe(
      "--- a/flake.nix\n+++ b/flake.nix\n@@ -1,10 +1,10 @@\n" +
        " line 3\n line 4\n-line 5\n+changed\n line 6\n line 7",
    );
  });
});

describe("applyPlan", () => {
  it("writes files atomically", async () => {
    const dir = await tempDir();
    const plan = buildPlan(
      { name: "demo", detections: [], warnings: [] },
      "flake contents\n",
      { output: "flake.nix", force: false, envrc: false },
      fakeProbe({}),
    );

    expect(await applyPlan(dir, plan)).toEqual(["flake.nix"]);
    expect(await readFile(join(dir, "flake.nix"), "utf8")).toBe("flake contents\n");
  });

  it("uses 644 for new files and preserves an existing mode", async () => {
    const dir = await tempDir();
    const plan = buildPlan(
      { name: "demo", detections: [], warnings: [] },
      "flake contents\n",
      { output: "flake.nix", force: false, envrc: false },
      fakeProbe({}),
    );

    await applyPlan(dir, plan);
    expect((await stat(join(dir, "flake.nix"))).mode & 0o777).toBe(0o644);

    await chmod(join(dir, "flake.nix"), 0o600);
    await applyPlan(dir, plan);
    expect((await stat(join(dir, "flake.nix"))).mode & 0o777).toBe(0o600);
  });

  it("creates parent directories for a nested output path", async () => {
    const dir = await tempDir();
    const plan = buildPlan(
      { name: "demo", detections: [], warnings: [] },
      "flake contents\n",
      { output: "config/flake.nix", force: false, envrc: false },
      fakeProbe({}),
    );

    expect(await applyPlan(dir, plan)).toEqual(["config/flake.nix"]);
    expect(await readFile(join(dir, "config/flake.nix"), "utf8")).toBe("flake contents\n");
  });

  it("skips a symlink destination in the plan even with force", async () => {
    const dir = await tempDir();
    await symlink("target", join(dir, "flake.nix"));
    const plan = buildPlan(
      { name: "demo", detections: [], warnings: [] },
      "flake contents\n",
      { output: "flake.nix", force: true, envrc: false },
      createNodeFsProbe(dir),
    );

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toContain("flake.nix is not a regular file; skipped");
  });

  it("validates every target before writing the first file", async () => {
    const dir = await tempDir();
    await mkdir(join(dir, "blocked"));
    const plan: Plan = {
      actions: [
        { kind: "write", path: "flake.nix", label: "flake.nix", content: "first" },
        { kind: "write", path: "blocked", label: "blocked", content: "second" },
      ],
      warnings: [],
    };

    await expect(applyPlan(dir, plan)).rejects.toThrow("blocked is not a regular file");
    await expect(readFile(join(dir, "flake.nix"))).rejects.toThrow();
  });
});

describe("writable target validation", () => {
  it("rejects a symlink in a parent directory", async () => {
    const dir = await tempDir();
    const outside = await tempDir();
    await writeFile(join(outside, "flake.nix"), "SENTINEL\n");
    await symlink(outside, join(dir, "link"));

    await expect(writeFileAtomic(dir, "link/flake.nix", "generated\n")).rejects.toThrow(
      "link is a symlink",
    );
    expect(await readFile(join(outside, "flake.nix"), "utf8")).toBe("SENTINEL\n");
  });

  it("rejects a file used as a parent directory", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "config"), "not a directory");

    await expect(assertWritableTarget(dir, "config/flake.nix")).rejects.toThrow(
      "config is not a directory",
    );
  });

  it("rejects a symlink as the final target", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "target"), "SENTINEL\n");
    await symlink(join(dir, "target"), join(dir, "flake.nix"));

    await expect(writeFileAtomic(dir, "flake.nix", "generated\n")).rejects.toThrow(
      "flake.nix is a symlink",
    );
    expect(await readFile(join(dir, "target"), "utf8")).toBe("SENTINEL\n");
  });

  it("writes through freshly created parent directories", async () => {
    const dir = await tempDir();
    await writeFileAtomic(dir, "a/b/flake.nix", "generated\n");
    expect(await readFile(join(dir, "a/b/flake.nix"), "utf8")).toBe("generated\n");
  });
});

describe("generate", () => {
  it("rejects an output path that collides with .envrc", async () => {
    const dir = await tempDir();
    await expect(
      generate({
        dir,
        output: "./.envrc",
        force: false,
        envrc: true,
        dryRun: true,
        stdout: false,
      }),
    ).rejects.toThrow("cannot be used with -o .envrc");
  });

  it("applies .nix-flake-generate.json config", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "pnpm-lock.yaml"), "");
    await writeFile(join(dir, "Cargo.toml"), "");
    await writeFile(
      join(dir, ".nix-flake-generate.json"),
      JSON.stringify({
        systems: ["x86_64-linux"],
        nixpkgs: "github:NixOS/nixpkgs/25.05",
        description: "custom env",
        extraPackages: ["hello", "git"],
        disabledDetectors: ["rust"],
      }),
    );

    const result = await generate({
      dir,
      output: "flake.nix",
      force: false,
      envrc: false,
      dryRun: true,
      stdout: false,
    });

    expect(result.flake).toContain('description = "custom env";');
    expect(result.flake).toContain('nixpkgs.url = "github:NixOS/nixpkgs/25.05";');
    expect(result.flake).toContain('"x86_64-linux"');
    expect(result.flake).not.toContain('"aarch64-darwin"');
    expect(result.flake).toContain("pkgs.hello");
    expect(result.flake).toContain("pkgs.git");
    expect(result.flake).not.toContain("pkgs.cargo");
    expect(result.info.detections.map((item) => item.ecosystem)).toEqual(["node"]);
  });

  it("reads config from the package.json field", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "pnpm-lock.yaml"), "");
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ "nix-flake-generate": { extraPackages: ["jq"] } }),
    );

    const result = await generate({
      dir,
      output: "flake.nix",
      force: false,
      envrc: false,
      dryRun: true,
      stdout: false,
    });
    expect(result.flake).toContain("pkgs.jq");
  });

  it("still reads the legacy config file and package.json field", async () => {
    const fileDir = await tempDir();
    await writeFile(join(fileDir, "pnpm-lock.yaml"), "");
    await writeFile(join(fileDir, ".flake-generate.json"), '{"extraPackages": ["hello"]}');

    const fieldDir = await tempDir();
    await writeFile(join(fieldDir, "pnpm-lock.yaml"), "");
    await writeFile(
      join(fieldDir, "package.json"),
      '{"flake-generate": {"extraPackages": ["jq"]}}',
    );

    const input = {
      output: "flake.nix",
      force: false,
      envrc: false,
      dryRun: true,
      stdout: false,
    };
    const fromFile = await generate({ ...input, dir: fileDir });
    const fromField = await generate({ ...input, dir: fieldDir });
    expect(fromFile.flake).toContain("pkgs.hello");
    expect(fromField.flake).toContain("pkgs.jq");
  });

  it("rejects an invalid config", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, ".nix-flake-generate.json"), '{"bogus": true}');

    await expect(
      generate({
        dir,
        output: "flake.nix",
        force: false,
        envrc: false,
        dryRun: true,
        stdout: false,
      }),
    ).rejects.toThrow("unknown config key: bogus");
  });

  it("does not write in dry-run or stdout mode", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "pnpm-lock.yaml"), "");
    const input = {
      dir,
      output: "flake.nix",
      force: false,
      envrc: false,
      dryRun: true,
      stdout: false,
    };

    const dry = await generate(input);
    expect(dry.plan.actions).toHaveLength(1);
    expect(dry.written).toEqual([]);

    const printed = await generate({ ...input, dryRun: false, stdout: true });
    expect(printed.flake).toContain("pkgs.pnpm");
    expect(printed.written).toEqual([]);
    await expect(readFile(join(dir, "flake.nix"))).rejects.toThrow();
  });

  it("writes once and leaves a managed flake up to date", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "pnpm-lock.yaml"), "");
    const input = {
      dir,
      output: "flake.nix",
      force: false,
      envrc: true,
      dryRun: false,
      stdout: false,
    };

    const first = await generate(input);
    expect(first.written).toEqual(["flake.nix", ".envrc"]);

    const second = await generate(input);
    expect(second.written).toEqual([]);
    expect(second.plan.warnings).toEqual([]);
    expect(await readFile(join(dir, ".envrc"), "utf8")).toBe("use flake\n");
  });

  it("needs --force to replace an unmanaged flake", async () => {
    const dir = await tempDir();
    await writeFile(join(dir, "flake.nix"), "# hand written\n");
    const input = {
      dir,
      output: "flake.nix",
      force: false,
      envrc: false,
      dryRun: false,
      stdout: false,
    };

    const skipped = await generate(input);
    expect(skipped.written).toEqual([]);
    expect(skipped.plan.warnings).toContain(
      "flake.nix already exists; skipped (use --force to overwrite)",
    );

    const forced = await generate({ ...input, force: true });
    expect(forced.written).toEqual(["flake.nix"]);
  });

  it("rejects unsafe output paths", async () => {
    const dir = await tempDir();
    await expect(
      generate({
        dir,
        output: "../flake.nix",
        force: false,
        envrc: false,
        dryRun: true,
        stdout: false,
      }),
    ).rejects.toThrow("invalid output path");
  });

  it("rejects a missing or non-directory target", async () => {
    const dir = await tempDir();
    const input = {
      dir: join(dir, "missing"),
      output: "flake.nix",
      force: false,
      envrc: false,
      dryRun: true,
      stdout: false,
    };

    await expect(generate(input)).rejects.toThrow("not a directory");

    await writeFile(join(dir, "file"), "");
    await expect(generate({ ...input, dir: join(dir, "file") })).rejects.toThrow("not a directory");
  });
});
