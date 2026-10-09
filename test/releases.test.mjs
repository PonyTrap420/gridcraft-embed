import {test} from "node:test";
import assert from "node:assert/strict";
import {nextRelease, nextVersion, run} from "../scripts/release-lib.mjs";
test("commands support inherited output and preserve failures", () => {
  assert.equal(run(process.execPath, ["-e", "process.stdout.write(' value ')"]), "value");
  assert.equal(run(process.execPath, ["-e", ""], {stdio: "inherit"}), "");
  assert.throws(() => run(process.execPath, ["-e", "process.exit(1)"], {stdio: "inherit"}));
});
test("releases are processed in publication order without skipping a backlog", () => {
  const state = {releaseId: 10, publishedAt: "2026-10-08T10:00:00Z"};
  const releases = [{id: 12, published_at: "2026-10-09T10:00:00Z"}, {id: 11, published_at: state.publishedAt}, {id: 10, published_at: state.publishedAt}, {id: 13, draft: true, published_at: "2026-10-08T11:00:00Z"}];
  assert.equal(nextRelease(releases, state).id, 11);
  assert.equal(nextRelease(releases, {...state, releaseId: 11}).id, 12);
  assert.equal(nextRelease(releases, {releaseId: 12, publishedAt: releases[0].published_at}), undefined);
});
test("stable and prerelease packages remain monotonic", () => {
  assert.equal(nextVersion("0.1.2", {id: 20, prerelease: false}), "0.1.3");
  assert.equal(nextVersion("0.1.3", {id: 21, prerelease: true}), "0.1.4-upstream.21");
  assert.equal(nextVersion("0.1.4-upstream.21", {id: 22, prerelease: false}), "0.1.5");
  assert.throws(() => nextVersion("invalid", {}));
});
