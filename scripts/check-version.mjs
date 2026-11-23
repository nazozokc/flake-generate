import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const packageUrl = new URL("../package.json", import.meta.url);
const pkg = JSON.parse(readFileSync(packageUrl, "utf8"));
const sync = process.argv.includes("--sync");

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value);
  if (match === null) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index] < right[index] ? -1 : 1;
  }
  return 0;
}

function latestReleaseVersion() {
  const tags = execFileSync("git", ["tag", "--list", "--sort=-v:refname"], {
    encoding: "utf8",
  })
    .trim()
    .split(/\r?\n/);
  for (const tag of tags) {
    const version = tag.replace(/^v/, "");
    if (parseVersion(version) !== undefined) return version;
  }
  return undefined;
}

const current = parseVersion(pkg.version);
if (current === undefined) {
  console.error(`invalid package.json version: ${pkg.version}`);
  process.exit(1);
}

const latest = latestReleaseVersion();
if (latest === undefined) {
  console.log("no release tags found; skipping version drift check");
  process.exit(0);
}

if (compareVersions(current, parseVersion(latest)) < 0) {
  if (sync) {
    pkg.version = latest;
    writeFileSync(packageUrl, `${JSON.stringify(pkg, null, 2)}\n`);
    console.log(`synced package.json version to ${latest}`);
  } else {
    console.error(
      `package.json version ${pkg.version} is behind latest release ${latest}; run pnpm version:sync`,
    );
    process.exit(1);
  }
} else {
  console.log(`version ok: ${pkg.version} (latest release ${latest})`);
}
