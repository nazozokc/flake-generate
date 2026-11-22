import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { packageVersion } from "../cli.js";

describe("packageVersion", () => {
  it("follows package.json so releases never drift", () => {
    const pkg = JSON.parse(
      readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
    ) as { version: string };

    expect(packageVersion()).toBe(pkg.version);
  });
});
