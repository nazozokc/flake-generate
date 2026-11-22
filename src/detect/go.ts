import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectGo(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["go.mod", "go.sum"]);
  if (markers.length === 0) return null;

  return {
    ecosystem: "go",
    label: "Go",
    markers,
    packages: ["go", "gopls"],
    notes: [],
  };
}
