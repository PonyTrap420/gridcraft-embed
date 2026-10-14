import {test} from "node:test";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import os from "node:os";
import path from "node:path";

test("infrastructure failures remain retryable while patch, compile and test failures are recorded", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "gridcraft-classify-"));
  try {
    mkdirSync(path.join(root, ".work"));
    const output = path.join(root, "output");
    const script = fileURLToPath(new URL("../scripts/classify-candidate.mjs", import.meta.url));
    const classify = (outcomes = {}) => {
      writeFileSync(output, "");
      execFileSync(process.execPath, [script], {cwd: root, env: {...process.env,
        COMPILE: "skipped", LICENSES: "skipped", TESTS: "skipped", BROWSER: "skipped", ...outcomes, GITHUB_OUTPUT: output}});
      return readFileSync(output, "utf8");
    };
    assert.equal(classify(), "stage=\n");
    assert.equal(classify({COMPILE: "failure"}), "stage=compile\n");
    assert.equal(classify({TESTS: "failure"}), "stage=tests\n");
    assert.equal(classify({LICENSES: "failure"}), "stage=licenses\n");
    writeFileSync(path.join(root, ".work/infrastructure-failure.json"), '{"stage":"licenses"}');
    assert.equal(classify({LICENSES: "failure"}), "stage=\n");
    writeFileSync(path.join(root, ".work/compatibility-failure.json"), '{"stage":"patch"}');
    assert.equal(classify(), "stage=patch\n");
  } finally {
    assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep + "gridcraft-classify-"));
    rmSync(root, {recursive: true, force: true});
  }
});
