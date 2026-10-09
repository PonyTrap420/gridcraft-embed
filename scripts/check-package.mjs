import {access} from "node:fs/promises";
for (const path of ["dist/index.js", "dist/react.js", "dist/wasm/gridcraft_web.js", "dist/wasm/gridcraft_web_bg.wasm", "LICENSE-MIT", "LICENSE-APACHE", "NOTICE"]) {
  await access(new URL(`../${path}`, import.meta.url));
}
console.log("Runtime, WASM and license files are present.");
