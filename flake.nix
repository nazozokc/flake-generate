{
  description = "flake-generate development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-parts.url = "github:hercules-ci/flake-parts";
  };

  outputs =
    inputs@{
      self,
      nixpkgs,
      flake-parts,
      ...
    }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      systems = [
        "aarch64-darwin"
        "aarch64-linux"
        "x86_64-darwin"
        "x86_64-linux"
      ];

      perSystem =
        { system, ... }:
        let
          pkgs = nixpkgs.legacyPackages.${system};
          version = (builtins.fromJSON (builtins.readFile "${self}/package.json")).version;
          package = pkgs.stdenv.mkDerivation {
            pname = "flake-generate";
            inherit version;
            src = self;
            nativeBuildInputs = [
              pkgs.nodejs_24
              pkgs.esbuild
            ];
            buildPhase = ''
              runHook preBuild
              esbuild src/index.ts \
                --bundle --platform=node --format=esm --target=node20 \
                --outfile=flake-generate.js
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              install -Dm755 flake-generate.js $out/bin/flake-generate
              install -Dm644 package.json $out/package.json
              runHook postInstall
            '';
            meta.mainProgram = "flake-generate";
          };
        in
        {
          packages.default = package;
          apps.default = {
            type = "app";
            program = "${package}/bin/flake-generate";
            meta.description = "Generate a clean flake.nix from project markers";
          };

          devShells.default = pkgs.mkShell {
            name = "flake-generate";
            packages = [
              pkgs.nodejs_24
              pkgs.pnpm
              pkgs.esbuild
              pkgs.actionlint
              pkgs.statix
              pkgs.alejandra
            ];
            shellHook = ''
              echo "[devShell:default] node $(node --version) | pnpm $(pnpm --version)"
            '';
          };
        };
    };
}
