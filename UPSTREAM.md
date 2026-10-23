# Upstream provenance

Source: https://github.com/storytold/gridcraft

Pinned upstream release: [v0.11.1](https://github.com/storytold/gridcraft/releases/tag/v0.11.1).

Pinned commit: `ac8da7d49cbeb4be6aa1ad5869f3d29fe2da8cd9`.

Upstream Rust source is fetched at this exact commit into the ignored .work/upstream directory during builds. The engine is not copied into this repository. Our embedding crate and browser services are maintained under rust/embed and installed into the fetched workspace during source preparation.

This independently maintained, unofficial React embedding preserves upstream licenses and contributor credits. The UI hooks for cells-only mode and dark grid rendering are maintained in patches/embed.patch against ac8da7d49cbeb4be6aa1ad5869f3d29fe2da8cd9. The embedding API and browser services live in our own crate, independent of upstream's standalone browser app. Browser clocks are provided by upstream. Dependency license notices are generated during builds and included in the npm package.
