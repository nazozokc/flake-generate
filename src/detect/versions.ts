export function firstLine(value: string | undefined): string | undefined {
  return value
    ?.split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("#"));
}

/** `pkgs.<attribute> or <fallback>` keeps older/newer nixpkgs from breaking eval. */
export function versionedPackage(attribute: string, fallback: string): string {
  return `pkgs.${attribute} or pkgs.${fallback}`;
}

export function majorVersion(value: string | undefined): number | undefined {
  const legacy = value?.match(/^1\.(\d+)/);
  if (legacy?.[1] !== undefined) return Number(legacy[1]);

  const match = value?.match(/v?(\d+)(?:\.\d+)*/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** Semver ranges pick the lowest requested major: `>=20 <23` -> 20. */
export function minimumMajorFromRange(value: string | undefined): number | undefined {
  const majors = [...(value?.matchAll(/(\d+)(?:\.\d+)*/g) ?? [])]
    .map((match) => match[1])
    .filter((major): major is string => major !== undefined)
    .map(Number);
  return majors.length === 0 ? undefined : Math.min(...majors);
}

export function pythonMinorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/^3\.(\d+)/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

export function rubyMinorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/^3\.(\d+)/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** For 1.x toolchains (Go, Rust) the second component is the versioned major. */
export function legacyMinorVersion(value: string | undefined): number | undefined {
  const directive = value?.match(/^\s*(?:go\s+)?1\.(\d+)/m);
  return directive?.[1] === undefined ? undefined : Number(directive[1]);
}

export function goMinorVersion(value: string | undefined): number | undefined {
  return legacyMinorVersion(value);
}

export function rustMinorVersion(value: string | undefined): number | undefined {
  return legacyMinorVersion(value);
}

export function rustVersion(value: string | undefined): string | undefined {
  const channel = value?.match(/^\s*channel\s*=\s*["']([^"']+)["']/m);
  return channel?.[1] ?? firstLine(value);
}

/** Accept both `elixir: "~> 1.18"` and mix.exs deps like `{:elixir, "~> 1.18"}`. */
export function elixirMinorVersion(value: string | undefined): number | undefined {
  const match = value?.match(/\belixir\b["']?\s*[,:]\s*["']~?>\s*\d+\.(\d+)/);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}
