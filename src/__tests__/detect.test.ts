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

    expect(detection?.packages).toEqual(["pkgs.nodejs_24 or pkgs.nodejs", "pnpm", "typescript"]);
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

  it("uses the lowest major from an engines range", () => {
    const detection = detectNode(
      fakeProbe({
        "package.json": '{"engines":{"node":">=18 <23"}}',
      }),
    );

    expect(detection?.packages).toContain("pkgs.nodejs_18 or pkgs.nodejs");
    expect(detection?.notes).toEqual([]);
  });

  it("uses the generic nodejs for an old major", () => {
    const detection = detectNode(fakeProbe({ ".nvmrc": "12.0.0", "package.json": "{}" }));

    expect(detection?.packages).toContain("pkgs.nodejs");
    expect(detection?.notes).toEqual([
      "Node 12 is too old for a versioned nixpkgs attribute; using nodejs",
    ]);
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

    expect(detection?.packages).toEqual(["pkgs.python312 or pkgs.python3", "uv", "ruff"]);
  });

  it("uses maven for pom.xml only", () => {
    const detection = detectJvm(fakeProbe({ "pom.xml": "" }));

    expect(detection?.packages).toEqual(["pkgs.jdk", "maven"]);
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
    expect(detection?.notes).toEqual([]);
  });

  it("detects Go", () => {
    const detection = detectGo(fakeProbe({ "go.mod": "module app", "go.sum": "" }));

    expect(detection?.packages).toEqual(["pkgs.go", "gopls"]);
    expect(detection?.markers).toEqual(["go.mod", "go.sum"]);
  });

  it("uses the pinned Ruby version", () => {
    const detection = detectRuby(fakeProbe({ "Gemfile.lock": "", ".ruby-version": "3.4.2\n" }));

    expect(detection?.packages).toEqual(["bundler", "pkgs.ruby_3_4 or pkgs.ruby"]);
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

    expect(detection?.packages).toEqual(["pkgs.beam27Packages.elixir_1_18 or pkgs.elixir"]);
    expect(detection?.notes).toEqual([]);
  });

  it("uses the pinned JDK version", () => {
    const detection = detectJvm(fakeProbe({ "pom.xml": "", ".java-version": "21\n" }));

    expect(detection?.packages).toEqual(["pkgs.jdk21 or pkgs.jdk", "maven"]);
  });

  it("maps a legacy Java 1.x version to its major", () => {
    const detection = detectJvm(fakeProbe({ "pom.xml": "", ".java-version": "1.8.0_392\n" }));

    expect(detection?.packages).toEqual(["pkgs.jdk8 or pkgs.jdk", "maven"]);
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

    expect(detection?.packages).toContain("pkgs.nodejs_24 or pkgs.nodejs");
    expect(detection?.markers).toContain("mise.toml");
    expect(detection?.markers).not.toContain(".tool-versions");
  });

  it("reads Python from .tool-versions", () => {
    const detection = detectPython(
      fakeProbe({ "pyproject.toml": "", ".tool-versions": "python 3.14.0\n" }),
    );

    expect(detection?.packages).toEqual(["pkgs.python314 or pkgs.python3", "ruff"]);
    expect(detection?.markers).toContain(".tool-versions");
  });

  it("falls back with notes for versions nixpkgs does not version", () => {
    const python = detectPython(fakeProbe({ "pyproject.toml": "", ".python-version": "3.9.1" }));

    expect(python?.packages).toEqual(["pkgs.python3", "ruff"]);
    expect(python?.notes).toEqual([
      "Python 3.9 is too old for a versioned nixpkgs attribute; using python3",
    ]);
  });
});

describe("P2 version readers", () => {
  it("reads the Go directive from go.mod", () => {
    const detection = detectGo(fakeProbe({ "go.mod": "module app\n\ngo 1.26.3\n" }));

    expect(detection?.packages).toContain("pkgs.go_1_26 or pkgs.go");
    expect(detection?.markers).toEqual(["go.mod"]);
  });

  it("reads Go from .tool-versions", () => {
    const detection = detectGo(fakeProbe({ "go.sum": "", ".tool-versions": "go 1.27.1\n" }));

    expect(detection?.packages).toContain("pkgs.go_1_27 or pkgs.go");
    expect(detection?.markers).toContain(".tool-versions");
  });

  it("reads the Rust channel from rust-toolchain.toml", () => {
    const detection = detectRust(
      fakeProbe({
        "Cargo.lock": "",
        "rust-toolchain.toml": '[toolchain]\nchannel = "1.82.0"\n',
      }),
    );

    expect(detection?.notes).toEqual([
      "Rust 1.82 is pinned; nixpkgs provides an unversioned toolchain",
    ]);
  });

  it("reads the pinned Deno version", () => {
    const detection = detectDeno(
      fakeProbe({ "deno.json": "{}", ".tool-versions": "deno 2.9.8\n" }),
    );

    expect(detection?.notes).toEqual(["Deno 2 is pinned; nixpkgs provides an unversioned deno"]);
    expect(detection?.markers).toContain(".tool-versions");
  });

  it("uses the pinned OTP series for the Elixir package set", () => {
    const detection = detectElixir(
      fakeProbe({
        "mix.exs": 'elixir: "~> 1.19"',
        "mix.lock": "",
        ".tool-versions": "erlang 28.0\n",
      }),
    );

    expect(detection?.packages).toEqual(["pkgs.beam28Packages.elixir_1_19 or pkgs.elixir"]);
    expect(detection?.markers).toContain(".tool-versions");
  });
});
