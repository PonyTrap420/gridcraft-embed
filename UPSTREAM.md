# Upstream provenance

Source: https://github.com/storytold/gridcraft

Pinned upstream commit: `fb823899c57b41703edcad2b6476cf4b8a01dfc4` (v0.3.0).

This is an unofficial local prototype, not an upstream Gridcraft release. The original Gridcraft contributor credits and licenses are preserved.

Changes:

- Corrected the dark theme's grid background, gridlines and automatic text colors; merged cells and the in-cell editor follow the active theme without changing stored workbook formatting.

- Added optional cells-only presentation plus the `view.cellsOnly` UI command, React initialization option, and JavaScript toggle method.

- Added a `cdylib` build of `apps/gridcraft-web`, plus an exported asynchronous canvas mount function and per-instance API handle.
- Shared the original platform services (file pickers, browser downloads and dropped-file handling).
- Exposed engine/UI commands without replacing the spreadsheet engine or UI.
- Used browser-compatible timing for engine commits; upstream `std::time::Instant::now()` crashed when editing on `wasm32-unknown-unknown`.
- Replaced fixed browser date/year fallbacks with `web-time` clocks in `core` and `calc`.
- Added JavaScript wrappers, TypeScript declarations, React lifecycle handling, a Vite demo and adapter/browser tests outside the Rust workspace.

The standalone browser binary is retained. The repository's gitignored `plan/` files were absent, and its referenced `storytold/craftrules` repository was inaccessible (GitHub returned repository not found). No upstream PR was made. This package is maintained independently of the upstream release.
