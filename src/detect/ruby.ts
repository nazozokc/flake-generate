import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { firstLine, RUBY_ATTRIBUTES, rubyMinorVersion } from "./versions.js";

export function detectRuby(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "ruby", ["Gemfile.lock", "Gemfile", ".ruby-version"]);
  if (markers.length === 0) return null;

  const version = rubyMinorVersion(firstLine(probe.readText(".ruby-version") ?? tools.ruby));
  const attribute = version === undefined ? undefined : RUBY_ATTRIBUTES[version];
  const notes: string[] = [];
  if (version !== undefined && attribute === undefined) {
    notes.push(`Ruby 3.${version} has no known nixpkgs attribute; using ruby`);
  }

  return {
    ecosystem: "ruby",
    label: "Ruby",
    markers,
    packages: ["bundler", attribute ?? "ruby"],
    notes,
  };
}
