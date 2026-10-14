import {createHash} from "node:crypto";
import {existsSync, mkdirSync, readFileSync, rmSync} from "node:fs";
import {fileURLToPath} from "node:url";
import path from "node:path";
import {readJson, run, writeJson} from "./release-lib.mjs";
import {directoryDigest, installEmbedding} from "./embedding.mjs";

export const packageRoot = fileURLToPath(new URL("../", import.meta.url));
const digest = value => createHash("sha256").update(value).digest("hex");
function repositoryUrl(repository) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error("Invalid upstream repository");
  return `https://github.com/${repository}.git`;
}
export function resolveUpstreamTag(repository, tag) {
  const ref = `refs/tags/${tag}`;
  run("git", ["check-ref-format", ref]);
  const refs = new Map(run("git", ["ls-remote", "--exit-code", repositoryUrl(repository), ref, `${ref}^{}`])
    .split(/\r?\n/).map(line => line.split(/\s+/).reverse()));
  const commit = refs.get(`${ref}^{}`) ?? refs.get(ref);
  if (!/^[a-f0-9]{40}$/.test(commit ?? "")) throw new Error(`Upstream tag missing: ${tag}`);
  return commit;
}
export function prepareUpstream(state = readJson(path.join(packageRoot, "upstream-state.json")), {root = packageRoot, url = repositoryUrl(state.repository)} = {}) {
  if (![state.commit, state.patchBase].every(value => /^[a-f0-9]{40}$/.test(value))) throw new Error("Upstream commits must be pinned SHA-1 hashes");
  const work = path.resolve(root, ".work");
  rmSync(path.join(work, "compatibility-failure.json"), {force: true});
  const source = path.join(work, "upstream");
  const receiptPath = path.join(work, "upstream-prepared.json");
  const patch = path.resolve(root, "patches/embed.patch");
  const embedding = path.join(root, "rust/embed");
  const identity = {url, commit: state.commit, patchDigest: digest(readFileSync(patch)),
    embeddingDigest: existsSync(embedding) ? directoryDigest(embedding) : null};
  const git = args => run("git", args, {cwd: source});
  if (existsSync(source)) {
    const receipt = existsSync(receiptPath) ? readJson(receiptPath) : {};
    if (Object.entries(identity).some(([key, value]) => receipt[key] !== value) || !existsSync(path.join(source, ".git"))) {
      throw new Error("Upstream checkout differs from the pinned source or patch. Use a fresh .work directory; existing files were preserved.");
    }
    if (git(["rev-parse", "HEAD"]) !== state.commit || git(["remote", "get-url", "origin"]) !== url ||
        git(["diff", "--name-only"]) || git(["write-tree"]) !== receipt.tree || git(["ls-files", "--others", "--exclude-standard"])) {
      throw new Error("Prepared upstream source was modified; existing files were preserved. Use GRIDCRAFT_SOURCE for a custom checkout.");
    }
    return source;
  }
  mkdirSync(work, {recursive: true});
  run("git", ["clone", "--filter=blob:none", "--no-checkout", url, source]);
  git(["config", "core.autocrlf", "false"]);
  git(["config", "user.name", "gridcraft-embed updater"]);
  git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  git(["cat-file", "-e", `${state.patchBase}^{commit}`]);
  git(["checkout", "--detach", state.commit]);
  // Partial clones may lack the patch's old blobs, especially an older lockfile.
  // Materialize those exact base files so git apply can use a three-way merge.
  for (const block of readFileSync(patch, "utf8").split(/^diff --git /m).slice(1)) {
    const basePath = /^a\/(.+) b\//.exec(block)?.[1];
    if (basePath && !/^new file mode /m.test(block)) git(["show", `${state.patchBase}:${basePath}`]);
  }
  try {
    git(["apply", "--3way", patch]);
    if (identity.embeddingDigest) installEmbedding(source, embedding);
  } catch (error) {
    writeJson(path.join(work, "compatibility-failure.json"), {stage: "patch", commit: state.commit});
    throw error;
  }
  git(["add", "-A"]);
  writeJson(receiptPath, {...identity, tree: git(["write-tree"])});
  console.log(`Prepared ${state.repository}@${state.tag ?? state.commit} in .work/upstream`);
  return source;
}
export function getUpstreamSource() {
  return process.env.GRIDCRAFT_SOURCE ? path.resolve(process.env.GRIDCRAFT_SOURCE) : prepareUpstream();
}
