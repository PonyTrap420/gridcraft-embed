import {test} from "node:test";
import assert from "node:assert/strict";
import {candidatePlan, recordCandidateFailure, readCandidateLedger, verifyValidation} from "../scripts/candidate-lib.mjs";

const state = {status: "published", releaseId: 1, commit: "a".repeat(40)};
const release = {id: 2, tag_name: "v2"};
const commit = "b".repeat(40);
const fingerprint = "c".repeat(64);

test("failed candidates wait until integration changes or a manual retry; the published pin stays intact", () => {
  const before = structuredClone(state);
  const initial = candidatePlan(state, release, commit, fingerprint);
  const ledger = {failures: {[initial.key]: {runUrl: "https://example.invalid/failed-run"}}};
  const blocked = candidatePlan(state, release, commit, fingerprint, ledger);
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.build, false);
  assert.equal(blocked.changed, false);
  assert.equal(blocked.update, false);
  assert.equal(candidatePlan(state, release, commit, fingerprint, ledger, {forceBuild: true}).build, false);
  assert.equal(candidatePlan(state, release, commit, "d".repeat(64), ledger).build, true);
  assert.equal(candidatePlan(state, release, "e".repeat(40), fingerprint, ledger).build, true);
  assert.equal(candidatePlan(state, release, commit, fingerprint, ledger, {retryFailed: true}).build, true);
  assert.deepEqual(state, before);
});

test("current-source validation never republishes and pending publication is retried", () => {
  const current = candidatePlan(state, undefined, state.commit, fingerprint, undefined, {forceBuild: true});
  assert.equal(current.build, true);
  assert.equal(current.changed, false);
  const pending = candidatePlan({...state, status: "pending"}, undefined, state.commit, fingerprint);
  assert.equal(pending.changed, true);
  assert.equal(pending.update, false);
  assert.equal(pending.build, true);
});

test("failure records persist on a separate branch and retain previous failures", async () => {
  const requests = [];
  let file;
  let branch;
  const api = async (url, options = {}) => {
    requests.push({url, ...options});
    if (options.method === "POST") {branch = true; return {};}
    if (options.method === "PUT") {file = {content: options.body.content, sha: "new-file-sha"}; return {};}
    return url.includes("/contents/") ? file ?? null : branch ? {} : null;
  };
  const plan = candidatePlan(state, release, commit, fingerprint);
  await recordCandidateFailure(api, "owner/repo", plan, {sourceSha: state.commit, runUrl: "run-1", stage: "patch"});
  const first = await readCandidateLedger(api, "owner/repo");
  assert.equal(first.ledger.failures[plan.key].stage, "patch");
  const repaired = candidatePlan(state, release, commit, "d".repeat(64));
  await recordCandidateFailure(api, "owner/repo", repaired, {sourceSha: state.commit, runUrl: "run-2", stage: "compile"});
  const second = await readCandidateLedger(api, "owner/repo");
  assert.equal(Object.keys(second.ledger.failures).length, 2);
  assert.equal(requests.filter(r => r.method === "POST").length, 1);
  assert.ok(requests.filter(r => r.method === "PUT").every(r => r.body.branch === "upstream-candidates"));
  assert.equal(requests.filter(r => r.method === "PUT")[1].body.sha, "new-file-sha");
});

test("invalid failure records and changed release artifacts cannot be promoted", async () => {
  await assert.rejects(readCandidateLedger(async () => ({content: Buffer.from('{"version":2}').toString("base64")}), "owner/repo"), /Invalid candidate ledger/);
  const pkg = {version: "1.0.0"};
  const receipt = {version: 1, packageVersion: pkg.version, releaseId: state.releaseId, commit: state.commit, integrity: "tarball", sourceIntegrity: "source"};
  verifyValidation(receipt, state, pkg, "tarball", "source");
  for (const [key, value] of Object.entries({packageVersion: "other", releaseId: 2, commit, integrity: "changed", sourceIntegrity: "changed"})) {
    assert.throws(() => verifyValidation({...receipt, [key]: value}, state, pkg, "tarball", "source"), /validated candidate/);
  }
});
