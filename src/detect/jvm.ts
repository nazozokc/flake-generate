import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { firstLine, JDK_ATTRIBUTES, majorVersion } from "./versions.js";

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
  const jdk = (version === undefined ? undefined : JDK_ATTRIBUTES[version]) ?? "jdk";
  const packages = [jdk];
  if (markers.some((marker) => marker !== "pom.xml" && marker !== ".java-version")) {
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
