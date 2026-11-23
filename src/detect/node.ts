import type { Detection, FsProbe } from "../types.js";
import {
  dedupe,
  existingMarkers,
  hasDependency,
  packageJsonObject,
  stringField,
  toolMarkers,
  toolVersions,
} from "./util.js";
import { firstLine, majorVersion, minimumMajorFromRange, versionedPackage } from "./versions.js";

const LOCKFILES = [
  "pnpm-lock.yaml",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "bun.lock",
  "bun.lockb",
] as const;

const MANAGERS = new Set(["npm", "pnpm", "yarn", "bun"]);

function declaredManager(pkg: Record<string, unknown> | undefined): string | undefined {
  const value = stringField(pkg?.packageManager)?.split("@")[0];
  return value !== undefined && MANAGERS.has(value) ? value : undefined;
}

function lockfileManager(lockfile: string): string | undefined {
  if (lockfile === "pnpm-lock.yaml") return "pnpm";
  if (lockfile === "yarn.lock") return "yarn";
  if (lockfile === "bun.lock" || lockfile === "bun.lockb") return "bun";
  return undefined;
}

export function detectNode(probe: FsProbe): Detection | null {
  const locks = existingMarkers(probe, LOCKFILES);
  const hasPackageJson = probe.exists("package.json");
  if (locks.length === 0 && !hasPackageJson) return null;

  const pkg = packageJsonObject(probe);
  const manager = declaredManager(pkg) ?? locks.map(lockfileManager).find((v) => v !== undefined);
  const engines = pkg?.engines;
  const engineRange =
    typeof engines === "object" && engines !== null && !Array.isArray(engines)
      ? stringField((engines as Record<string, unknown>).node)
      : undefined;
  const pinned = firstLine(
    probe.readText(".nvmrc") ?? probe.readText(".node-version") ?? toolVersions(probe).nodejs,
  );
  const major = pinned !== undefined ? majorVersion(pinned) : minimumMajorFromRange(engineRange);

  const packages: string[] = [];
  const notes: string[] = [];
  if (major !== undefined && major < 18) {
    packages.push("pkgs.nodejs");
    notes.push(`Node ${major} is too old for a versioned nixpkgs attribute; using nodejs`);
  } else {
    packages.push(
      major === undefined ? "pkgs.nodejs" : versionedPackage(`nodejs_${major}`, "nodejs"),
    );
  }

  if (manager === "pnpm" || manager === "yarn" || manager === "bun") packages.push(manager);

  const typescript =
    probe.exists("tsconfig.json") ||
    hasDependency(pkg, "dependencies", "typescript") ||
    hasDependency(pkg, "devDependencies", "typescript");
  if (typescript) packages.push("typescript");

  if (probe.exists("biome.json") || probe.exists("biome.jsonc")) packages.push("biome");
  if (
    probe.exists(".prettierrc") ||
    probe.exists(".prettierrc.json") ||
    probe.exists("prettier.config.js") ||
    probe.exists("prettier.config.mjs")
  ) {
    packages.push("prettier");
  }

  return {
    ecosystem: "node",
    label: "Node.js",
    markers: toolMarkers(
      probe,
      "nodejs",
      dedupe([...locks, ...(hasPackageJson ? ["package.json"] : [])]),
    ),
    packages: dedupe(packages),
    notes,
  };
}
