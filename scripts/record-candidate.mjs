import {github, readJson} from "./release-lib.mjs";
import {recordCandidateFailure} from "./candidate-lib.mjs";
const plan = readJson(".work/release-plan.json");
await recordCandidateFailure(github, process.env.GITHUB_REPOSITORY, plan, {
  sourceSha: plan.sourceSha, stage: process.env.FAILURE_STAGE,
  runUrl: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
});
console.log("Recorded failed candidate; unchanged schedules will wait for a fix or manual retry.");
