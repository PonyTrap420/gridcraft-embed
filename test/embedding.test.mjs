import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {directoryDigest, installEmbedding} from "../scripts/embedding.mjs";

test("the owned embedding crate adds only its locked package and leaves the browser app untouched", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "gridcraft-embedding-"));
  try {
    const source = path.join(root, "upstream");
    const embedding = path.join(root, "embed");
    mkdirSync(path.join(source, "apps/browser"), {recursive: true});
    mkdirSync(path.join(embedding, "src"), {recursive: true});
    writeFileSync(path.join(source, "Cargo.toml"), '[workspace]\nmembers = ["apps/*"]\n');
    writeFileSync(path.join(source, "apps/browser/main.rs"), 'compile_error!("upstream browser app changed");\n');
    const lock = 'version = 4\n\n[[package]]\nname = "engine"\nversion = "2.0.0"\nsource = "registry+original"\nchecksum = "preserve-me"\n';
    writeFileSync(path.join(source, "Cargo.lock"), lock);
    writeFileSync(path.join(embedding, "Cargo.toml"), '[package]\nname = "gridcraft-embed-wasm"\nversion = "0.1.0"\n[dependencies]\nengine = { workspace = true }\n');
    writeFileSync(path.join(embedding, "src/lib.rs"), "// owned source\n");
    const before = directoryDigest(embedding);
    installEmbedding(source, embedding);
    assert.equal(readFileSync(path.join(source, "apps/gridcraft-embed-wasm/src/lib.rs"), "utf8"), "// owned source\n");
    assert.equal(readFileSync(path.join(source, "apps/browser/main.rs"), "utf8"), 'compile_error!("upstream browser app changed");\n');
    const generated = readFileSync(path.join(source, "Cargo.lock"), "utf8");
    assert.ok(generated.endsWith(lock.slice(lock.indexOf("[[package]]"))));
    assert.match(generated, /name = "gridcraft-embed-wasm"/);
    assert.throws(() => installEmbedding(source, embedding), /already exists/);
    writeFileSync(path.join(embedding, "src/lib.rs"), "// changed source\n");
    assert.notEqual(directoryDigest(embedding), before);
    writeFileSync(path.join(source, "Cargo.lock"), lock + '\n[[package]]\nname = "engine"\nversion = "3.0.0"\n');
    assert.throws(() => installEmbedding(source, embedding), /one locked engine version/);
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "gridcraft-embedding-"));
    rmSync(root, {recursive: true, force: true});
  }
});
