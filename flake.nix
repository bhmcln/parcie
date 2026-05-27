{
  description = "parcie — constraint-driven pallet packing for grocery distribution";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm_10
            git
          ];

          shellHook = ''
            if [ ! -d node_modules ] && [ -f package.json ]; then
              echo "📦 Run 'pnpm install' to fetch dependencies."
            fi
          '';
        };
      }
    );
}
