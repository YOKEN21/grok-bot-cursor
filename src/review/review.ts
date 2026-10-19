import { assessPlan, type IssueComment } from "../plan/assess.js";
import { filesOutsideAllowedPaths } from "../plan/scope.js";
import { MalformedOutputError, RESPONSES_ENDPOINT, type ReviewProvider } from "./client.js";
import { collectDiff } from "./diff.js";
import { PASS_FAIL_RULE, redactEvidence, resultFor, type Evidence } from "./evidence.js";
import type { Finding } from "./findings.js";
import { parseFindings } from "./client.js";
import { buildPrompt } from "./prompt.js";

export type ReviewInput = {
  pullBody: string;
  comments: readonly IssueComment[];
  diff: string;
  pullBaseSha: string;
  reviewedSha: string;
  currentHeadSha: string;
  model: string | null;
  endpoint?: string;
  provider?: ReviewProvider;
  secrets?: readonly string[];
};

export async function reviewPullRequest(input: ReviewInput): Promise<Evidence> {
  const endpoint = input.endpoint ?? RESPONSES_ENDPOINT;
  const secrets = input.secrets ?? [];
  const assessment = assessPlan({
    pullBody: input.pullBody,
    comments: input.comments,
    pullBaseSha: input.pullBaseSha,
    reviewedSha: input.reviewedSha,
    currentHeadSha: input.currentHeadSha,
  });
  const collected = collectDiff(input.diff);
  const findings: Finding[] = [];
  const reasons = [...assessment.reasons];
  let summary: string | null = null;

  if (collected.truncated) {
    findings.push({
      severity: "blocking",
      path: "(pull request diff)",
      message: "pull request diff exceeded 80000 characters and was not sent for review",
    });
  }

  const planReady = assessment.ok && assessment.plan !== null && !collected.truncated;
  if (planReady && assessment.plan) {
    for (const file of filesOutsideAllowedPaths(collected.files, assessment.plan.allowedPaths)) {
      findings.push({
        severity: "blocking",
        path: file,
        message: "changed path is outside the approved plan allow-list",
      });
    }
    const model = input.model?.trim() ?? "";
    if (model.length === 0) {
      reasons.push("API error: XAI_MODEL is not set");
    } else if (!input.provider) {
      reasons.push("API error: review provider is not configured");
    } else {
      const prompt = buildPrompt({ plan: assessment.plan, diffText: collected.text, files: collected.files });
      try {
        const text = await input.provider.complete({ model, system: prompt.system, user: prompt.user });
        const parsed = parseFindings(text);
        summary = parsed.summary;
        findings.push(...parsed.findings);
      } catch (error) {
        if (error instanceof MalformedOutputError) {
          reasons.push(`malformed model output: ${error.message}`);
        } else {
          const message = error instanceof Error ? error.message : "request failed";
          reasons.push(`API error: ${message}`);
        }
      }
    }
  }

  const evidence: Evidence = {
    model: input.model,
    endpoint,
    reviewedSha: /^[0-9a-fA-F]{40}$/.test(input.reviewedSha) ? input.reviewedSha.toLowerCase() : input.reviewedSha,
    issue: assessment.issue,
    planRevision: assessment.plan?.revisionLabel ?? null,
    findings,
    passFailRule: PASS_FAIL_RULE,
    result: resultFor(findings, reasons),
    reasons,
    summary,
  };
  return redactEvidence(evidence, secrets);
}
