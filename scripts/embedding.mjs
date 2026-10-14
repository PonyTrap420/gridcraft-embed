import {createHash} from "node:crypto";
import {cpSync, readFileSync, readdirSync, writeFileSync} from "node:fs";
import path from "node:path";

export const runtimePackage = "gridcraft-embed-wasm";
export function directoryDigest(root) {
  const hash = createHash("sha256");
  function visit(dir) {
    for (const entry of readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile()) hash.update(path.relative(root, file).replaceAll("\\", "/")).update("\0").update(readFileSync(file)).update("\0");
      else throw new Error(`Unsupported embedding input: ${file}`);
    }
  }
  visit(root);
  return hash.digest("hex");
}

// Install our crate as a workspace member, inheriting the engine's dependency versions.
// No files in the upstream browser application are read or changed.
export function installEmbedding(source, embedding) {
  const workspace = readFileSync(path.join(source, "Cargo.toml"), "utf8");
  if (!/members\s*=\s*\[[^\]]*"apps\/\*"/.test(workspace)) throw new Error("Upstream workspace no longer includes apps/*; embedding integration needs review");
  const manifest = readFileSync(path.join(embedding, "Cargo.toml"), "utf8");
  const version = /^version\s*=\s*"([\d.]+)"\s*$/m.exec(manifest)?.[1];
  if (!version || !manifest.includes(`name = "${runtimePackage}"`)) throw new Error("Invalid owned embedding package manifest");
  const dependencies = [];
  let dependencySection = false;
  for (const line of manifest.split(/\r?\n/)) {
    if (line.startsWith("[")) dependencySection = /^\[.*dependencies\]$/.test(line);
    else if (dependencySection) {
      const name = /^([\w-]+)\s*=/.exec(line)?.[1];
      if (name) dependencies.push(name);
    }
  }
  const lockPath = path.join(source, "Cargo.lock");
  const lock = readFileSync(lockPath, "utf8");
  if (lock.includes(`name = "${runtimePackage}"`)) throw new Error("Embedding crate already exists in upstream lockfile");
  const packages = lock.split(/^\[\[package\]\]\r?\n/m).slice(1);
  for (const name of dependencies) {
    if (packages.filter(block => block.startsWith(`name = "${name}"\n`) || block.startsWith(`name = "${name}"\r\n`)).length !== 1) {
      throw new Error(`Expected one locked ${name} version; embedding dependency needs review`);
    }
  }
  // Add only our local package; retain every upstream version, Git pin and checksum.
  const entry = `[[package]]\nname = "${runtimePackage}"\nversion = "${version}"\ndependencies = [\n${[...new Set(dependencies)].sort().map(name => ` "${name}",`).join("\n")}\n]\n\n`;
  const offset = lock.indexOf("[[package]]");
  if (offset < 0) throw new Error("Upstream Cargo.lock has no packages");
  cpSync(embedding, path.join(source, "apps", runtimePackage), {recursive: true});
  writeFileSync(lockPath, lock.slice(0, offset) + entry + lock.slice(offset));
}
