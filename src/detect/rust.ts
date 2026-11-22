import type { Detection, FsProbe } from "../types.js";
import { existingMarkers } from "./util.js";

export function detectRust(probe: FsProbe): Detection | null {
  const markers = existingMarkers(probe, ["Cargo.lock", "Cargo.toml", "rust-toolchain.toml"]);
  if (markers.length === 0) return null;

  return {
    ecosystem: "rust",
    label: "Rust",
    markers,
    packages: ["cargo", "clippy", "rust-analyzer", "rustc", "rustfmt"],
    notes: [],
  };
}
