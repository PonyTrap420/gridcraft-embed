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

Not validated: other browser engines, WebGPU, Next.js builds, very large workbooks, broad Excel parity, long-running memory/performance, or accessibility.

Known issue observed: rapid characters delivered in one animation frame can lose input in upstream grid keyboard handling. The keyboard integration test uses a 100 ms inter-key delay; it does not claim that the rapid-input issue is fixed.

The Rust build reported an existing `unused_mut` warning in `crates/engine/src/cmd/spelling.rs`. Vite reported that it ignores the React `use client` directive, which is expected for a Vite client application. Chromium fetched a missing favicon; this is unrelated to WASM/UI operation. The full upstream native CI suite was not run.
