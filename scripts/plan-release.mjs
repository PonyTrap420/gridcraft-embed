import {appendFileSync, mkdirSync} from "node:fs";
import {github, nextRelease, readJson, writeJson} from "./release-lib.mjs";
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
const plan = {changed: state.status === "pending" || Boolean(release), update: Boolean(release), release: release ?? null};
writeJson(".work/release-plan.json", plan);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${plan.changed}\nupdate=${plan.update}\n`);
console.log(plan.update ? `Next upstream release: ${release.tag_name}` : state.status === "pending" ? `Retry pending package ${state.packageVersion}` : "Upstream is already current");
