import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectDeno(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["deno.json", "deno.jsonc", "deno.lock"]);
  if (markers.length === 0) return null;

  return {
    ecosystem: "deno",
    label: "Deno",
    markers,
    packages: ["deno"],
    notes: [],
  };
}
