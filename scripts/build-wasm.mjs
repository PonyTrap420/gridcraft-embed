import {spawnSync} from "node:child_process";
import {mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = process.env.GRIDCRAFT_SOURCE ?? path.join(root, "rust", "gridcraft");
const output = path.join(root, "dist", "wasm");
function run(command, args) {
  const result = spawnSync(command, args, {cwd: source, stdio: "inherit"});
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("cargo", ["+1.95.0", "build", "--lib", "-p", "gridcraft-web", "--target", "wasm32-unknown-unknown", "--release", "--locked"]);
mkdirSync(output, {recursive: true});
run(process.env.WASM_BINDGEN ?? "wasm-bindgen", [path.join(source, "target", "wasm32-unknown-unknown", "release", "gridcraft_web.wasm"), "--target", "web", "--out-dir", output]);
