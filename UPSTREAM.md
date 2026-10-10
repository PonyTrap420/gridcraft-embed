# Upstream provenance

Source: https://github.com/storytold/gridcraft

Pinned upstream release: [v0.4.0](https://github.com/storytold/gridcraft/releases/tag/v0.4.0).

Pinned commit: `13664fe66b952e7abcd68e2371c1d4f34f990dac`.

Rust source is fetched at this exact commit into the ignored `.work/upstream` directory during builds. It is not copied into this repository.

This independently maintained, unofficial React embedding preserves upstream licenses and contributor credits. Integration changes are maintained in `patches/embed.patch` against fb823899c57b41703edcad2b6476cf4b8a01dfc4. They add the browser embedding API, cells-only mode, browser clocks, and dark grid rendering. Dependency license notices are generated during builds and included in the npm package.
