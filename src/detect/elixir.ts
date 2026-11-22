import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";
import { ELIXIR_ATTRIBUTES, elixirMinorVersion } from "./versions.js";

export function detectElixir(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["mix.lock", "mix.exs"]);
  if (markers.length === 0) return null;

  const version = elixirMinorVersion(probe.readText("mix.exs"));
  const attribute = version === undefined ? undefined : ELIXIR_ATTRIBUTES[version];
  const notes: string[] = [];
  if (version !== undefined && attribute === undefined) {
    notes.push(`Elixir 1.${version} has no known nixpkgs attribute; using the pinned version`);
  }

  return {
    ecosystem: "elixir",
    label: "Elixir",
    markers,
    packages: [attribute ?? "beam27Packages.elixir_1_19"],
    notes,
  };
}
