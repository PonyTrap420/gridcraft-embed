import {appendFileSync, existsSync} from "node:fs";
import {readJson} from "./release-lib.mjs";
const patch = existsSync(".work/compatibility-failure.json") ? readJson(".work/compatibility-failure.json").stage : "";
const infrastructure = existsSync(".work/infrastructure-failure.json") ? readJson(".work/infrastructure-failure.json").stage : "";
const stage = patch || ["compile", "licenses", "tests", "browser"].find(name => process.env[name.toUpperCase()] === "failure" && name !== infrastructure) || "";
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `stage=${stage}\n`);
console.log(stage ? `Candidate validation failed at ${stage}` : "Infrastructure failure: allow the next scheduled attempt to retry");
