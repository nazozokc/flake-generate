import type { FsProbe } from "../types.js";

export function existingMarkers(probe: FsProbe, candidates: readonly string[]): string[] {
  return candidates.filter((path) => probe.exists(path));
}

export function dedupe(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function packageJsonObject(probe: FsProbe): Record<string, unknown> | undefined {
  const value = probe.readJson("package.json");
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

export function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function hasDependency(
  pkg: Record<string, unknown> | undefined,
  field: "dependencies" | "devDependencies",
  name: string,
): boolean {
  const deps = pkg?.[field];
  if (typeof deps !== "object" || deps === null || Array.isArray(deps)) return false;
  return Object.hasOwn(deps, name);
}

export function toolVersions(probe: FsProbe): Record<string, string> {
  const tools: Record<string, string> = {};

  for (const line of probe.readText(".tool-versions")?.split(/\r?\n/) ?? []) {
    const [name, version] = line.trim().split(/\s+/);
    if (name === undefined || version === undefined || name.startsWith("#")) continue;
    tools[name] = version;
  }

  let inTools = false;
  for (const line of probe.readText("mise.toml")?.split(/\r?\n/) ?? []) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[")) {
      inTools = trimmed === "[tools]";
      continue;
    }
    if (!inTools) continue;
    const match = /^([\w-]+)\s*=\s*["']([^"']+)["']/.exec(trimmed);
    if (match?.[1] !== undefined && match[2] !== undefined) tools[match[1]] = match[2];
  }

  return tools;
}

export function toolMarkers(probe: FsProbe, tool: string, base: readonly string[]): string[] {
  const markers = existingMarkers(probe, base);
  if (!Object.hasOwn(toolVersions(probe), tool)) return markers;

  for (const file of [".tool-versions", "mise.toml"]) {
    if (probe.exists(file) && !markers.includes(file)) markers.push(file);
  }
  return markers;
}
