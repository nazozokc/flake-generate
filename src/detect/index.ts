import type { Detection, FsProbe, ProjectInfo } from "../types.js";
import { detectElixir } from "./elixir.js";
import { detectGo } from "./go.js";
import { detectJvm } from "./jvm.js";
import { detectNode } from "./node.js";
import { detectPhp } from "./php.js";
import { detectPython } from "./python.js";
import { detectRuby } from "./ruby.js";
import { detectRust } from "./rust.js";

const DETECTORS: readonly ((probe: FsProbe) => Detection | null)[] = [
  detectNode,
  detectRust,
  detectGo,
  detectPython,
  detectRuby,
  detectPhp,
  detectJvm,
  detectElixir,
];

export function detectProject(probe: FsProbe, directoryName: string): ProjectInfo {
  const detections = DETECTORS.map((detect) => detect(probe)).filter(
    (value): value is Detection => value !== null,
  );
  const warnings: string[] = [];

  if (detections.length === 0) {
    warnings.push("No lockfiles or project markers found; generated an empty devShell.");
  }
  for (const detection of detections) {
    for (const note of detection.notes) {
      warnings.push(`${detection.label}: ${note}`);
    }
  }

  return {
    name: directoryName.length > 0 ? directoryName : "project",
    detections,
    warnings,
  };
}
