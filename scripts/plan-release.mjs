import {appendFileSync, mkdirSync} from "node:fs";
import {github, nextRelease, readJson, run, writeJson} from "./release-lib.mjs";
import {candidatePlan, integrationFingerprint, readCandidateLedger} from "./candidate-lib.mjs";
import {resolveUpstreamTag} from "./upstream.mjs";
mkdirSync(".work", {recursive: true});
const state = readJson("upstream-state.json");
let release;
if (state.status !== "pending") {
  const releases = [];
  for (let page = 1; ; page++) {
    const batch = await github(`/repos/${state.repository}/releases?per_page=100&page=${page}`);
    releases.push(...batch);
    if (batch.length < 100) break;
    if (page >= 100) throw new Error("Release pagination limit reached; refusing to skip releases");
  }
  release = nextRelease(releases, state);
}
const repository = process.env.GITHUB_REPOSITORY;
const {ledger} = repository ? await readCandidateLedger(github, repository) : {ledger: {failures: {}}};
const commit = release ? resolveUpstreamTag(state.repository, release.tag_name) : state.commit;
const plan = candidatePlan(state, release, commit, integrationFingerprint(process.cwd()), ledger, {
  forceBuild: process.env.GITHUB_EVENT_NAME === "push" || process.env.FORCE_BUILD === "true",
  retryFailed: process.env.RETRY_FAILED === "true",
});
plan.sourceSha = run("git", ["rev-parse", "HEAD"]);
writeJson(".work/release-plan.json", plan);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, ["changed", "update", "build", "blocked"].map(key => `${key}=${plan[key]}\n`).join("") + `source_sha=${plan.sourceSha}\n`);
const message = plan.blocked ? `Candidate ${release?.tag_name ?? state.tag} is awaiting an integration fix or manual retry. Previous failure: ${plan.previousFailure.runUrl}`
  : plan.update ? `Validate upstream candidate: ${release.tag_name} (${commit})`
  : state.status === "pending" ? `Retry pending package ${state.packageVersion}`
  : plan.build ? "Validate the current pinned release without publishing" : "Upstream is already current";
console.log(message);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${message}\n`);
