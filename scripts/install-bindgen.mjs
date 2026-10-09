import {readFileSync} from "node:fs";
import {run} from "./release-lib.mjs";
const lock = readFileSync("rust/gridcraft/Cargo.lock", "utf8");
const match = /name = "wasm-bindgen"\s+version = "([\d.]+)"/.exec(lock);
if (!match) throw new Error("wasm-bindgen version missing from Cargo.lock");
try {if (run("wasm-bindgen", ["--version"]) === `wasm-bindgen ${match[1]}`) process.exit(0);} catch {}
run("cargo", ["+1.95.0", "install", "wasm-bindgen-cli", "--version", match[1], "--locked", "--force"], {stdio: "inherit"});
