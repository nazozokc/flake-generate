import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { elixirMinorVersion, majorVersion, versionedPackage } from "./versions.js";

export function detectElixir(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(
    probe,
    "erlang",
    toolMarkers(probe, "elixir", ["mix.lock", "mix.exs"]),
  );
  if (markers.length === 0) return null;

  const version =
    elixirMinorVersion(probe.readText("mix.exs")) ??
    (tools.elixir === undefined ? undefined : majorVersion(tools.elixir));
  const otp = majorVersion(tools.erlang) ?? 27;
  const notes: string[] = [];
  let elixir = "pkgs.elixir";
  if (version !== undefined && version < 18) {
    notes.push(`Elixir 1.${version} is too old for a versioned nixpkgs attribute; using elixir`);
  } else if (version !== undefined) {
    elixir = versionedPackage(`beam${otp}Packages.elixir_1_${version}`, "elixir");
  }

  return {
    ecosystem: "elixir",
    label: "Elixir",
    markers,
    packages: [elixir],
    notes,
  };
}
