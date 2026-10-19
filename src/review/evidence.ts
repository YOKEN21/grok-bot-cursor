import { writeFileSync } from "node:fs";
import type { Finding } from "./findings.js";
import { redactSecrets } from "./client.js";

export const PASS_FAIL_RULE =
  "Fail when any finding is blocking, when the Issue, plan, or approval is missing, when the plan revision or head is stale, when model output is malformed, or when the API call fails. A changed path outside the plan allow-list is recorded as a blocking finding. A diff over 80000 characters is a blocking finding and is not sent. Suggestions alone pass.";

export const STATUS_CONTEXT = "grok-review";

export type Evidence = {
  model: string | null;
  endpoint: string;
  reviewedSha: string | null;
  issue: number | null;
  planRevision: string | null;
  findings: Finding[];
  passFailRule: string;
  result: "pass" | "fail";
  reasons: string[];
  summary: string | null;
};

export type CommitStatusBody = {
  state: "success" | "failure";
  target_url: string;
  description: string;
  context: typeof STATUS_CONTEXT;
};

export function resultFor(findings: readonly Finding[], reasons: readonly string[]): "pass" | "fail" {
  if (reasons.length > 0 || findings.some((finding) => finding.severity === "blocking")) {
    return "fail";
  }
  return "pass";
}

export function redactEvidence(evidence: Evidence, secrets: readonly string[]): Evidence {
  return {
    ...evidence,
    summary: evidence.summary === null ? null : redactSecrets(evidence.summary, secrets),
    reasons: evidence.reasons.map((reason) => redactSecrets(reason, secrets)),
    findings: evidence.findings.map((finding) => ({
      ...finding,
      path: redactSecrets(finding.path, secrets),
      message: redactSecrets(finding.message, secrets),
    })),
  };
}

export function renderSummary(evidence: Evidence): string {
  const findingBlock = JSON.stringify(evidence.findings, null, 2);
  const reasons =
    evidence.reasons.length === 0 ? "- (none)" : evidence.reasons.map((reason) => `- ${reason}`).join("\n");
  return [
    "# grok-review evidence",
    "",
    `- Result: ${evidence.result}`,
    `- Model: ${evidence.model ?? "(none)"}`,
    `- Endpoint: ${evidence.endpoint}`,
    `- Reviewed SHA: ${evidence.reviewedSha ?? "(none)"}`,
    `- Issue: ${evidence.issue === null ? "(none)" : `#${evidence.issue}`}`,
    `- Plan revision: ${evidence.planRevision ?? "(none)"}`,
    `- Summary: ${evidence.summary ?? "(none)"}`,
    `- Pass/fail rule: ${evidence.passFailRule}`,
    "",
    "## Reasons",
    "",
    reasons,
    "",
    "## Findings",
    "",
    "```json",
    findingBlock,
    "```",
    "",
  ].join("\n");
}

export function writeEvidence(evidence: Evidence, filePath: string): void {
  writeFileSync(filePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

export function statusDescription(evidence: Evidence | null): string {
  if (!evidence) {
    return "fail: review did not finish";
  }
  if (evidence.result === "pass") {
    return "pass: no blocking findings";
  }
  const text = evidence.reasons.join(" ");
  if (text.includes("missing Issue") || text.includes("missing plan") || text.includes("missing approval")) {
    return "fail: missing Issue, plan, or approval";
  }
  if (text.includes("stale plan") || text.includes("stale head")) {
    return "fail: stale plan or head";
  }
  if (text.includes("API error") || text.includes("XAI_MODEL") || text.includes("XAI_API_KEY")) {
    return "fail: API error";
  }
  if (text.includes("malformed")) {
    return "fail: malformed model output";
  }
  return "fail: blocking findings";
}

export function buildCommitStatus(input: {
  evidence: Evidence | null;
  targetUrl: string;
  sha: string;
}): { sha: string; body: CommitStatusBody } {
  const description = statusDescription(input.evidence).slice(0, 140);
  const state = input.evidence?.result === "pass" ? "success" : "failure";
  return {
    sha: input.sha.toLowerCase(),
    body: {
      state,
      target_url: input.targetUrl,
      description,
      context: STATUS_CONTEXT,
    },
  };
}
