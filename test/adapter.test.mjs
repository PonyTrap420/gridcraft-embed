import {test} from "node:test";
import assert from "node:assert/strict";
import {renderToString} from "react-dom/server";
import {createElement} from "react";
import {Gridcraft} from "../dist/react.js";
import {wrapHandle} from "../dist/index.js";

test("command errors, binary roundtrip, and destruction", async () => {
  const bytes = Uint8Array.from({length: 100000}, (_, i) => i % 256);
  let closed = 0, freed = 0;
  const api = wrapHandle({
    version: () => 1,
    commands: () => "[]",
    execute(command, params) {
      if (command === "invalid") throw new Error("unknown command");
      if (command === "file.open") {
        assert.deepEqual(Uint8Array.from(atob(JSON.parse(params).base64), c => c.charCodeAt(0)), bytes);
      }
      if (command === "file.saveBytes") {
        return JSON.stringify({base64: Buffer.from(bytes).toString("base64")});
      }
      return "null";
    },
    destroy() {closed++;}, free() {freed++;},
  });
  assert.throws(() => api.execute("invalid"), /unknown command/);
  await api.importWorkbook(bytes);
  assert.deepEqual(new Uint8Array(await api.exportWorkbook().arrayBuffer()), bytes);
  api.destroy(); api.destroy();
  assert.equal(closed, 1); assert.equal(freed, 1);
  assert.throws(() => api.getCell("A1"), /destroyed/);
});

test("change subscription coalesces revisions and stops after unsubscribe", async () => {
  let version = 1, calls = 0;
  const api = wrapHandle({version: () => version, destroy() {}, free() {}});
  const stop = api.onChange(() => calls++);
  version = 3;
  await new Promise(resolve => setTimeout(resolve, 210));
  assert.equal(calls, 1);
  stop(); version = 4;
  await new Promise(resolve => setTimeout(resolve, 210));
  assert.equal(calls, 1);
  api.destroy();
});

test("React component renders on the server without loading WASM", () => {
  assert.match(renderToString(createElement(Gridcraft)), /height:600px/);
});
