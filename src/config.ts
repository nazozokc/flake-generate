import { CliError } from "./args.js";
import {
  DEFAULT_NIXPKGS,
  DEFAULT_SYSTEMS,
  ECOSYSTEMS,
  type Ecosystem,
  type FsProbe,
  type RenderOptions,
} from "./types.js";

export interface Config extends RenderOptions {
  systems: string[];
  nixpkgs: string;
  extraPackages: string[];
  disabledDetectors: Ecosystem[];
}

const KEYS = new Set(["systems", "nixpkgs", "description", "extraPackages", "disabledDetectors"]);

const ECOSYSTEM_SET = new Set<string>(ECOSYSTEMS);
const PACKAGE_NAME = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown, key: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new CliError(`invalid config: ${key} must be an array of non-empty strings`);
  }
  return value as string[];
}

function parseConfig(value: unknown): Config {
  const config: Config = {
    systems: [...DEFAULT_SYSTEMS],
    nixpkgs: DEFAULT_NIXPKGS,
    extraPackages: [],
    disabledDetectors: [],
  };
  if (value === undefined) return config;
  if (!isRecord(value)) throw new CliError("invalid config: expected a JSON object");

  const unknown = Object.keys(value).find((key) => !KEYS.has(key));
  if (unknown !== undefined) {
    throw new CliError(`unknown config key: ${unknown}`, `allowed: ${[...KEYS].join(", ")}`);
  }

  if (Object.hasOwn(value, "systems")) {
    const systems = stringArray(value.systems, "systems");
    if (systems.length === 0) throw new CliError("invalid config: systems must not be empty");
    config.systems = systems;
  }
  if (Object.hasOwn(value, "nixpkgs")) {
    const nixpkgs = value.nixpkgs;
    if (typeof nixpkgs !== "string" || nixpkgs.length === 0) {
      throw new CliError("invalid config: nixpkgs must be a non-empty string");
    }
    config.nixpkgs = nixpkgs;
  }
  if (Object.hasOwn(value, "description")) {
    const description = value.description;
    if (typeof description !== "string") {
      throw new CliError("invalid config: description must be a string");
    }
    config.description = description;
  }
  if (Object.hasOwn(value, "extraPackages")) {
    const extra = stringArray(value.extraPackages, "extraPackages");
    const invalid = extra.find((name) => !PACKAGE_NAME.test(name));
    if (invalid !== undefined) {
      throw new CliError(`invalid config: invalid package attribute: ${invalid}`);
    }
    config.extraPackages = extra;
  }
  if (Object.hasOwn(value, "disabledDetectors")) {
    const disabled = stringArray(value.disabledDetectors, "disabledDetectors");
    const invalid = disabled.find((name) => !ECOSYSTEM_SET.has(name));
    if (invalid !== undefined) {
      throw new CliError(`invalid config: unknown ecosystem: ${invalid}`);
    }
    config.disabledDetectors = disabled as Ecosystem[];
  }

  return config;
}

/** Load .flake-generate.json, falling back to the 'flake-generate' field in package.json. */
export function loadConfig(probe: FsProbe): Config {
  const text = probe.readText(".flake-generate.json");
  if (text !== undefined) {
    let raw: unknown;
    try {
      raw = JSON.parse(text) as unknown;
    } catch {
      throw new CliError("invalid .flake-generate.json", "expected valid JSON");
    }
    return parseConfig(raw);
  }

  const pkg = probe.readJson("package.json");
  return parseConfig(isRecord(pkg) ? pkg["flake-generate"] : undefined);
}
