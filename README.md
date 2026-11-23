# flake-generate

カレントディレクトリのロックファイルと設定ファイルを読んで、環境に合った `flake.nix` を生成する CLI。

生成物は手で編集しやすいように、判定根拠のコメントとグループ化されたパッケージ列だけの素直な Nix 式になる。

変更履歴は [CHANGELOG.md](CHANGELOG.md)。

## クイックスタート（推奨）

インストール不要ですぐ使えます。

```sh
bunx flake-generate
```

カレントディレクトリに `flake.nix` を生成します。

```sh
# 任意のディレクトリを対象に
bunx flake-generate ../my-app

# 書き込まずに生成結果を表示
bunx flake-generate --stdout

# 予定だけ表示
（実際には書き込まない）
bunx flake-generate --dry-run

# 生成結果が古ければ失敗（CI 向け）
bunx flake-generate --check
```

## インストール

推奨は上の `bunx` ですが、他の方法もあります。

```sh
# npx
npx flake-generate

# グローバルインストール
npm install -g flake-generate
bun add -g flake-generate

# Nix
nix run github:nazozokc/flake-generate -- .
```

## 使い方

```sh
flake-generate                # カレントに flake.nix を生成
flake-generate ../my-app      # 任意のディレクトリを対象にする
flake-generate --stdout       # 書き込まずに生成結果を表示
flake-generate --dry-run      # 書き込む予定のファイルだけ表示
flake-generate --check        # 生成結果が古ければ失敗（CI 向け）
```

| オプション            | 説明                                                       |
| :-------------------- | :--------------------------------------------------------- |
| `-o, --output <path>` | 出力先（対象ディレクトリからの相対パス、既定 `flake.nix`） |
| `-f, --force`         | 既存ファイルを上書きする                                   |
| `--envrc`             | `use flake` を含む `.envrc` も作る                         |
| `-n, --dry-run`       | 書き込みを行わず、予定だけ表示する                         |
| `--stdout`            | `flake.nix` の内容を標準出力に出す（書き込みなし）         |
| `-c, --check`         | 生成結果と既存ファイルを比較し、差分があれば終了コード 1   |
| `-v, --verbose`       | 検出したマーカーを stderr に表示する                       |
| `-h, --help`          | ヘルプを表示する                                           |
| `-V, --version`       | バージョンを表示する                                       |

既存の `flake.nix` は packages の管理ブロックだけを更新し、それ以外の編集は保持します。
管理ブロックがない既存ファイルは既定では上書きしません。`--force` で置換できます。
`--envrc` は既存の `.envrc` を残し、`use flake` が無いときだけ末尾に追加します。
`--check` は `--dry-run` / `--stdout` / `--force` と併用できません。
出力先とその親ディレクトリが symlink の場合は書き込みを拒否します。
`-o .envrc --envrc` のように出力先が重複する組み合わせもエラーになります。

### 終了コード

| コード | 意味                                      |
| :----- | :---------------------------------------- |
| 0      | 成功。`--check` なら生成結果も最新        |
| 1      | 実行時エラー、または `--check` で差分あり |
| 2      | 引数・オプションの指定が不正              |

### 出力例

```text
◇ flake-generate v0.2.0 · /path/to/app

◆ Node.js         pkgs.nodejs_24 or pkgs.nodejs, pnpm, typescript
◆ Rust            cargo, clippy, rust-analyzer, rustc, rustfmt

✓ wrote flake.nix
  2 ecosystems · 8 packages · 1 file
```

`--dry-run` と `--check` は unified diff を表示する。色は TTY 時のみで、`NO_COLOR` で無効化できる。
`--check` は検出内容と警告も stderr に出し、対象が symlink などで書き込めない場合も終了コード 1 になる。

### 設定と編集の保持

`.flake-generate.json` があればそれを読み、無ければ `package.json` の `flake-generate` フィールドを使う。

```json
{
  "systems": ["x86_64-linux", "aarch64-darwin"],
  "nixpkgs": "github:NixOS/nixpkgs/nixos-25.05",
  "description": "my dev env",
  "extraPackages": ["jq", "hello"],
  "disabledDetectors": ["rust", "php"]
}
```

| キー                | 既定値                           | 説明                                                                               |
| :------------------ | :------------------------------- | :--------------------------------------------------------------------------------- |
| `systems`           | 3 プラットフォーム               | 生成する `systems` の配列（空配列は不可）                                          |
| `nixpkgs`           | `nixpkgs-unstable`               | nixpkgs の入力 URL                                                                 |
| `description`       | `<name> development environment` | flake の説明                                                                       |
| `extraPackages`     | `[]`                             | 検出に関わらず追加する Nix 属性名                                                  |
| `disabledDetectors` | `[]`                             | 無効化する検出器（`node` `deno` `rust` `go` `python` `ruby` `php` `jvm` `elixir`） |

