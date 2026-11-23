#!/usr/bin/env bash
set -euo pipefail

SYSTEMS=(aarch64-darwin aarch64-linux x86_64-linux)

check_case() (
  local name="$1" marker="$2" value="$3"
  shift 3

  local dir
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' EXIT

  printf '%s\n' "$value" > "$dir/$marker"
  for extra in "$@"; do touch "$dir/$extra"; done

  node dist/index.js "$dir" > /dev/null 2>&1
  local system
  for system in "${SYSTEMS[@]}"; do
    if ! nix eval --no-write-lock-file "$dir#devShells.$system.default.nativeBuildInputs" \
      --json > /dev/null 2> "$dir/error"; then
      echo "FAILED: $name ($system)" >&2
      cat "$dir/error" >&2
      exit 1
    fi
  done
)

fixture="$(mktemp -d)"
trap 'rm -rf "$fixture"' EXIT

touch "$fixture/pnpm-lock.yaml" "$fixture/Cargo.toml" "$fixture/go.mod" \
  "$fixture/uv.lock" "$fixture/Gemfile.lock" "$fixture/composer.lock" \
  "$fixture/pom.xml" "$fixture/tsconfig.json" "$fixture/biome.json" \
  "$fixture/deno.json" "$fixture/mix.lock"
printf '24.11.0\n' > "$fixture/.nvmrc"
printf '3.13.1\n' > "$fixture/.python-version"
printf '3.4.2\n' > "$fixture/.ruby-version"
printf '21\n' > "$fixture/.java-version"
printf 'elixir: "~> 1.18"\n' > "$fixture/mix.exs"
printf '{"packageManager":"pnpm@12.9.0"}' > "$fixture/package.json"

node dist/index.js "$fixture" > /dev/null 2>&1
for system in "${SYSTEMS[@]}"; do
  nix eval --no-write-lock-file "$fixture#devShells.$system.default.nativeBuildInputs" \
    --json > /dev/null
done

node dist/index.js "$fixture" --check > /dev/null
printf '\n# hand written\n' >> "$fixture/flake.nix"
node dist/index.js "$fixture" --check > /dev/null

node -e '
const fs = require("node:fs");
const path = process.argv[1];
const content = fs.readFileSync(path, "utf8");
if (!content.includes("pkgs.nodejs_24")) throw new Error("expected pkgs.nodejs_24 in the managed block");
fs.writeFileSync(path, content.replace("pkgs.nodejs_24", "pkgs.nodejs_22"));
' "$fixture/flake.nix"
if node dist/index.js "$fixture" --check > /dev/null 2>&1; then
  echo "FAILED: --check did not detect a stale managed block" >&2
  exit 1
fi

rm -rf "$fixture"
trap - EXIT

for v in 22 24 26; do check_case "nodejs_$v" .nvmrc "$v.0.0" package.json; done
check_case "nodejs_99-fallback" .nvmrc "99.0.0" package.json
for v in 11 12 13 14 15; do check_case "python3$v" .python-version "3.$v.0" pyproject.toml; done
for v in 8 11 17 21 25; do check_case "jdk$v" .java-version "$v" pom.xml; done
check_case "ruby_3_4" .ruby-version "3.4.0" Gemfile
check_case "go_1_26" go.mod $'module example.com/app\n\ngo 1.26.3'
check_case "elixir_1_18" mix.exs 'elixir: "~> 1.18"' mix.lock
check_case "elixir_1_19" mix.exs 'elixir: "~> 1.19"' mix.lock

echo "generated flake evaluates on all default systems"
