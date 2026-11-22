export type Ecosystem =
  | "node"
  | "deno"
  | "rust"
  | "go"
  | "python"
  | "ruby"
  | "php"
  | "jvm"
  | "elixir";

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
