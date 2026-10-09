let initialization;

export async function createSpreadsheet(canvas, options = {}) {
  if (typeof window === "undefined") throw new Error("Gridcraft requires a browser");
  if (!(canvas instanceof HTMLCanvasElement)) throw new TypeError("Expected an HTMLCanvasElement");
  initialization ??= import("./wasm/gridcraft_web.js").then(async (wasm) => {
    await wasm.default({module_or_path: options.wasmUrl ?? new URL("./wasm/gridcraft_web_bg.wasm", import.meta.url)});
    return wasm;
  }).catch((error) => { initialization = undefined; throw error; });
  const wasm = await initialization;
  const handle = await wasm.mount(canvas, options.sample, options.dark ?? false, options.webgl ?? false, options.cellsOnly ?? false);
  return wrapHandle(handle);
}

/** Internal adapter, also used by protocol tests. */
export function wrapHandle(handle) {
  let destroyed = false;
  let version = handle.version();
  const listeners = new Set();
  let timer;
  const alive = () => { if (destroyed) throw new Error("Spreadsheet was destroyed"); };
  const execute = (command, params = {}) => {
    alive();
    return JSON.parse(handle.execute(command, JSON.stringify(params)));
  };
  const api = {
    execute,
    setCellsOnly(on) { return execute("view.cellsOnly", {on: Boolean(on)}); },
    commands() { alive(); return JSON.parse(handle.commands()); },
    setCell(cell, input, sheet) { return execute("cell.set", {cell, input: String(input), sheet}); },
    getCell(cell, sheet) { return execute("cell.get", {cell, sheet}); },
    setValues(range, values) { return execute("range.setValues", {range, values}); },
    readRange(range, options = {}) { return execute("sheet.read", {...options, range}); },
    inspect() { return execute("document.inspect"); },
    undo() { return execute("edit.undo"); },
    redo() { return execute("edit.redo"); },
    async importWorkbook(input, name = "Book.xlsx") {
      alive();
      const bytes = input instanceof Blob ? new Uint8Array(await input.arrayBuffer())
        : input instanceof Uint8Array ? input : new Uint8Array(input);
      // Chunking avoids argument-count limits for large workbooks.
      let binary = "";
      for (let offset = 0; offset < bytes.length; offset += 32768) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 32768));
      }
      return execute("file.open", {name: input instanceof File ? input.name : name, base64: btoa(binary)});
    },
    exportWorkbook(format = "xlsx") {
      if (!["xlsx", "csv", "tsv", "json", "html"].includes(format)) throw new Error("Unsupported export format");
      const result = execute("file.saveBytes", {format});
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const types = {xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", tsv: "text/tab-separated-values", json: "application/json", html: "text/html"};
      return new Blob([bytes], {type: types[format]});
    },
    onChange(listener) {
      alive();
      if (typeof listener !== "function") throw new TypeError("Expected a listener function");
      listeners.add(listener);
      timer ??= setInterval(() => {
        if (destroyed) return;
        const next = handle.version();
        if (next === version) return;
        version = next;
        for (const fn of [...listeners]) {
          try { fn(api); } catch (error) { console.error("Gridcraft change listener failed", error); }
        }
      }, 150);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) { clearInterval(timer); timer = undefined; }
      };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearInterval(timer);
      listeners.clear();
      try { handle.destroy(); } finally { handle.free(); }
    },
  };
  return api;
}
