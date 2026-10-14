import {spawn} from "node:child_process";
import {mkdirSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {getUpstreamSource} from "./upstream.mjs";
import {runtimePackage} from "./embedding.mjs";
import {run as capture} from "./release-lib.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const source = getUpstreamSource();
const output = path.join(root, "dist", "wasm");
async function run(command, args) {
  const child = spawn(command, args, {cwd: source, stdio: ["ignore", "pipe", "pipe"]});
  let diagnostic = "";
  child.stdout.on("data", data => process.stdout.write(data));
  child.stderr.on("data", data => {
    process.stderr.write(data);
    diagnostic = (diagnostic + data).slice(-12000);
  });
  const status = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  if (status !== 0) {
    if (process.env.GITHUB_ACTIONS) {
      const message = diagnostic.trim().split(/\r?\n/).slice(-40).join("\n") || `${command} exited with ${status}`;
      console.log(`::error title=Browser runtime build failed::${message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A")}`);
    }
    process.exit(status ?? 1);
  }
}
await run("cargo", ["+1.95.0", "build", "--lib", "-p", runtimePackage, "--target", "wasm32-unknown-unknown", "--release", "--locked"]);
mkdirSync(output, {recursive: true});
const target = JSON.parse(capture("cargo", ["+1.95.0", "metadata", "--no-deps", "--locked", "--format-version=1"], {cwd: source})).target_directory;
await run(process.env.WASM_BINDGEN ?? "wasm-bindgen", [path.join(target, "wasm32-unknown-unknown", "release", "gridcraft_web.wasm"), "--target", "web", "--out-dir", output]);
if (!process.argv.includes("--runtime-only")) await run(process.execPath, [path.join(root, "scripts", "collect-licenses.mjs")]);
