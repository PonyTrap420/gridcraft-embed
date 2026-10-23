# Changelog

## 0.1.11

- Update the embedded engine to Gridcraft v0.11.1 and rebase the integration patch so cells-only mode and dark cell text keep working alongside upstream's File-view keytips and wrapping in-cell editor.

## 0.1.9

- Update the embedded engine to Gridcraft v0.9.0 and rebase the integration patch so cells-only mode keeps working alongside the new host options for hiding the title bar and File tab.

## Unreleased

- Move the embedding API and browser services into an owned Rust crate; remove all patches to upstream's standalone browser application.
- Validate update candidates before promotion, verify tested artifact checksums, and record compatibility failures separately from the published source pin.
- Wait on unchanged failed candidates until integration inputs change or a manual retry is requested; retain automatic retries for infrastructure failures.
- Add a build test with deliberately broken upstream browser code and regression coverage for candidate failures, retries and artifact mismatches.

## 0.1.7

- Update the embedded engine to Gridcraft v0.7.0 and rebase the integration patch to preserve upstream Center Across Selection alongside dark grid rendering.
- Include the upstream browser host module in the WASM library so the new browser shell compiles with the embedding API.

## 0.1.5

- Update the embedded engine to Gridcraft v0.5.0 and rebase the integration patch so the upstream release workflow can prepare it cleanly.
- Preserve upstream system-theme support, ribbon keyboard shortcuts, and browser-safe edit profiling alongside the embedding API, cells-only mode, live browser clocks, and dark grid rendering.

## 0.1.4

- Describe the React and JavaScript browser spreadsheet features in npm metadata, with relevant Excel, spreadsheet and XLSX search keywords.
- Add a clearer feature overview and demo previews that render on both GitHub and npm.
- Include the repository cleanup: fetch pinned Gridcraft source during builds, while keeping the adapters, integration patch, tests and release tooling in this repository.

Uses the same Gridcraft v0.4.0 engine and embedding API as 0.1.3.
