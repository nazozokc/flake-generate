import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

const PYTHON_MAJORS = new Set([10, 11, 12, 13]);

function pythonVersion(value: string | undefined): number | undefined {
  const match = value?.match(/^\s*(\d+)\.(\d+)/);
  const minor = match?.[2];
  return minor === undefined ? undefined : Number(minor);
}

export function detectPython(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, [
    "uv.lock",
    "poetry.lock",
    "pyproject.toml",
    "requirements.txt",
    "Pipfile.lock",
    "setup.py",
    ".python-version",
  ]);
  if (markers.length === 0) return null;

  const version = pythonVersion(probe.readText(".python-version"));
  const packages: string[] = [];
  const notes: string[] = [];

  if (version !== undefined && PYTHON_MAJORS.has(version)) {
    packages.push(`python3${version}`);
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
