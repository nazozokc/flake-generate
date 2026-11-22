import { describe, expect, it } from "vitest";
import type { Detection } from "../types.js";
import {
  colorizeDiff,
  createUi,
  detectionLine,
  header,
  info,
  limitDiff,
  success,
  summary,
  warning,
} from "../ui.js";

const node: Detection = {
  ecosystem: "node",
  label: "Node.js",
  markers: ["pnpm-lock.yaml", "tsconfig.json"],
  packages: ["nodejs_24", "pnpm", "typescript"],
  notes: [],
};

describe("createUi", () => {
  it("leaves text unchanged without color", () => {
    expect(createUi(false, false).style("bold", "hello")).toBe("hello");
  });

  it("wraps text in ANSI codes when color is forced", () => {
    expect(createUi(false, true).style("bold", "hello")).toBe("\u001b[1mhello\u001b[0m");
  });
});

describe("report lines", () => {
  it("renders a compact header", () => {
    expect(header(createUi(false, false), "0.1.0", "/app")).toBe("◇ flake-generate v0.1.0 · /app");
  });

  it("shows markers only in verbose mode", () => {
    expect(detectionLine(createUi(false, false), node)).toBe(
      "◆ Node.js         nodejs_24, pnpm, typescript",
    );
    expect(detectionLine(createUi(true, false), node)).toBe(
      "◆ Node.js         nodejs_24, pnpm, typescript\n" +
        "  markers         pnpm-lock.yaml, tsconfig.json",
    );
  });

  it("prefixes warnings, info, success and summary", () => {
    const ui = createUi(false, false);
    expect(warning(ui, "careful")).toBe("! warning: careful");
    expect(info(ui, "would write flake.nix")).toBe("→ would write flake.nix");
    expect(success(ui, "wrote flake.nix")).toBe("✓ wrote flake.nix");
    expect(summary(ui, "1 ecosystem")).toBe("  1 ecosystem");
  });
});

describe("diff presentation", () => {
  it("colors headers and payload lines differently", () => {
    const diff = "--- /dev/null\n+++ b/flake.nix\n@@ -1,0 +1,1 @@\n+added\n-removed\n same";
    expect(colorizeDiff(createUi(false, true), diff)).toBe(
      "\u001b[2m--- /dev/null\u001b[0m\n" +
        "\u001b[2m+++ b/flake.nix\u001b[0m\n" +
        "\u001b[2m@@ -1,0 +1,1 @@\u001b[0m\n" +
        "\u001b[32m+added\u001b[0m\n" +
        "\u001b[31m-removed\u001b[0m\n" +
        " same",
    );
  });

  it("truncates long diffs with a hint", () => {
    const diff = Array.from({ length: 25 }, (_, index) => `line ${index}`).join("\n");
    expect(limitDiff(diff, 3)).toBe("line 0\nline 1\nline 2\n  … 22 more lines (use --verbose)");
  });
});
