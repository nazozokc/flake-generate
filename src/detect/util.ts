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

export function majorVersion(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const match = value.match(/v?(\d+)/);
  const major = match?.[1];
  return major === undefined ? undefined : Number(major);
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
