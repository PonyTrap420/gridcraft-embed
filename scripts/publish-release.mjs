import {github, readJson, registryVersion, run, writeJson} from "./release-lib.mjs";
import {fileIntegrity, verifyValidation} from "./candidate-lib.mjs";
const state = readJson("upstream-state.json");
const pkg = readJson("package.json");
if (state.status !== "pending" || state.packageVersion !== pkg.version) throw new Error("No pending release matches package.json");
const filename = `${pkg.name}-${pkg.version}.tgz`;
const integrity = fileIntegrity(`.work/artifacts/${filename}`);
verifyValidation(readJson(".work/artifacts/validated-candidate.json"), state, pkg, integrity, fileIntegrity(".work/artifacts/source.tar.gz"));
run("git", ["config", "user.name", "github-actions[bot]"]);
run("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
run("git", ["add", "package.json", "package-lock.json", "upstream-state.json", "UPSTREAM.md", "LICENSE-MIT", "LICENSE-APACHE", "NOTICE"]);
if (run("git", ["diff", "--cached", "--name-only"])) {
  run("git", ["commit", "-m", `chore: sync upstream ${state.tag}`]);
  run("git", ["push", "origin", "HEAD:main"]);
}
let published = await registryVersion(pkg.name, pkg.version);
const existedBeforePublish = Boolean(published);
if (published && published.gridcraftUpstream?.releaseId !== state.releaseId) throw new Error("Existing version belongs to a different upstream release");
if (!published) run("npm", ["publish", `.work/artifacts/${filename}`, "--access", "public", "--provenance", "--tag", state.prerelease ? "next" : "latest"], {stdio: "inherit"});
for (let attempt = 0; attempt < 30 && !published; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 10000));
  published = await registryVersion(pkg.name, pkg.version);
}
if (!published) throw new Error("npm processing is still pending; the next run will retry this version");
if (published.gridcraftUpstream?.releaseId !== state.releaseId) throw new Error("Registry upstream metadata mismatch");
// A retry may rebuild a tarball with different metadata. For a fresh publish verify its bytes.
if (!existedBeforePublish && published.dist.integrity !== integrity) throw new Error("Registry integrity mismatch");
const tag = `v${pkg.version}`;
if (!run("git", ["tag", "--list", tag])) {run("git", ["tag", tag]); run("git", ["push", "origin", tag]);}
const releases = await github(`/repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100`);
if (!releases.some(release => release.tag_name === tag)) await github(`/repos/${process.env.GITHUB_REPOSITORY}/releases`, {method: "POST", body: {
  tag_name: tag, name: `gridcraft-embed ${pkg.version}`, prerelease: state.prerelease,
  body: `Built and tested from [Gridcraft ${state.tag}](https://github.com/${state.repository}/releases/tag/${state.tag}) at ${state.commit}.\n\nInstall: \`npm install ${pkg.name}@${pkg.version}\`\n\nPreserves the React API, cells-only presentation and dark grid integration.`,
}});
// Keep the release pending until both registries are complete so retries can finish either step.
writeJson("upstream-state.json", {...state, status: "published", npmIntegrity: published.dist.integrity});
run("git", ["add", "upstream-state.json"]);
if (run("git", ["diff", "--cached", "--name-only"])) run("git", ["commit", "-m", `chore: confirm release ${pkg.version}`]);
run("git", ["push", "origin", "HEAD:main"]);
console.log(`Published ${pkg.name}@${pkg.version} from ${state.tag}`);
