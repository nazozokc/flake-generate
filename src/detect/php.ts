import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectPhp(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["composer.lock", "composer.json"]);
  if (markers.length === 0) return null;

  return {
    ecosystem: "php",
    label: "PHP",
    markers,
    packages: ["php", "phpPackages.composer"],
    notes: [],
  };
}
