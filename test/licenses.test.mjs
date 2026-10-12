import {test} from "node:test";
import assert from "node:assert/strict";
import {pinnedLicenseSource} from "../scripts/license-lib.mjs";

const commit = "d27646a5f7c8b4fc85d9dd3213b8c88b58e0088d";
const pkg = {name: "craft-ui", version: "0.1.0"};
test("Git dependency licenses use Cargo's resolved repository and exact commit", () => {
  for (const selector of [`rev=${commit}`, "branch=main"]) {
    assert.equal(pinnedLicenseSource({...pkg,
      source: `git+https://github.com/storytold/craft-libs.git?${selector}#${commit}`,
      repository: "https://github.com/other/project",
    }), `https://raw.githubusercontent.com/storytold/craft-libs/${commit}`);
  }
});
test("registry dependency licenses retain the crate's recorded source commit", () => {
  assert.equal(pinnedLicenseSource({...pkg, source: "registry+https://github.com/rust-lang/crates.io-index",
    repository: "https://github.com/storytold/craft-libs.git"}, {git: {sha1: commit}}),
    `https://raw.githubusercontent.com/storytold/craft-libs/${commit}`);
});
test("missing or mutable source pins cannot substitute unrelated registry metadata", () => {
  for (const source of ["git+https://github.com/storytold/craft-libs?branch=main",
    "git+https://github.com/storytold/craft-libs#main", "git+https://example.com/project#" + commit]) {
    assert.throws(() => pinnedLicenseSource({...pkg, source,
      repository: "https://github.com/storytold/craft-libs"}, {git: {sha1: commit}}), /Pinned license source missing/);
  }
  assert.throws(() => pinnedLicenseSource({...pkg, repository: "https://github.com/storytold/craft-libs"}), /Pinned license source missing/);
});
