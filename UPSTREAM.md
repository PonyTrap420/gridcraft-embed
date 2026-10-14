# Upstream provenance

Source: https://github.com/storytold/gridcraft

Pinned upstream release: [v0.7.0](https://github.com/storytold/gridcraft/releases/tag/v0.7.0).

Pinned commit: `d9d09f0baa912e88c5111107903fc8c640214b57`.

Rust source is fetched at this exact commit into the ignored .work/upstream directory during builds. It is not copied into this repository.

This independently maintained, unofficial React embedding preserves upstream licenses and contributor credits. Integration changes are maintained in patches/embed.patch against d9d09f0baa912e88c5111107903fc8c640214b57. They add the browser embedding API, cells-only mode, and dark grid rendering. Browser clocks are provided by upstream. Dependency license notices are generated during builds and included in the npm package.
