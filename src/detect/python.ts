import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { firstLine, pythonMinorVersion, versionedPackage } from "./versions.js";

export function detectPython(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "python", [
    "uv.lock",
    "poetry.lock",
    "pyproject.toml",
    "requirements.txt",
    "Pipfile.lock",
    "setup.py",
    ".python-version",
  ]);
  if (markers.length === 0) return null;

  const version = pythonMinorVersion(firstLine(probe.readText(".python-version") ?? tools.python));
  const packages: string[] = [];
  const notes: string[] = [];

  if (version !== undefined && version < 10) {
    packages.push("pkgs.python3");
    notes.push(`Python 3.${version} is too old for a versioned nixpkgs attribute; using python3`);
  } else {
    packages.push(
      version === undefined ? "pkgs.python3" : versionedPackage(`python3${version}`, "python3"),
    );
  }

  if (markers.includes("uv.lock")) packages.push("uv");
  if (markers.includes("poetry.lock")) packages.push("poetry");
  packages.push("ruff");

  return {
    ecosystem: "python",
    label: "Python",
    markers,
    packages,
    notes,
  };
}
