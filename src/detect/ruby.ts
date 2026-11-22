import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectRuby(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["Gemfile.lock", "Gemfile"]);
  if (markers.length === 0) return null;

  return {
    ecosystem: "ruby",
    label: "Ruby",
    markers,
    packages: ["bundler", "ruby"],
    notes: [],
  };
}
