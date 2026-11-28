#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

cd "$repo"
tarball="$(npm pack --pack-destination "$work" --silent)"
project="$work/project"
mkdir "$project"

npm install --prefix "$project" --no-audit --no-fund "$work/$tarball"
binary="$project/node_modules/.bin/nix-flake-generate"
expected="$(node -p 'require("./package.json").version')"

actual="$("$binary" --version)"
if [[ "$actual" != *"$expected"* ]]; then
  echo "FAILED: packed CLI reported '$actual', expected version $expected" >&2
  exit 1
fi

touch "$project/pnpm-lock.yaml"
"$binary" "$project" > /dev/null
"$binary" "$project" --check > /dev/null

echo "packed CLI works (v$expected)"
