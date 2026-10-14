import {cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import {run, writeJson} from "./release-lib.mjs";
import {getUpstreamSource, packageRoot} from "./upstream.mjs";
import {pinnedLicenseSource} from "./license-lib.mjs";
import {runtimePackage} from "./embedding.mjs";
rmSync(path.join(packageRoot, ".work/infrastructure-failure.json"), {force: true});
const metadata = JSON.parse(run("cargo", ["+1.95.0", "metadata", "--locked", "--format-version=1", "--filter-platform", "wasm32-unknown-unknown"], {cwd: getUpstreamSource()}));
const nodes = new Map(metadata.resolve.nodes.map(node => [node.id, node]));
const root = metadata.packages.find(pkg => pkg.name === runtimePackage);
if (!root) throw new Error(`${runtimePackage} package missing`);
const visited = new Set();
function visit(id) {if (visited.has(id)) return; visited.add(id); for (const dep of nodes.get(id)?.deps ?? []) if (dep.dep_kinds.some(kind => kind.kind !== "dev")) visit(dep.pkg);}
visit(root.id);
const output = path.join(packageRoot, "dist/notices");
rmSync(output, {recursive: true, force: true}); mkdirSync(output, {recursive: true});
const notices = [];
async function fetchLicense(url) {
  try {
    const response = await fetch(url);
    if (!response.ok && response.status !== 404) throw new Error(`License fetch failed: ${response.status}`);
    return response;
  } catch (error) {
    mkdirSync(path.join(packageRoot, ".work"), {recursive: true});
    writeJson(path.join(packageRoot, ".work/infrastructure-failure.json"), {stage: "licenses"});
    throw error;
  }
}
for (const pkg of metadata.packages.filter(pkg => visited.has(pkg.id) && pkg.source)) {
  const source = path.dirname(pkg.manifest_path);
  const target = path.join(output, `${pkg.name}-${pkg.version}`);
  const files = readdirSync(source).filter(name => /^(licen[sc]es?|copying|notice|copyright)([._-]|$)/i.test(name));
  if (pkg.license_file && existsSync(path.join(source, pkg.license_file))) files.push(pkg.license_file);
  mkdirSync(target, {recursive: true});
  for (const name of new Set(files)) cpSync(path.join(source, name), path.join(target, name), {recursive: true});
  if (!files.length) {
    // Some dependencies keep licenses at the repository root. Retrieve them at
    // Cargo's resolved Git commit or the crate archive's recorded source commit.
    const vcsFile = path.join(source, ".cargo_vcs_info.json");
    const vcs = existsSync(vcsFile) ? JSON.parse(readFileSync(vcsFile, "utf8")) : null;
    const licenseSource = pinnedLicenseSource(pkg, vcs);
    const candidates = ["LICENSE", "LICENSE-MIT", "LICENSE-APACHE", "LICENSE.md", "LICENSE.txt", "COPYING"];
    const found = await Promise.all(candidates.map(async name => {
      const response = await fetchLicense(`${licenseSource}/${name}`);
      if (response.status === 404) return false;
      if (!response.ok) throw new Error(`License fetch failed: ${response.status} for ${pkg.name}/${name}`);
      writeFileSync(path.join(target, name), await response.text());
      return true;
    }));
    if (!found.some(Boolean)) throw new Error(`License files missing for ${pkg.name}@${pkg.version}`);
  }
  if (pkg.name === "epaint_default_fonts") {
    mkdirSync(path.join(target, "fonts"), {recursive: true});
    for (const file of readdirSync(path.join(source, "fonts")).filter(name => /\.(txt|md)$/i.test(name))) cpSync(path.join(source, "fonts", file), path.join(target, "fonts", file));
  }
  notices.push(`${pkg.name}@${pkg.version}: ${pkg.license ?? "see bundled license"} (${pkg.repository ?? pkg.source})`);
}
writeFileSync(path.join(output, "dependencies.txt"), notices.sort().join("\n") + "\n");
console.log(`Collected license notices for ${notices.length} dependency packages`);
