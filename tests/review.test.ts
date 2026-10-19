import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateInstance } from "../src/config/schema.js";
import {
  buildResponsesBody,
  extractOutputText,
  MalformedOutputError,
  parseFindings,
  redactSecrets,
  requestReview,
  RESPONSES_ENDPOINT,
  ResponsesApiError,
  type ReviewProvider,
} from "../src/review/client.js";
import { MAX_DIFF_CHARS } from "../src/review/diff.js";
import { buildCommitStatus, PASS_FAIL_RULE, renderSummary, STATUS_CONTEXT } from "../src/review/evidence.js";
import { findingsSchema } from "../src/review/findings.js";
import { reviewPullRequest } from "../src/review/review.js";
import { approvalBody, BASE_SHA, HEAD_SHA, planBody, repoRoot } from "./helpers.js";

const root = repoRoot();
const sampleDiff = readFileSync(path.join(root, "tests/fixtures/sample.diff"), "utf8");
const API_KEY = "test-api-key-value";

function findingsJson(findings: { severity: string; path: string; message: string }[], summary = "reviewed"): string {
  return JSON.stringify({ summary, findings });
}

function providerReturning(text: string): ReviewProvider & { calls: number } {
  const state = { calls: 0 };
  return {
    get calls() {
      return state.calls;
    },
    async complete() {
      state.calls += 1;
      return text;
    },
  };
}

function review(options?: {
  diff?: string;
  comments?: { body: string }[];
  pullBody?: string;
  currentHeadSha?: string;
  provider?: ReviewProvider;
  model?: string | null;
  secrets?: string[];
}) {
  const plan = planBody();
  return reviewPullRequest({
    pullBody: options?.pullBody ?? "Issue: #7\n",
    comments: options?.comments ?? [{ body: plan }, { body: approvalBody(plan) }],
    diff: options?.diff ?? sampleDiff,
    pullBaseSha: BASE_SHA,
    reviewedSha: HEAD_SHA,
    currentHeadSha: options?.currentHeadSha ?? HEAD_SHA,
    model: options?.model === undefined ? "grok-test" : options.model,
    endpoint: RESPONSES_ENDPOINT,
    provider: options?.provider,
    secrets: options?.secrets,
  });
}

test("a blocking finding fails the review and suggestions alone pass", async () => {
  const blocking = await review({
    provider: providerReturning(
      findingsJson([{ severity: "blocking", path: "services/matter/matter-search/config.json", message: "count left at 3" }]),
    ),
  });
  assert.equal(blocking.result, "fail");
  assert.equal(blocking.findings[0]?.severity, "blocking");

  const suggestions = await review({
    provider: providerReturning(
      findingsJson([{ severity: "suggestion", path: "services/matter/matter-search/config.json", message: "mention the rehearsal" }]),
    ),
  });
  assert.equal(suggestions.result, "pass");
  assert.equal(suggestions.reasons.length, 0);
  assert.equal(suggestions.findings.every((finding) => finding.severity === "suggestion"), true);

  const empty = await review({ provider: providerReturning(findingsJson([])) });
  assert.equal(empty.result, "pass");
});

test("an API error or malformed output fails the review", async () => {
  const api = await review({
    provider: {
      async complete() {
        throw new ResponsesApiError("responses request failed with HTTP 500");
      },
    },
  });
  assert.equal(api.result, "fail");
  assert.match(api.reasons.join("\n"), /API error/);

  const malformed = await review({ provider: providerReturning("not json") });
  assert.equal(malformed.result, "fail");
  assert.match(malformed.reasons.join("\n"), /malformed model output/);

  const extra = await review({
    provider: providerReturning(JSON.stringify({ summary: "x", findings: [], decision: "GO" })),
  });
  assert.equal(extra.result, "fail");
  assert.match(extra.reasons.join("\n"), /malformed model output/);
});

test("a stale head does not call the provider", async () => {
  const provider = providerReturning(findingsJson([]));
  const result = await review({ provider, currentHeadSha: "c".repeat(40) });
  assert.equal(provider.calls, 0);
  assert.equal(result.result, "fail");
  assert.match(result.reasons.join("\n"), /stale head/);
});

