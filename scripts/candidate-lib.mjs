import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {directoryDigest} from "./embedding.mjs";

export const candidateBranch = "upstream-candidates";
export const candidateFile = "upstream-candidates.json";
export function integrationFingerprint(root) {
  const hash = createHash("sha256");
  for (const dir of ["scripts", "rust", "patches", "test"]) hash.update(dir).update(directoryDigest(path.join(root, dir)));
  for (const file of ["package.json", "package-lock.json", "upstream-state.json", ".github/workflows/upstream-release.yml", "dist/index.js", "dist/index.d.ts", "dist/react.js", "dist/react.d.ts"]) {
    hash.update(file).update("\0").update(readFileSync(path.join(root, file))).update("\0");
  }
  return hash.digest("hex");
}
export function candidatePlan(state, release, commit, fingerprint, ledger = {failures: {}}, {forceBuild = false, retryFailed = false} = {}) {
  const changed = state.status === "pending" || Boolean(release);
  const key = `${release?.id ?? state.releaseId}:${commit}:${fingerprint}`;
  const failure = ledger.failures?.[key];
  const blocked = changed && Boolean(failure) && !retryFailed;
  return {changed: changed && !blocked, update: Boolean(release) && !blocked,
    build: !blocked && (changed || forceBuild), blocked, key, commit, fingerprint,
    release: release ?? null, previousFailure: blocked ? failure : null};
}
export async function readCandidateLedger(api, repository) {
  const file = await api(`/repos/${repository}/contents/${candidateFile}?ref=${candidateBranch}`, {allowMissing: true});
  if (!file) return {ledger: {version: 1, failures: {}}, sha: undefined};
  const ledger = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
  if (ledger.version !== 1 || !ledger.failures || typeof ledger.failures !== "object" || Array.isArray(ledger.failures)) throw new Error("Invalid candidate ledger; refusing to ignore validation failures");
  return {ledger, sha: file.sha};
}
export async function recordCandidateFailure(api, repository, plan, {sourceSha, runUrl, stage, now = new Date().toISOString()}) {
  if (!plan.changed || !plan.build || !/^[a-f0-9]{40}$/.test(plan.commit) || !plan.key || !stage) throw new Error("No active candidate failure to record");
  const {ledger, sha} = await readCandidateLedger(api, repository);
  const ref = await api(`/repos/${repository}/git/ref/heads/${candidateBranch}`, {allowMissing: true});
  if (!ref) await api(`/repos/${repository}/git/refs`, {method: "POST", body: {ref: `refs/heads/${candidateBranch}`, sha: sourceSha}});
  ledger.failures[plan.key] = {commit: plan.commit, fingerprint: plan.fingerprint, tag: plan.release?.tag_name ?? null, stage, runUrl, failedAt: now};
  await api(`/repos/${repository}/contents/${candidateFile}`, {method: "PUT", body: {
    branch: candidateBranch, sha, message: `chore: record upstream candidate failure (${stage})`,
    content: Buffer.from(JSON.stringify(ledger, null, 2) + "\n").toString("base64"),
  }});
}
export const fileIntegrity = file => `sha512-${createHash("sha512").update(readFileSync(file)).digest("base64")}`;
export function verifyValidation(receipt, state, pkg, integrity, sourceIntegrity) {
  if (receipt.version !== 1 || receipt.packageVersion !== pkg.version || receipt.releaseId !== state.releaseId ||
      receipt.commit !== state.commit || receipt.integrity !== integrity || receipt.sourceIntegrity !== sourceIntegrity) {
    throw new Error("Release artifacts do not match the validated candidate");
  }
}
