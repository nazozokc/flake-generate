# Changelog

このプロジェクトの変更履歴。形式は [Keep a Changelog](https://keepachangelog.com/ja/1.1.0/) に準拠する。

## [Unreleased]

### Added

- `.flake-generate.json` と `package.json` の `flake-generate` フィールドによる設定（`systems` / `nixpkgs` / `description` / `extraPackages` / `disabledDetectors`）。
- `packages` 列の managed block。ブロック外のユーザー編集を保持する。
- Go / Rust / Deno の固定バージョン読み取り、`engines.node` のレンジ解釈、Elixir の OTP 系列読み取り。
- バージョン由来属性の `or` fallback と、全デフォルトシステムでの生成 flake eval。
- npm tarball の実行スモーク、バージョン drift チェック、`version:sync` スクリプト。

### Changed

- publish workflow はリリースタグで `package.json` を書き換えず、タグとバージョンの一致を検証する。
- 既定 `systems` から `x86_64-darwin` を除外（nixpkgs unstable がサポート終了）。

### Fixed

- 出力パスとその祖先の symlink を拒否し、root 外への書き込みを防止。
- `-o .envrc --envrc` の二重出力をエラー化。
- Java `1.x` の major 解釈と `--check` の警告表示。
- 既存 `.envrc` の保持と、no-op 時の書き込み抑制。

## [0.2.0] - 2026-11-22

### Added

- CLI 出力の改善と unified diff による差分レポート。
- Nix パッケージと flake の evaluation check。

## [0.1.2] - 2026-11-22

### Changed

- 内部改善とドキュメント調整。

## [0.1.1] - 2026-11-22

### Added

- リリースタグから npm へ公開する workflow。

## [0.1.0] - 2026-11-22

### Added

- ロックファイルと設定ファイルから `flake.nix` を生成する CLI。

[0.2.0]: https://github.com/nazozokc/flake-generate/releases/tag/0.2.0
[0.1.2]: https://github.com/nazozokc/flake-generate/releases/tag/0.1.2
[0.1.1]: https://github.com/nazozokc/flake-generate/releases/tag/0.1.1
