import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { majorVersion } from "./versions.js";

export function detectDeno(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "deno", ["deno.json", "deno.jsonc", "deno.lock"]);
  if (markers.length === 0) return null;

  const version = majorVersion(tools.deno);
  const notes =
    version === undefined
      ? []
      : [`Deno ${version} is pinned; nixpkgs provides an unversioned deno`];

  return {
    ecosystem: "deno",
    label: "Deno",
    markers,
    packages: ["deno"],
    notes,
  };
}
