import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { firstLine, PYTHON_ATTRIBUTES, pythonMinorVersion } from "./versions.js";

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
  const attribute = version === undefined ? undefined : PYTHON_ATTRIBUTES[version];
  const packages: string[] = [];
  const notes: string[] = [];

  if (attribute !== undefined) {
    packages.push(attribute);
  } else {
    packages.push("python3");
    if (version !== undefined) {
      notes.push(`Python 3.${version} has no known nixpkgs attribute; using python3`);
    }
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
