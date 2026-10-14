import {readJson, writeJson} from "./release-lib.mjs";
import {fileIntegrity} from "./candidate-lib.mjs";
const state = readJson("upstream-state.json");
const pkg = readJson("package.json");
const plan = readJson(".work/release-plan.json");
if (!plan.build || plan.commit !== state.commit || pkg.version !== state.packageVersion) throw new Error("Build does not match its candidate plan");
writeJson(".work/validated-candidate.json", {version: 1, packageVersion: pkg.version, releaseId: state.releaseId,
  commit: state.commit, key: plan.key, sourceSha: plan.sourceSha,
  integrity: fileIntegrity(`.work/${pkg.name}-${pkg.version}.tgz`), sourceIntegrity: fileIntegrity(".work/source.tar.gz")});
