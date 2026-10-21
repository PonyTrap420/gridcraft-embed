# Upstream provenance

Source: https://github.com/storytold/gridcraft

Pinned upstream release: [v0.10.0](https://github.com/storytold/gridcraft/releases/tag/v0.10.0).

Pinned commit: `2ebdf164c2c9c536122e0a2cffe79078b5c818ac`.

Upstream Rust source is fetched at this exact commit into the ignored .work/upstream directory during builds. The engine is not copied into this repository. Our embedding crate and browser services are maintained under rust/embed and installed into the fetched workspace during source preparation.

This independently maintained, unofficial React embedding preserves upstream licenses and contributor credits. The UI hooks for cells-only mode and dark grid rendering are maintained in patches/embed.patch against a2cc4b42cac6e2c41bae71fba4607300755a0b47. The embedding API and browser services live in our own crate, independent of upstream's standalone browser app. Browser clocks are provided by upstream. Dependency license notices are generated during builds and included in the npm package.