生成される `packages` 列には管理マーカーが入る。

```nix
packages = [
  # >>> flake-generate:packages
  # Node.js
  pkgs.nodejs_24 or pkgs.nodejs
  # <<< flake-generate:packages
];
```

再生成時はこの間だけが差し替わる。 inputs、shellHook、コメントなどのブロック外の編集は保持される。
`--check` もマージ後の内容を比較するので、ブロック外の編集では失敗しない。
マーカーが無い、または片方だけのファイルは通常の既存ファイルとして扱われ、更新には `--force` が必要。

## 検出ルール

| マーカー                                                           | 入るパッケージ                                                                   |
| :----------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lock*` | `pkgs.nodejs_<major> or pkgs.nodejs`、`pnpm` / `yarn` / `bun`                    |
| `deno.json` / `deno.jsonc` / `deno.lock`                           | `deno`（固定バージョンは警告に出す）                                             |
| `tsconfig.json`                                                    | `typescript`                                                                     |
| `biome.json` / prettier 設定                                       | `biome` / `prettier`                                                             |
| `Cargo.lock` / `Cargo.toml` / `rust-toolchain*`                    | `cargo` `rustc` `rustfmt` `clippy` `rust-analyzer`（固定バージョンは警告に出す） |
| `go.mod` / `go.sum` / `go.work`                                    | `pkgs.go_1_<minor> or pkgs.go`、`gopls`                                          |
| `uv.lock` / `poetry.lock` / `pyproject.toml` / `.python-version`   | `pkgs.python3<minor> or pkgs.python3`、`uv` / `poetry` `ruff`                    |
| `Gemfile.lock` / `.ruby-version`                                   | `pkgs.ruby_3_<minor> or pkgs.ruby`、`bundler`                                    |
| `composer.lock`                                                    | `php` `phpPackages.composer`                                                     |
| `gradlew` / `pom.xml` / `.java-version`                            | `pkgs.jdk<major> or pkgs.jdk` + `gradle` / `maven`                               |
| `mix.lock` / `mix.exs`                                             | `pkgs.beam<otp>Packages.elixir_1_<minor> or pkgs.elixir`                         |

バージョンは `.nvmrc` / `.node-version` / `engines.node`、`.python-version`、`.ruby-version`、`.java-version`、
`go.mod` / `go.work`、`rust-toolchain.toml` / `rust-toolchain`、`.tool-versions`、
[mise.toml の `[tools]`](https://mise.jdx.dev/configuration.html) から読む。
`engines.node` はレンジの最小 major を使う（例: `>=18 <23` → 18）。

バージョン由来の属性は `pkgs.<attr> or pkgs.<generic>` 形式で出力する。nixpkgs 側で属性が増えても減っても評価が壊れず、
属性が無い場合は汎用パッケージにフォールバックする。Rust と Deno は nixpkgs にバージョン別属性が無いため、
固定バージョンを読んで警告に出す。Elixir の OTP 系列は `erlang` の固定値から読み、既定は 27。

複数エコシステムが見つかった場合はすべて採用する。何も見つからない場合は空の devShell を生成して警告する。

生成される flake は flake-parts 構成。既定では nixpkgs unstable と 3 プラットフォームを明示し、設定で変更できる。
`x86_64-darwin` は nixpkgs unstable がサポートを終了したため既定から除外している。

## 開発

```sh
pnpm typecheck
pnpm test
pnpm test:flake   # 生成した flake が全デフォルトシステムで nix eval できることを確認
pnpm test:package # npm tarball の CLI を実行して確認
pnpm version:check # package.json が最新リリースより古くないことを確認
pnpm lint
pnpm build
nix develop
nix flake check
```

設計: 設定は `loadConfig`、検出は `FsProbe` を注入した純粋な detector 群、生成は `renderFlake`、既存ファイルとのマージは `managed.ts`、副作用は `buildPlan` が作った plan を `applyPlan` が実行する。バージョン由来の属性は nixpkgs の違いに耐えるため `or` 付き Nix 式で出力する。`--dry-run` は plan を表示するだけ。`--check` はマージ済みの期待値と既存ファイルを差分比較する。書き込みは一時ファイル + `rename` で原子的に行い、出力パスの経路上にある symlink も拒否する。ランタイム依存はゼロで、Nix パッケージは esbuild で単一ファイルにバンドルする。
