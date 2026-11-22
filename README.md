# flake-generate

カレントディレクトリのロックファイルと設定ファイルを読んで、環境に合った `flake.nix` を生成する CLI。
生成物は手で編集しやすいように、判定根拠のコメントとグループ化されたパッケージ列だけの素直な Nix 式になる。

## 使い方

```sh
pnpm install
pnpm build

node dist/index.js            # カレントに flake.nix を生成
node dist/index.js ../my-app  # 任意のディレクトリを対象にする
node dist/index.js --stdout   # 書き込まずに生成結果を表示
node dist/index.js --dry-run  # 書き込む予定のファイルだけ表示
```

| オプション            | 説明                                                       |
| :-------------------- | :--------------------------------------------------------- |
| `-o, --output <path>` | 出力先（対象ディレクトリからの相対パス、既定 `flake.nix`） |
| `-f, --force`         | 既存ファイルを上書きする                                   |
| `--envrc`             | `use flake` を含む `.envrc` も作る                         |
| `-n, --dry-run`       | 書き込みを行わず、予定だけ表示する                         |
| `--stdout`            | `flake.nix` の内容を標準出力に出す（書き込みなし）         |
| `-v, --verbose`       | 検出したマーカーを stderr に表示する                       |

既存の `flake.nix` は既定では上書きしない。`--force` を付けること。

## 検出ルール

| マーカー                                                           | 入るパッケージ                                                  |
| :----------------------------------------------------------------- | :-------------------------------------------------------------- |
| `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lock*` | `nodejs_XX`（`.nvmrc` 等から版本選択）、`pnpm` / `yarn` / `bun` |
| `tsconfig.json`                                                    | `typescript`                                                    |
| `biome.json` / prettier 設定                                       | `biome` / `prettier`                                            |
| `Cargo.lock` / `Cargo.toml`                                        | `cargo` `rustc` `rustfmt` `clippy` `rust-analyzer`              |
| `go.mod`                                                           | `go` `gopls`                                                    |
| `uv.lock` / `poetry.lock` / `pyproject.toml` / `.python-version`   | `python3XX` `uv` / `poetry` `ruff`                              |
| `Gemfile.lock`                                                     | `ruby` `bundler`                                                |
| `composer.lock`                                                    | `php` `phpPackages.composer`                                    |
| `gradlew` / `pom.xml`                                              | `jdk` + `gradle` / `maven`                                      |
| `mix.lock`                                                         | `beam27Packages.elixir_1_19`                                    |

複数エコシステムが見つかった場合はすべて採用する。何も見つからない場合は空の devShell を生成して警告する。

生成される flake は flake-parts 構成で、nixpkgs は unstable、systems は 4 プラットフォームを明示する。

## 開発

```sh
pnpm typecheck
pnpm test
pnpm lint
pnpm build
nix develop
```

設計: 検出は `FsProbe` を注入した純粋な detector 群、生成は `renderFlake`、副作用は `buildPlan` が作った plan を `applyPlan` が実行する。`--dry-run` は plan を表示するだけ。書き込みは一時ファイル + `rename` で原子的に行い、symlink 宛先は拒否する。
