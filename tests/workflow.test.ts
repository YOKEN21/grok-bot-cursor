import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { readJson } from "../src/config/schema.js";
import { repoRoot } from "./helpers.js";

const root = repoRoot();
const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
const review = readFileSync(path.join(root, ".github/workflows/grok-review.yml"), "utf8");

test("ci verify runs on pull_request with Node 22 and no secrets", () => {
  assert.match(ci, /^name:\s*ci\s*$/m);
  assert.match(ci, /^on:\n {2}pull_request:\s*$/m);
  assert.match(ci, /name:\s*ci \/ verify/);
  assert.match(ci, /node-version:\s*22\b/);
  assert.match(ci, /npm run typecheck/);
  assert.match(ci, /npm run validate-config/);
  assert.match(ci, /npm test/);
  assert.doesNotMatch(ci, /pull_request_target/);
  assert.doesNotMatch(ci, /secrets\./);
  assert.doesNotMatch(ci, /XAI_/);
  const pkg = readJson(path.join(root, "package.json")) as { engines?: { node?: string }; scripts?: { typecheck?: string } };
  assert.equal(pkg.engines?.node, ">=22.14.0");
  assert.equal(pkg.scripts?.typecheck, "tsc --noEmit");
});

test("grok-review checks out main and treats the pull request as data", () => {
  assert.match(review, /^name:\s*grok-review\s*$/m);
  assert.match(review, /^on:\n {2}pull_request_target:\s*$/m);
  assert.match(review, /ref:\s*main/);
  assert.match(review, /persist-credentials:\s*false/);
  assert.match(review, /secrets\.XAI_API_KEY/);
  assert.match(review, /vars\.XAI_MODEL/);
  assert.match(review, /application\/vnd\.github\.diff/);
  assert.match(review, /grok-review-evidence\.json/);
  assert.match(review, /GITHUB_STEP_SUMMARY/);
  assert.match(review, /--post-status/);
  assert.match(review, /--recheck-head/);
  assert.match(review, /statuses:\s*write/);
  assert.doesNotMatch(review, /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/);
  assert.doesNotMatch(review, /github\.event\.pull_request\.head\.repo/);
  assert.doesNotMatch(review, /refs\/pull\//);
  assert.doesNotMatch(review, /npm test/);
  assert.doesNotMatch(review, /npm run check/);
});
