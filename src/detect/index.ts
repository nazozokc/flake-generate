import type { Detection, Ecosystem, FsProbe, ProjectInfo } from "../types.js";
import { detectDeno } from "./deno.js";
import { detectElixir } from "./elixir.js";
import { detectGo } from "./go.js";
import { detectJvm } from "./jvm.js";
import { detectNode } from "./node.js";
import { detectPhp } from "./php.js";
import { detectPython } from "./python.js";
import { detectRuby } from "./ruby.js";
import { detectRust } from "./rust.js";

const DETECTORS: readonly {
  ecosystem: Ecosystem;
  detect: (probe: FsProbe) => Detection | null;
}[] = [
  { ecosystem: "node", detect: detectNode },
  { ecosystem: "deno", detect: detectDeno },
  { ecosystem: "rust", detect: detectRust },
  { ecosystem: "go", detect: detectGo },
  { ecosystem: "python", detect: detectPython },
  { ecosystem: "ruby", detect: detectRuby },
  { ecosystem: "php", detect: detectPhp },
  { ecosystem: "jvm", detect: detectJvm },
  { ecosystem: "elixir", detect: detectElixir },
];

export interface DetectOptions {
  disabled?: readonly Ecosystem[];
}

export function detectProject(
  probe: FsProbe,
  directoryName: string,
  options: DetectOptions = {},
): ProjectInfo {
  const disabled = new Set<Ecosystem>(options.disabled ?? []);
  const detections = DETECTORS.filter((item) => !disabled.has(item.ecosystem))
    .map((item) => item.detect(probe))
    .filter((value): value is Detection => value !== null);
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
