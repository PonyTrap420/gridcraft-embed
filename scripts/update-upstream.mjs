import {cpSync, existsSync, mkdirSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import {nextVersion, readJson, run, writeJson} from "./release-lib.mjs";
const plan = readJson(".work/release-plan.json");
if (!plan.update) process.exit(0);
const previous = readJson("upstream-state.json");
const root = process.cwd();
const checkout = path.resolve(root, ".work/upstream");
if (existsSync(checkout)) throw new Error("Upstream checkout already exists; use a clean workspace");
run("git", ["clone", "--filter=blob:none", "--no-checkout", `https://github.com/${previous.repository}.git`, checkout]);
const commit = run("git", ["rev-parse", `refs/tags/${plan.release.tag_name}^{commit}`], {cwd: checkout});
if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error("Invalid upstream commit");
run("git", ["checkout", "--detach", commit], {cwd: checkout});
run("git", ["config", "user.name", "gridcraft-embed updater"], {cwd: checkout});
run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], {cwd: checkout});
// Three-way application uses the pinned patch's original blobs, preserving our changes.
// A conflict aborts the run before committing or publishing anything.
run("git", ["apply", "--3way", path.resolve(root, "patches/embed.patch")], {cwd: checkout});
const vendor = path.resolve(root, "rust/gridcraft");
if (vendor !== path.join(root, "rust", "gridcraft")) throw new Error("Unsafe vendor destination");
rmSync(vendor, {recursive: true, force: true});
mkdirSync(vendor, {recursive: true});
cpSync(checkout, vendor, {recursive: true, filter: source => path.relative(checkout, source).split(path.sep)[0] !== ".git"});
const pkg = readJson("package.json");
pkg.version = nextVersion(pkg.version, plan.release);
pkg.gridcraftUpstream = {repository: previous.repository, releaseId: plan.release.id, tag: plan.release.tag_name, commit};
writeJson("package.json", pkg);
const lock = readJson("package-lock.json");
lock.version = pkg.version;
lock.packages[""].version = pkg.version;
lock.packages[""].gridcraftUpstream = pkg.gridcraftUpstream;
writeJson("package-lock.json", lock);
const state = {...previous, releaseId: plan.release.id, tag: plan.release.tag_name, commit,
  publishedAt: plan.release.published_at, prerelease: plan.release.prerelease, packageVersion: pkg.version, status: "pending"};
writeJson("upstream-state.json", state);
writeFileSync("UPSTREAM.md", `# Upstream provenance\n\nSource: https://github.com/${state.repository}\n\nPinned upstream release: [${state.tag}](${plan.release.html_url}).\n\nPinned commit: \`${commit}\`.\n\nThis independently maintained, unofficial React embedding preserves upstream licenses and contributor credits. Local integration changes are maintained in patches/embed.patch against ${state.patchBase}. They add the browser embedding API, cells-only mode, browser clocks, and dark grid rendering.\n`);
console.log(`Prepared ${pkg.name}@${pkg.version} from ${state.tag} (${commit})`);
