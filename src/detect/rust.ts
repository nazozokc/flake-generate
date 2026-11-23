import type { Detection, FsProbe } from "../types.js";
import { toolMarkers, toolVersions } from "./util.js";
import { rustMinorVersion, rustVersion } from "./versions.js";

export function detectRust(probe: FsProbe): Detection | null {
  const tools = toolVersions(probe);
  const markers = toolMarkers(probe, "rust", [
    "Cargo.lock",
    "Cargo.toml",
    "rust-toolchain.toml",
    "rust-toolchain",
  ]);
  if (markers.length === 0) return null;

  const versionText =
    probe.readText("rust-toolchain.toml") ?? probe.readText("rust-toolchain") ?? tools.rust;
  const version = rustMinorVersion(rustVersion(versionText));
  const notes =
    version === undefined
      ? []
      : [`Rust 1.${version} is pinned; nixpkgs provides an unversioned toolchain`];

  return {
    ecosystem: "rust",
    label: "Rust",
    markers,
    packages: ["cargo", "clippy", "rust-analyzer", "rustc", "rustfmt"],
    notes,
  };
}
