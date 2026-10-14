# Validation

Performed locally on 2026-10-09.

Passed:

- Rust 1.95 release compilation for wasm32-unknown-unknown.
- Matching wasm-bindgen 0.2.129 JS/WASM generation.
- Adapter tests: 100,000-byte import/export preservation, propagated command errors, idempotent cleanup and listener cleanup.
- Server rendering/import of the React component without initializing browser WASM.
- Chromium/WebGL2: SUM, dependency recalculation, undo/redo, XLSX export/reimport with formula values and bold formatting, and live NOW().
- Two concurrently mounted sessions retain separate cell values.
- Cells-only initialization and live full-UI toggling preserve workbook data; desktop and narrow viewport captures were inspected.
- Version 0.1.2: inspected dark/light grid rendering, readable unformatted values and formulas, custom cell colors, and dark in-cell editing in the actual browser demo.
- Normal-speed keyboard input commits through the actual canvas UI.
- React StrictMode initialization, unmount and remount without uncaught page errors.
- Vite production bundling emits the WASM asset and JS chunks.
- Strict TypeScript checking of the React component/ref API.
- Installed the actual `.tgz` in a clean React consumer, built it for production, and reran the browser checks against that production build.

Versions 0.1.1 and 0.1.2 were published to npm and their registry integrity matched the prepared tarballs. Version 0.1.2 contains the dark grid fix and is available from the public registry.

## Release automation

On 2026-10-15, the independent embedding crate passed Rust 1.95 WASM compilation, matching wasm-bindgen generation, license collection for 167 packages, all 16 tests, strict TypeScript checking, production bundling, Chromium workbook/UI checks and npm packing. The isolation check deliberately replaced upstream's browser module with `compile_error!`; the owned crate still built, and the original source was restored and verified.

An isolated updater fixture prepared pending package 0.1.8 from the current engine pin, retained locked upstream dependencies, and left upstream's browser application untouched. The published 0.1.7 state remained unchanged. Candidate tests cover failed-release deduplication, changed integration inputs, manual retries, retryable infrastructure failures, persistence through a simulated GitHub branch store, and rejection of mismatched package/source artifacts. The planner also ran against public GitHub release data, and the actual package/source archive passed checksum-receipt verification. This fixture did not publish 0.1.8.

On 2026-10-14, the Gridcraft v0.7.0 repair passed clean source fetching and patch application, the release updater and prepared-source reuse, Rust 1.95 WASM compilation, matching wasm-bindgen generation, license collection for 167 packages, all 10 tests, strict TypeScript checking, production demo bundling, npm packing, and Chromium workbook/UI integration checks. The patch preserves upstream Center Across Selection and includes the new browser host module in the library. Package 0.1.7 remains pending until the release workflow completes publication. Pushes to the integration patch, release scripts, or workflow on `main` now trigger an immediate release check.

The [GitHub Actions validation run](https://github.com/PonyTrap420/gridcraft-embed/actions/runs/37962031361) passed on Ubuntu with Node 24: clean Rust/WASM compilation, dependency license collection, six adapter/release tests, production bundling, Chromium workbook/UI integration tests, and release artifact packing. It used `force_build=true` against the current upstream baseline, so it did not publish a duplicate npm version.

The update script was also exercised in an isolated checkout against the pinned upstream release. All integration patches applied cleanly, the exact source commit was retained, and package/lockfile/state updates prepared a pending next version. Production release state was unchanged by that fixture.

On 2026-10-10, [the upstream release workflow](https://github.com/PonyTrap420/gridcraft-embed/actions/runs/38045618810) rebuilt Gridcraft v0.4.0, passed the browser checks, published gridcraft-embed 0.1.3 with npm OIDC/provenance, verified its registry integrity and created the GitHub release.

The reference-based source layout adds a real Git fixture test covering exact commit checkout, three-way patch application, reuse and preservation of local edits. Seven tests pass locally. License generation from the fetched v0.4.0 source produced notices for 155 dependency packages. README previews were captured from the actual React demo and visually inspected.

The [clean reference-based GitHub build](https://github.com/PonyTrap420/gridcraft-embed/actions/runs/38046759361) passed source fetching/patching, Rust/WASM compilation, license generation, all seven tests, production bundling, Chromium integration checks, and artifact creation/upload. It ran with `force_build=true`, so the existing npm version was not published again. An isolated updater fixture also prepared the next pending package version without copying Rust into Git; the production release state remained unchanged.

Future upstream changes can still conflict with the maintained patch or fail tests; those failures deliberately prevent publication.

Not validated: other browser engines, WebGPU, Next.js builds, very large workbooks, broad Excel parity, long-running memory/performance, or accessibility.

Known issue observed: rapid characters delivered in one animation frame can lose input in upstream grid keyboard handling. The keyboard integration test uses a 100 ms inter-key delay; it does not claim that the rapid-input issue is fixed.

The Rust build reported an existing `unused_mut` warning in `crates/engine/src/cmd/spelling.rs`. Vite reported that it ignores the React `use client` directive, which is expected for a Vite client application. Chromium fetched a missing favicon; this is unrelated to WASM/UI operation. The full upstream native CI suite was not run.
