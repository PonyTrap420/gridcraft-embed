import assert from "node:assert/strict";
import {readFileSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";
import {prepareUpstream} from "../scripts/upstream.mjs";

// A browser-app source change must not be part of our crate's compilation graph.
// Only modify our verified, generated checkout, restoring its bytes even on failure.
const source = prepareUpstream();
const browser = path.join(source, "apps/gridcraft-web/src/web.rs");
const original = readFileSync(browser);
try {
  writeFileSync(browser, 'compile_error!("standalone browser app is deliberately incompatible");\n');
  const result = spawnSync(process.execPath, ["scripts/build-wasm.mjs", "--runtime-only"], {
    env: {...process.env, GRIDCRAFT_SOURCE: source}, stdio: "inherit",
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Embedding must build while standalone browser code cannot compile");
} finally {
  writeFileSync(browser, original);
}
assert.equal(prepareUpstream(), source);
console.log("Embedding builds with deliberately broken upstream browser code; original source restored.");
