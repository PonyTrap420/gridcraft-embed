import {test} from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {prepareUpstream} from "../scripts/upstream.mjs";
import {run} from "../scripts/release-lib.mjs";

test("upstream fetch pins the commit, applies the patch and preserves local edits", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "gridcraft-upstream-"));
  try {
    const origin = path.join(root, "origin");
    const wrapper = path.join(root, "wrapper");
    mkdirSync(origin); mkdirSync(path.join(wrapper, "patches"), {recursive: true});
    const git = args => run("git", args, {cwd: origin});
    git(["init", "--quiet"]);
    git(["config", "user.name", "test"]); git(["config", "user.email", "test@example.invalid"]);
    git(["config", "core.autocrlf", "false"]);
    writeFileSync(path.join(origin, "runtime.txt"), "original\n");
    git(["add", "."]); git(["commit", "--quiet", "-m", "initial"]);
    const patchBase = git(["rev-parse", "HEAD"]);
    writeFileSync(path.join(origin, "runtime.txt"), "embedded\n");
    writeFileSync(path.join(wrapper, "patches/embed.patch"), git(["diff", "--binary"]) + "\n");
    git(["restore", "runtime.txt"]);
    writeFileSync(path.join(origin, "new-upstream-feature.txt"), "new feature\n");
    git(["add", "."]); git(["commit", "--quiet", "-m", "next upstream release"]);
    const commit = git(["rev-parse", "HEAD"]);
    const state = {repository: "example/upstream", patchBase, commit, tag: "v2"};
    const options = {root: wrapper, url: origin};
    const source = prepareUpstream(state, options);
    assert.equal(run("git", ["rev-parse", "HEAD"], {cwd: source}), commit);
    assert.equal(readFileSync(path.join(source, "runtime.txt"), "utf8"), "embedded\n");
    assert.equal(readFileSync(path.join(source, "new-upstream-feature.txt"), "utf8"), "new feature\n");
    assert.equal(prepareUpstream(state, options), source);
    assert.throws(() => prepareUpstream({...state, commit: patchBase}, options), /existing files were preserved/);
    writeFileSync(path.join(source, "runtime.txt"), "local edit\n");
    assert.throws(() => prepareUpstream(state, options), /source was modified/);
    assert.equal(readFileSync(path.join(source, "runtime.txt"), "utf8"), "local edit\n");
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "gridcraft-upstream-"));
    rmSync(root, {recursive: true, force: true});
  }
});
