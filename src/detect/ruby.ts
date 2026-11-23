import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { firstLine, rubyMinorVersion, versionedPackage } from "./versions.js";

export function detectRuby(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "ruby", ["Gemfile.lock", "Gemfile", ".ruby-version"]);
  if (markers.length === 0) return null;

  const version = rubyMinorVersion(firstLine(probe.readText(".ruby-version") ?? tools.ruby));
  const ruby = version === undefined ? "pkgs.ruby" : versionedPackage(`ruby_3_${version}`, "ruby");

  return {
    ecosystem: "ruby",
    label: "Ruby",
    markers,
    packages: ["bundler", ruby],
    notes: [],
  };
}
