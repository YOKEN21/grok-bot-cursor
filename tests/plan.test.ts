import assert from "node:assert/strict";
import test from "node:test";
import { assessPlan } from "../src/plan/assess.js";
import { parsePlan, planHash } from "../src/plan/parse.js";
import { filesOutsideAllowedPaths } from "../src/plan/scope.js";
import { approvalBody, BASE_SHA, dispatchBody, HEAD_SHA, planBody } from "./helpers.js";

function assess(options?: {
  pullBody?: string;
  comments?: { body: string }[];
  pullBaseSha?: string;
  reviewedSha?: string;
  currentHeadSha?: string;
}) {
  return assessPlan({
    pullBody: options?.pullBody ?? "Issue: #7\n",
    comments: options?.comments ?? [],
    pullBaseSha: options?.pullBaseSha ?? BASE_SHA,
    reviewedSha: options?.reviewedSha ?? HEAD_SHA,
    currentHeadSha: options?.currentHeadSha ?? HEAD_SHA,
  });
}

test("a stale plan revision fails", () => {
  const first = planBody({ revision: 1 });
  const second = planBody({ revision: 2, change: "Set desiredCount from 3 to 4 and record the rehearsal." });
  const result = assess({ comments: [{ body: first }, { body: approvalBody(first) }, { body: second }] });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("\n"), /stale plan: approval is for v1 but the latest plan is v2/);
});

test("a stale base SHA fails", () => {
  const plan = planBody();
  const result = assess({
    comments: [{ body: plan }, { body: approvalBody(plan) }],
    pullBaseSha: "d".repeat(40),
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("\n"), /stale plan: base SHA/);
});

test("an edited plan fails the hash check", () => {
  const plan = planBody();
  const approval = approvalBody(plan).replace(planHash(plan), "0".repeat(64));
  const result = assess({ comments: [{ body: plan }, { body: approval }] });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("\n"), /stale plan: approval plan hash/);
});

test("a stale head fails", () => {
  const plan = planBody();
  const result = assess({
    comments: [{ body: plan }, { body: approvalBody(plan) }],
    currentHeadSha: "c".repeat(40),
  });
  assert.equal(result.ok, false);
  assert.match(result.reasons.join("\n"), /stale head/);
});

test("a duplicate dispatch is detected and does not by itself fail the plan", () => {
  const plan = planBody();
  const once = assess({
    comments: [{ body: plan }, { body: approvalBody(plan) }, { body: dispatchBody(7, 1, "run-a") }],
  });
  assert.equal(once.ok, true);
  assert.equal(once.duplicateDispatch, false);

  const twice = assess({
    comments: [
      { body: plan },
      { body: approvalBody(plan) },
      { body: dispatchBody(7, 1, "run-a") },
      { body: dispatchBody(7, 1, "run-b") },
    ],
  });
  assert.equal(twice.ok, true);
  assert.equal(twice.duplicateDispatch, true);

  const otherRevision = assess({
    comments: [
      { body: plan },
      { body: approvalBody(plan) },
      { body: dispatchBody(7, 1, "run-a") },
      { body: dispatchBody(7, 2, "run-b") },
    ],
  });
  assert.equal(otherRevision.duplicateDispatch, false);
});

test("missing Issue, plan, or approval fails", () => {
  const missingIssue = assess({ pullBody: "No issue link" });
  assert.match(missingIssue.reasons.join("\n"), /missing Issue/);

  const missingPlan = assess({ comments: [{ body: "hello" }] });
  assert.match(missingPlan.reasons.join("\n"), /missing plan/);

  const incomplete = assess({ comments: [{ body: "[Plan] #7 v1\n\nChange: raise replicas\n" }] });
  assert.match(incomplete.reasons.join("\n"), /plan comment is incomplete/);

  const plan = planBody();
  const missingApproval = assess({ comments: [{ body: plan }] });
  assert.match(missingApproval.reasons.join("\n"), /missing approval/);
});

test("allow-list matching is exact, prefix, or glob, and an empty list allows nothing", () => {
  assert.deepEqual(filesOutsideAllowedPaths(["README.md"], []), ["README.md"]);
  assert.deepEqual(
    filesOutsideAllowedPaths(
      ["services/matter/matter-search/config.json", "README.md"],
      ["services/matter/matter-search/config.json"],
    ),
    ["README.md"],
  );
  assert.deepEqual(filesOutsideAllowedPaths(["src/config/cli.ts"], ["src/config/"]), []);
  assert.deepEqual(filesOutsideAllowedPaths(["tests/fixtures/sample.diff"], ["tests/**"]), []);
  const parsed = parsePlan(planBody());
  assert.ok(parsed && "plan" in parsed);
  assert.equal(parsed.plan.allowedPaths[0], "services/matter/matter-search/config.json");
});
