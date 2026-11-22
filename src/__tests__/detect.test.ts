import { describe, expect, it } from "vitest";
import { detectProject } from "../detect/index.js";
import { detectJvm } from "../detect/jvm.js";
import { detectNode } from "../detect/node.js";
import { detectPython } from "../detect/python.js";
import { fakeProbe } from "./helpers.js";

describe("detectNode", () => {
  it("reads lockfile, version file and tsconfig", () => {
    const detection = detectNode(
      fakeProbe({
        "pnpm-lock.yaml": "",
        "package.json": '{"name":"app"}',
        ".nvmrc": "24.11.0\n",
        "tsconfig.json": "{}",
      }),
    );

    expect(detection?.packages).toEqual(["nodejs_24", "pnpm", "typescript"]);
    expect(detection?.markers).toEqual(["pnpm-lock.yaml", "package.json"]);
  });

  it("prefers packageManager over the lockfile", () => {
    const detection = detectNode(
      fakeProbe({
        "yarn.lock": "",
        "package.json": '{"packageManager":"pnpm@10.0.0"}',
      }),
    );

    expect(detection?.packages).toContain("pnpm");
    expect(detection?.packages).not.toContain("yarn");
  });

  it("falls back to the generic nodejs attribute for unknown majors", () => {
    const detection = detectNode(
      fakeProbe({
        "package.json": '{"engines":{"node":">=99"}}',
      }),
    );

    expect(detection?.packages).toContain("nodejs");
    expect(detection?.notes).toEqual(["Node 99 has no known nixpkgs attribute; using nodejs"]);
  });

  it("returns null without Node markers", () => {
    expect(detectNode(fakeProbe({ "Cargo.toml": "" }))).toBeNull();
  });
});

describe("detectProject", () => {
  it("combines multiple ecosystems", () => {
    const info = detectProject(
      fakeProbe({
        "pnpm-lock.yaml": "",
        "Cargo.lock": "",
        "go.mod": "module example.com/app",
      }),
      "mixed-project",
    );

    expect(info.name).toBe("mixed-project");
    expect(info.detections.map((d) => d.ecosystem)).toEqual(["node", "rust", "go"]);
    expect(info.warnings).toEqual([]);
  });

  it("warns when nothing is detected", () => {
    const info = detectProject(fakeProbe({ "README.md": "# hi" }), "empty");

    expect(info.detections).toEqual([]);
    expect(info.warnings).toHaveLength(1);
  });
});

describe("other detectors", () => {
  it("uses uv and the pinned Python version", () => {
    const detection = detectPython(
      fakeProbe({ "uv.lock": "", "pyproject.toml": "", ".python-version": "3.12.1" }),
    );

    expect(detection?.packages).toEqual(["python312", "uv", "ruff"]);
  });

  it("uses maven for pom.xml only", () => {
    const detection = detectJvm(fakeProbe({ "pom.xml": "" }));

    expect(detection?.packages).toEqual(["jdk", "maven"]);
  });
});
