import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { goMinorVersion, versionedPackage } from "./versions.js";

export function detectGo(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "go", ["go.mod", "go.sum", "go.work"]);
  if (markers.length === 0) return null;

  const version = goMinorVersion(probe.readText("go.mod") ?? tools.go);
  const go = version === undefined ? "pkgs.go" : versionedPackage(`go_1_${version}`, "go");

  return {
    ecosystem: "go",
    label: "Go",
    markers,
    packages: [go, "gopls"],
    notes: [],
  };
}
