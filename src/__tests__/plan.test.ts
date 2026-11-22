import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../cli.js";
import { createNodeFsProbe } from "../fs.js";
import { applyPlan, buildPlan } from "../plan.js";
import { fakeProbe } from "./helpers.js";

const directories: string[] = [];

async function tempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "flake-generate-"));
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

  it("skips existing files unless forced", () => {
    const probe = fakeProbe({ "flake.nix": "old", ".envrc": "old" });
    const plan = buildPlan(info, "new", { output: "flake.nix", force: false, envrc: true }, probe);

    expect(plan.actions).toEqual([]);
    expect(plan.warnings).toContain("flake.nix already exists; skipped (use --force to overwrite)");
    expect(plan.warnings).toContain(".envrc already exists; skipped (use --force to overwrite)");
  });

  it("includes both files when forced", () => {
    const probe = fakeProbe({ "flake.nix": "old", ".envrc": "old" });
    const plan = buildPlan(info, "new", { output: "flake.nix", force: true, envrc: true }, probe);

    expect(plan.actions.map((action) => action.path)).toEqual(["flake.nix", ".envrc"]);
    expect(plan.actions[1]?.content).toBe("use flake\n");
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

  it("refuses a symlink destination even with force", async () => {
    const dir = await tempDir();
    await symlink("target", join(dir, "flake.nix"));
    const plan = buildPlan(
      { name: "demo", detections: [], warnings: [] },
      "flake contents\n",
      { output: "flake.nix", force: true, envrc: false },
      createNodeFsProbe(dir),
    );

    await expect(applyPlan(dir, plan)).rejects.toThrow("flake.nix is not a regular file");
  });
});

describe("generate", () => {
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

  it("writes and then protects an existing flake", async () => {
    const dir = await tempDir();
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
    expect(second.plan.warnings).toContain(
      "flake.nix already exists; skipped (use --force to overwrite)",
    );

    const forced = await generate({ ...input, force: true });
    expect(forced.written).toEqual(["flake.nix", ".envrc"]);
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
});
