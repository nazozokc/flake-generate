import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectJvm(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, [
    "gradlew",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "pom.xml",
  ]);
  if (markers.length === 0) return null;

  const packages = ["jdk"];
  if (markers.some((marker) => marker !== "pom.xml")) packages.push("gradle");
  if (markers.includes("pom.xml")) packages.push("maven");

  return {
    ecosystem: "jvm",
    label: "JVM",
    markers,
    packages,
    notes: [],
  };
}
