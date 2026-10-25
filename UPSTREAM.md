# Upstream provenance

Source: https://github.com/storytold/gridcraft

Pinned upstream release: [v0.12.1](https://github.com/storytold/gridcraft/releases/tag/v0.12.1).

Pinned commit: `f86aec12dabc744b5f75e1033f87bfe685e78481`.

Upstream Rust source is fetched at this exact commit into the ignored .work/upstream directory during builds. The engine is not copied into this repository. Our embedding crate and browser services are maintained under rust/embed and installed into the fetched workspace during source preparation.

This independently maintained, unofficial React embedding preserves upstream licenses and contributor credits. The UI hooks for cells-only mode and dark grid rendering are maintained in patches/embed.patch against f86aec12dabc744b5f75e1033f87bfe685e78481. The embedding API and browser services live in our own crate, independent of upstream's standalone browser app. Browser clocks are provided by upstream. Dependency license notices are generated during builds and included in the npm package.
