import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ResponsesApiError, xaiProvider } from "./client.js";
import { buildCommitStatus, renderSummary, writeEvidence, type Evidence } from "./evidence.js";
import { commentsFromApi, fetchIssueComments, fetchPullRequest, postCommitStatus, pullRequestFromApi } from "./github.js";
import { linkedIssue } from "../plan/parse.js";
import { reviewPullRequest } from "./review.js";

const { values } = parseArgs({
  options: {
    pull: { type: "string" },
    diff: { type: "string" },
    comments: { type: "string" },
    evidence: { type: "string", default: "grok-review-evidence.json" },
    summary: { type: "string", default: "grok-review-summary.md" },
    "status-out": { type: "string", default: "grok-review-status.json" },
    "target-url": { type: "string", default: "" },
    "reviewed-sha": { type: "string" },
    "current-head": { type: "string" },
    "recheck-head": { type: "boolean", default: false },
    provider: { type: "string" },
    "simulated-output": { type: "string" },
    "simulated-error": { type: "string" },
    "post-status": { type: "boolean", default: false },
    "status-file": { type: "string" },
  },
});

function failUsage(message: string): never {
  console.error(message);
  process.exit(1);
}

function readEvidence(filePath: string): Evidence | null {
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as Evidence;
  } catch {
    return null;
  }
}

async function postStatus(): Promise<void> {
  const sha = (values["reviewed-sha"] ?? "").toLowerCase();
  const targetUrl = values["target-url"] ?? "";
  const statusFile = values["status-file"] ?? values["status-out"];
  const evidence = readEvidence(values.evidence ?? "grok-review-evidence.json");
  const status = buildCommitStatus({ evidence, targetUrl, sha });
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
  const repo = process.env.GITHUB_REPOSITORY ?? "";
  const apiBase = process.env.GITHUB_API_URL ?? "https://api.github.com";
  if (token.length === 0 || repo.length === 0) {
    throw new Error("GH_TOKEN and GITHUB_REPOSITORY are required to set a commit status");
  }
  await postCommitStatus({
    apiBase,
    repo,
    sha: status.sha,
    token,
    body: status.body,
  });
  if (statusFile) {
    writeFileSync(statusFile, `${JSON.stringify({ sha: status.sha, ...status.body }, null, 2)}\n`, "utf8");
  }
  console.log(`grok-review status ${status.body.state}: ${status.body.description}`);
}

function writeReviewOutputs(evidence: Evidence): void {
  const evidencePath = values.evidence ?? "grok-review-evidence.json";
  const summaryPath = values.summary ?? "grok-review-summary.md";
  const statusPath = values["status-out"] ?? "grok-review-status.json";
  writeEvidence(evidence, evidencePath);
  const summary = renderSummary(evidence);
  writeFileSync(summaryPath, summary, "utf8");
  const status = buildCommitStatus({
    evidence,
    targetUrl: values["target-url"] ?? "",
    sha: evidence.reviewedSha && /^[0-9a-f]{40}$/.test(evidence.reviewedSha) ? evidence.reviewedSha : "0".repeat(40),
  });
  writeFileSync(statusPath, `${JSON.stringify({ sha: evidence.reviewedSha, ...status.body }, null, 2)}\n`, "utf8");
}

async function runReview(): Promise<void> {
  if (!values.pull || !values.diff) {
    failUsage("usage: review --pull <pull.json> --diff <pull.diff>");
  }
  const secrets = [process.env.XAI_API_KEY ?? "", process.env.GH_TOKEN ?? "", process.env.GITHUB_TOKEN ?? ""].filter(
    (secret) => secret.length > 0,
  );
  const pull = pullRequestFromApi(JSON.parse(readFileSync(values.pull, "utf8")) as unknown);
  const diff = readFileSync(values.diff, "utf8");
  const reviewedSha = values["reviewed-sha"] ?? pull.headSha;
  let comments: { body: string }[];
  if (values.comments) {
    comments = commentsFromApi(JSON.parse(readFileSync(values.comments, "utf8")) as unknown);
  } else {
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
    const repo = process.env.GITHUB_REPOSITORY ?? "";
    const link = linkedIssue(pull.body);
    if (token.length === 0 || repo.length === 0 || link.issue === null) {
      comments = [];
    } else {
      comments = await fetchIssueComments({
        apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
        repo,
        issue: link.issue,
        token,
      });
    }
  }

  let currentHead = values["current-head"] ?? pull.headSha;
  if (values["recheck-head"]) {
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
    const repo = process.env.GITHUB_REPOSITORY ?? "";
    if (token.length === 0 || repo.length === 0) {
      throw new Error("GH_TOKEN and GITHUB_REPOSITORY are required to recheck the head SHA");
    }
    const latest = await fetchPullRequest({
      apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
      repo,
      number: pull.number,
      token,
    });
    currentHead = latest.headSha;
  }

  const model = process.env.XAI_MODEL ?? null;
  let provider;
  if (values.provider === "simulated") {
    provider = {
      async complete(): Promise<string> {
        if (values["simulated-error"]) {
          throw new ResponsesApiError(values["simulated-error"]);
        }
        if (!values["simulated-output"]) {
          throw new ResponsesApiError("simulated output was not provided");
        }
        return values["simulated-output"];
      },
    };
  } else {
    const apiKey = process.env.XAI_API_KEY ?? "";
    if (apiKey.length === 0) {
      provider = {
        async complete(): Promise<string> {
          throw new ResponsesApiError("XAI_API_KEY is not set");
        },
      };
    } else {
      provider = xaiProvider(apiKey);
    }
  }

  let evidence = await reviewPullRequest({
    pullBody: pull.body,
    comments,
    diff,
    pullBaseSha: pull.baseSha,
    reviewedSha,
    currentHeadSha: currentHead,
    model: values.provider === "simulated" ? (model && model.length > 0 ? model : "simulated") : model,
    provider,
    secrets,
  });
  if (values["recheck-head"]) {
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? "";
    const repo = process.env.GITHUB_REPOSITORY ?? "";
    try {
      const after = await fetchPullRequest({
        apiBase: process.env.GITHUB_API_URL ?? "https://api.github.com",
        repo,
        number: pull.number,
        token,
      });
      if (after.headSha.toLowerCase() !== reviewedSha.toLowerCase() && !evidence.reasons.some((reason) => reason.startsWith("stale head"))) {
        evidence = {
          ...evidence,
          result: "fail",
          reasons: [
            ...evidence.reasons,
            `stale head: reviewed SHA ${reviewedSha.toLowerCase()} does not match current head ${after.headSha.toLowerCase()}`,
          ],
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "head recheck failed";
      evidence = {
        ...evidence,
        result: "fail",
        reasons: [...evidence.reasons, `API error: ${message}`],
      };
    }
  }
  writeReviewOutputs(evidence);
  console.log(`grok-review ${evidence.result}`);
  for (const reason of evidence.reasons) {
    console.log(reason);
  }
  if (evidence.result === "fail") {
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  if (values["post-status"]) {
    await postStatus();
    return;
  }
  await runReview();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "review failed";
  console.error(message);
  process.exitCode = 1;
});
