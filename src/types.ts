export const ECOSYSTEMS = [
  "node",
  "deno",
  "rust",
  "go",
  "python",
  "ruby",
  "php",
  "jvm",
  "elixir",
] as const;

export type Ecosystem = (typeof ECOSYSTEMS)[number];

export const DEFAULT_SYSTEMS = ["aarch64-darwin", "aarch64-linux", "x86_64-linux"] as const;

export const DEFAULT_NIXPKGS = "github:NixOS/nixpkgs/nixos-unstable";

export const PACKAGES_BEGIN = "# >>> flake-generate:packages";
export const PACKAGES_END = "# <<< flake-generate:packages";

export interface RenderOptions {
  systems?: readonly string[];
  nixpkgs?: string;
  description?: string;
  extraPackages?: readonly string[];
}

export interface Detection {
  ecosystem: Ecosystem;
  label: string;
  markers: string[];
  packages: string[];
  notes: string[];
}

export interface ProjectInfo {
  name: string;
  detections: Detection[];
  warnings: string[];
}

export type PathKind = "missing" | "file" | "other";

export interface FsProbe {
  exists(path: string): boolean;
  kind(path: string): PathKind;
  readText(path: string): string | undefined;
  readJson(path: string): unknown | undefined;
}

export interface WriteAction {
  kind: "write";
  path: string;
  label: string;
  content: string;
}

export interface Plan {
  actions: WriteAction[];
  warnings: string[];
}

export interface BuildPlanOptions {
  output: string;
  force: boolean;
  envrc: boolean;
}