test("a path outside the allow-list is a blocking finding", async () => {
  const diff = [
    "diff --git a/README.md b/README.md",
    "index 1111111..2222222 100644",
    "--- a/README.md",
    "+++ b/README.md",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");
  const result = await review({ diff, provider: providerReturning(findingsJson([])) });
  assert.equal(result.result, "fail");
  assert.equal(result.findings.some((finding) => finding.path === "README.md" && finding.severity === "blocking"), true);
});

test("a diff over the size cap fails before the provider is called", async () => {
  const provider = providerReturning(findingsJson([]));
  const diff = `${sampleDiff}\n${"x".repeat(MAX_DIFF_CHARS)}`;
  const result = await review({ diff, provider });
  assert.equal(provider.calls, 0);
  assert.equal(result.result, "fail");
  assert.match(result.findings.map((finding) => finding.message).join("\n"), /80000/);
});

test("evidence records the model, endpoint, SHA, issue, plan revision, findings, and rule", async () => {
  const evidence = await review({
    provider: providerReturning(
      findingsJson([{ severity: "suggestion", path: "services/matter/matter-search/config.json", message: "note" }], "looks small"),
    ),
  });
  assert.equal(evidence.model, "grok-test");
  assert.equal(evidence.endpoint, RESPONSES_ENDPOINT);
  assert.equal(evidence.reviewedSha, HEAD_SHA);
  assert.equal(evidence.issue, 7);
  assert.equal(evidence.planRevision, "v1");
  assert.equal(evidence.passFailRule, PASS_FAIL_RULE);
  assert.equal(evidence.summary, "looks small");
  const summary = renderSummary(evidence);
  for (const needle of [evidence.model, evidence.endpoint, evidence.reviewedSha, "#7", "v1", PASS_FAIL_RULE, "suggestion"]) {
    assert.equal(summary.includes(String(needle)), true);
  }
  const status = buildCommitStatus({
    evidence,
    targetUrl: "https://github.com/YOKEN21/grok-bot-cursor/actions/runs/1",
    sha: HEAD_SHA,
  });
  assert.equal(status.body.context, STATUS_CONTEXT);
  assert.equal(status.body.state, "success");
  assert.equal(status.body.description, "pass: no blocking findings");
  assert.equal(status.body.target_url, "https://github.com/YOKEN21/grok-bot-cursor/actions/runs/1");
  assert.ok(status.body.description.length <= 140);
});

test("status descriptions stay short for each failure class", async () => {
  const cases: Array<{ reason: string; description: string }> = [
    { reason: "missing plan", description: "fail: missing Issue, plan, or approval" },
    { reason: "stale head: moved", description: "fail: stale plan or head" },
    { reason: "API error: HTTP 500", description: "fail: API error" },
    { reason: "malformed model output: nope", description: "fail: malformed model output" },
  ];
  for (const item of cases) {
    const status = buildCommitStatus({
      evidence: {
        model: "grok-test",
        endpoint: RESPONSES_ENDPOINT,
        reviewedSha: HEAD_SHA,
        issue: 7,
        planRevision: "v1",
        findings: [],
        passFailRule: PASS_FAIL_RULE,
        result: "fail",
        reasons: [item.reason],
        summary: null,
      },
      targetUrl: "https://github.com/example/run",
      sha: HEAD_SHA,
    });
    assert.equal(status.body.state, "failure");
    assert.equal(status.body.description, item.description);
    assert.equal(status.body.context, "grok-review");
  }
  const blocking = buildCommitStatus({
    evidence: {
      model: "grok-test",
      endpoint: RESPONSES_ENDPOINT,
      reviewedSha: HEAD_SHA,
      issue: 7,
      planRevision: "v1",
      findings: [{ severity: "blocking", path: "README.md", message: "outside" }],
      passFailRule: PASS_FAIL_RULE,
      result: "fail",
      reasons: [],
      summary: null,
    },
    targetUrl: "https://github.com/example/run",
    sha: HEAD_SHA,
  });
  assert.equal(blocking.body.description, "fail: blocking findings");
});

test("the responses body uses strict json_schema and the key stays out of errors", async () => {
  const body = buildResponsesBody({
    model: "grok-4.7",
    system: "system",
    user: "user",
    schema: findingsSchema,
  }) as {
    text: { format: { type: string; strict: boolean; name: string } };
    model: string;
  };
  assert.equal(body.model, "grok-4.7");
  assert.equal(body.text.format.type, "json_schema");
  assert.equal(body.text.format.strict, true);
  assert.equal(body.text.format.name, "review_findings");
  assert.equal(JSON.stringify(body).includes(API_KEY), false);

  let captured: { url: string; authorization: string; body: string } | undefined;
  const text = await requestReview({
    model: "grok-4.7",
    apiKey: API_KEY,
    system: "system",
    user: "user",
    fetchImpl: async (url, init) => {
      const headers = new Headers(init?.headers);
      captured = { url: String(url), authorization: headers.get("authorization") ?? "", body: String(init?.body ?? "") };
      return new Response(
        JSON.stringify({
          status: "completed",
          output: [{ type: "message", content: [{ type: "output_text", text: findingsJson([]) }] }],
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(captured?.url, RESPONSES_ENDPOINT);
  assert.equal(captured?.authorization, `Bearer ${API_KEY}`);
  assert.equal(captured?.body.includes(API_KEY), false);
  assert.equal(parseFindings(text).findings.length, 0);

  await assert.rejects(
    () =>
      requestReview({
        model: "grok-4.7",
        apiKey: API_KEY,
        system: "system",
        user: "user",
        fetchImpl: async () => new Response(`leaked ${API_KEY}`, { status: 500 }),
      }),
    (error: unknown) => {
      assert.ok(error instanceof ResponsesApiError);
      assert.equal(error.message.includes(API_KEY), false);
      assert.match(error.message, /HTTP 500/);
      return true;
    },
  );

  await assert.rejects(
    () =>
      requestReview({
        model: "grok-4.7",
        apiKey: API_KEY,
        system: "system",
        user: "user",
        fetchImpl: async () => {
          throw new Error(`socket hang up ${API_KEY}`);
        },
      }),
    (error: unknown) => {
      assert.ok(error instanceof ResponsesApiError);
      assert.equal(error.message.includes(API_KEY), false);
      return true;
    },
  );

  assert.throws(
    () => extractOutputText({ status: "incomplete", output: [] }),
    ResponsesApiError,
  );
  assert.throws(
    () => extractOutputText({ status: "completed", output: [{ type: "message", content: [] }] }),
    MalformedOutputError,
  );
  assert.equal(redactSecrets(`Bearer ${API_KEY} and ${API_KEY}`, [API_KEY]).includes(API_KEY), false);
  assert.equal(validateInstance(findingsSchema, { summary: "ok", findings: [] }).ok, true);
});

test("the CLI simulated provider writes evidence and redacts the key", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "grok-review-"));
  const plan = planBody();
  const pullPath = path.join(directory, "pull.json");
  const diffPath = path.join(directory, "pull.diff");
  const commentsPath = path.join(directory, "comments.json");
  const evidencePath = path.join(directory, "evidence.json");
  writeFileSync(
    pullPath,
    JSON.stringify({
      number: 7,
      body: "Issue: #7\n",
      head: { sha: HEAD_SHA },
      base: { sha: BASE_SHA },
    }),
  );
  writeFileSync(diffPath, sampleDiff);
  writeFileSync(commentsPath, JSON.stringify([{ body: plan }, { body: approvalBody(plan) }]));
  const tsx = path.join(root, "node_modules", ".bin", "tsx");
  const result = spawnSync(
    tsx,
    [
      "src/review/cli.ts",
      "--provider",
      "simulated",
      "--simulated-output",
      findingsJson(
        [{ severity: "suggestion", path: "services/matter/matter-search/config.json", message: "note" }],
        `summary ${API_KEY}`,
      ),
      "--pull",
      pullPath,
      "--diff",
      diffPath,
      "--comments",
      commentsPath,
      "--evidence",
      evidencePath,
      "--summary",
      path.join(directory, "summary.md"),
      "--status-out",
      path.join(directory, "status.json"),
      "--reviewed-sha",
      HEAD_SHA,
      "--target-url",
      "https://github.com/YOKEN21/grok-bot-cursor/actions/runs/99",
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, XAI_API_KEY: API_KEY, XAI_MODEL: "grok-test" },
    },
  );
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8")) as { summary: string; result: string; endpoint: string };
  assert.equal(evidence.result, "pass");
  assert.equal(evidence.endpoint, RESPONSES_ENDPOINT);
  assert.equal(JSON.stringify(evidence).includes(API_KEY), false);
  assert.match(evidence.summary, /\[redacted\]/);
});
