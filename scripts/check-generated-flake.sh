#!/usr/bin/env bash
set -euo pipefail

check_case() (
  local name="$1" marker="$2" value="$3"
  shift 3

  local dir
  dir="$(mktemp -d)"
  trap 'rm -rf "$dir"' EXIT

  printf '%s\n' "$value" > "$dir/$marker"
  for extra in "$@"; do touch "$dir/$extra"; done

  node dist/index.js "$dir" > /dev/null
  if ! nix eval --no-write-lock-file "$dir#devShells.x86_64-linux.default.nativeBuildInputs" \
    --json > /dev/null 2> "$dir/error"; then
    echo "FAILED: $name" >&2
    cat "$dir/error" >&2
    exit 1
  fi
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

node dist/index.js "$fixture" > /dev/null
nix eval --no-write-lock-file "$fixture#devShells.x86_64-linux.default.nativeBuildInputs" \
  --json > /dev/null

node dist/index.js "$fixture" --check > /dev/null
printf '\n# changed\n' >> "$fixture/flake.nix"
if node dist/index.js "$fixture" --check > /dev/null 2>&1; then
  echo "FAILED: --check did not detect a stale flake" >&2
  exit 1
fi

rm -rf "$fixture"
trap - EXIT

for v in 22 24 26; do check_case "nodejs_$v" .nvmrc "$v.0.0" package.json; done
for v in 11 12 13 14; do check_case "python3$v" .python-version "3.$v.0" pyproject.toml; done
for v in 8 11 17 21 25; do check_case "jdk$v" .java-version "$v" pom.xml; done
check_case "ruby_3_4" .ruby-version "3.4.0" Gemfile
check_case "elixir_1_18" mix.exs 'elixir: "~> 1.18"' mix.lock
check_case "elixir_1_19" mix.exs 'elixir: "~> 1.19"' mix.lock

echo "generated flake evaluates"
