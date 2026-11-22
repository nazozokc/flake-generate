import { describe, expect, it } from "vitest";
import { detectDeno } from "../detect/deno.js";
import { detectElixir } from "../detect/elixir.js";
import { detectGo } from "../detect/go.js";
import { detectProject } from "../detect/index.js";
import { detectJvm } from "../detect/jvm.js";
import { detectNode } from "../detect/node.js";
import { detectPhp } from "../detect/php.js";
import { detectPython } from "../detect/python.js";
import { detectRuby } from "../detect/ruby.js";
import { detectRust } from "../detect/rust.js";
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

  it("detects Deno", () => {
    const detection = detectDeno(fakeProbe({ "deno.json": "{}", "deno.lock": "" }));

    expect(detection?.packages).toEqual(["deno"]);
    expect(detection?.markers).toEqual(["deno.json", "deno.lock"]);
  });

  it("detects Rust", () => {
    const detection = detectRust(fakeProbe({ "Cargo.lock": "", "rust-toolchain.toml": "" }));

    expect(detection?.packages).toEqual(["cargo", "clippy", "rust-analyzer", "rustc", "rustfmt"]);
    expect(detection?.markers).toEqual(["Cargo.lock", "rust-toolchain.toml"]);
  });

  it("detects Go", () => {
    const detection = detectGo(fakeProbe({ "go.mod": "module app", "go.sum": "" }));

    expect(detection?.packages).toEqual(["go", "gopls"]);
    expect(detection?.markers).toEqual(["go.mod", "go.sum"]);
  });

  it("uses the pinned Ruby version", () => {
    const detection = detectRuby(fakeProbe({ "Gemfile.lock": "", ".ruby-version": "3.4.2\n" }));

    expect(detection?.packages).toEqual(["bundler", "ruby_3_4"]);
    expect(detection?.markers).toContain(".ruby-version");
  });

  it("detects PHP", () => {
    const detection = detectPhp(fakeProbe({ "composer.lock": "", "composer.json": "{}" }));

    expect(detection?.packages).toEqual(["php", "phpPackages.composer"]);
  });

  it("reads the Elixir version from mix.exs", () => {
    const detection = detectElixir(
      fakeProbe({ "mix.exs": 'def project do\n  elixir: "~> 1.18",\nend', "mix.lock": "" }),
    );

    expect(detection?.packages).toEqual(["beam27Packages.elixir_1_18"]);
    expect(detection?.notes).toEqual([]);
  });

  it("uses the pinned JDK version", () => {
    const detection = detectJvm(fakeProbe({ "pom.xml": "", ".java-version": "21\n" }));

    expect(detection?.packages).toEqual(["jdk21", "maven"]);
  });
});

describe("tool version files", () => {
  it("reads Node from mise.toml", () => {
    const detection = detectNode(
      fakeProbe({
        "package.json": "{}",
        "mise.toml": '[tools]\nnodejs = "24.11.0"\npython = "3.12"\n',
      }),
    );

    expect(detection?.packages).toContain("nodejs_24");
    expect(detection?.markers).toContain("mise.toml");
    expect(detection?.markers).not.toContain(".tool-versions");
  });

  it("reads Python from .tool-versions", () => {
    const detection = detectPython(
      fakeProbe({ "pyproject.toml": "", ".tool-versions": "python 3.14.0\n" }),
    );

    expect(detection?.packages).toEqual(["python314", "ruff"]);
    expect(detection?.markers).toContain(".tool-versions");
  });

  it("falls back with a note for unsupported versions", () => {
    const ruby = detectRuby(fakeProbe({ Gemfile: "", ".ruby-version": "3.3.0" }));
    const python = detectPython(fakeProbe({ "pyproject.toml": "", ".python-version": "3.9.1" }));
    const jvm = detectJvm(fakeProbe({ "pom.xml": "", ".java-version": "19" }));

    expect(ruby?.packages).toEqual(["bundler", "ruby"]);
    expect(ruby?.notes).toEqual(["Ruby 3.3 has no known nixpkgs attribute; using ruby"]);
    expect(python?.packages).toEqual(["python3", "ruff"]);
    expect(jvm?.packages).toEqual(["jdk", "maven"]);
  });
});
