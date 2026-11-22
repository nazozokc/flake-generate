import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectElixir(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["mix.lock", "mix.exs"]);
  if (markers.length === 0) return null;

  return {
    ecosystem: "elixir",
    label: "Elixir",
    markers,
    packages: ["beam27Packages.elixir_1_19"],
    notes: ["Elixir version is pinned by nixpkgs; adjust the attribute if needed"],
  };
}
