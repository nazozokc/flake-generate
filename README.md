# flake-generate

カレントディレクトリのロックファイルと設定ファイルを読んで、環境に合った `flake.nix` を生成する CLI。

生成物は手で編集しやすいように、判定根拠のコメントとグループ化されたパッケージ列だけの素直な Nix 式になる。

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

既存の `flake.nix` は既定では上書きしません。`--force` を付けること。
`--check` は `--dry-run` / `--stdout` / `--force` と併用できません。

### 終了コード

| コード | 意味                                      |
| :----- | :---------------------------------------- |
| 0      | 成功。`--check` なら生成結果も最新        |
| 1      | 実行時エラー、または `--check` で差分あり |
| 2      | 引数・オプションの指定が不正              |

### 出力例

```text
◇ flake-generate v0.1.0 · /path/to/app

◆ Node.js         nodejs_24, pnpm, typescript
◆ Rust            cargo, clippy, rust-analyzer, rustc, rustfmt

✓ wrote flake.nix
  2 ecosystems · 8 packages · 1 file
```

`--dry-run` と `--check` は unified diff を表示する。色は TTY 時のみで、`NO_COLOR` で無効化できる。

## 検出ルール

| マーカー                                                           | 入るパッケージ                                                   |
| :----------------------------------------------------------------- | :--------------------------------------------------------------- |
| `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lock*` | `nodejs_22` / `nodejs_24` / `nodejs_26`、`pnpm` / `yarn` / `bun` |
| `deno.json` / `deno.jsonc` / `deno.lock`                           | `deno`                                                           |
| `tsconfig.json`                                                    | `typescript`                                                     |
| `biome.json` / prettier 設定                                       | `biome` / `prettier`                                             |
| `Cargo.lock` / `Cargo.toml`                                        | `cargo` `rustc` `rustfmt` `clippy` `rust-analyzer`               |
| `go.mod`                                                           | `go` `gopls`                                                     |
| `uv.lock` / `poetry.lock` / `pyproject.toml` / `.python-version`   | `python311`〜`python314`、`uv` / `poetry` `ruff`                 |
| `Gemfile.lock` / `.ruby-version`                                   | `ruby_3_4`（未知なら `ruby`）、`bundler`                         |
| `composer.lock`                                                    | `php` `phpPackages.composer`                                     |
| `gradlew` / `pom.xml` / `.java-version`                            | `jdk8`〜`jdk25`（未知なら `jdk`）+ `gradle` / `maven`            |
| `mix.lock` / `mix.exs`                                             | `beam27Packages.elixir_1_18` / `elixir_1_19`                     |

バージョンは `.nvmrc` / `.node-version` / `engines.node`、`.python-version`、`.ruby-version`、`.java-version`、
`.tool-versions`、[mise.toml の `[tools]`](https://mise.jdx.dev/configuration.html) から読む。
未知のバージョンは汎用属性にフォールバックし、警告を出す。

複数エコシステムが見つかった場合はすべて採用する。何も見つからない場合は空の devShell を生成して警告する。

生成される flake は flake-parts 構成で、nixpkgs は unstable、systems は 4 プラットフォームを明示する。

## 開発

```sh
pnpm typecheck
pnpm test
pnpm test:flake   # 生成した flake が nix eval できることを確認
pnpm lint
pnpm build
nix develop
nix flake check
```

設計: 検出は `FsProbe` を注入した純粋な detector 群、生成は `renderFlake`、副作用は `buildPlan` が作った plan を `applyPlan` が実行する。`--dry-run` は plan を表示するだけ。`--check` は plan と既存ファイルを差分比較する。書き込みは一時ファイル + `rename` で原子的に行い、symlink 宛先は拒否する。ランタイム依存はゼロで、Nix パッケージは esbuild で単一ファイルにバンドルする。
