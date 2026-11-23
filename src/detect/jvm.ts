import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { firstLine, majorVersion, versionedPackage } from "./versions.js";

export function detectJvm(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "java", [
    "gradlew",
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "pom.xml",
    ".java-version",
  ]);
  if (markers.length === 0) return null;

  const version = majorVersion(firstLine(probe.readText(".java-version") ?? tools.java));
  const jdk =
    version === undefined || version < 8 ? "pkgs.jdk" : versionedPackage(`jdk${version}`, "jdk");
  const packages = [jdk];
  const versionFiles = new Set([".java-version", ".tool-versions", "mise.toml"]);
  if (markers.some((marker) => !versionFiles.has(marker) && marker !== "pom.xml")) {
    packages.push("gradle");
  }
  if (markers.includes("pom.xml")) packages.push("maven");

  return {
    ecosystem: "jvm",
    label: "JVM",
    markers,
    packages,
    notes: [],
  };
}
