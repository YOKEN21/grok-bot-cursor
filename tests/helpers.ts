import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedApprovalText, parsePlan, type ApprovedPlan } from "../src/plan/parse.js";

export const BASE_SHA = "a".repeat(40);
export const HEAD_SHA = "b".repeat(40);

export function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function planBody(options?: {
  issue?: number;
  revision?: number;
  baseSha?: string;
  change?: string;
  allowed?: string[];
  tests?: string[];
  outOfScope?: string[];
}): string {
  const issue = options?.issue ?? 7;
  const revision = options?.revision ?? 1;
  const baseSha = options?.baseSha ?? BASE_SHA;
  const change = options?.change ?? "Set desiredCount from 3 to 4.";
  const allowed = options?.allowed ?? ["services/matter/matter-search/config.json"];
  const tests = options?.tests ?? ["npm run check"];
  const outOfScope = options?.outOfScope ?? ["AWS deployment"];
  return [
    `[Plan] #${issue} v${revision}`,
    "",
    `Base-SHA: ${baseSha}`,
    `Change: ${change}`,
    "Allowed-Paths:",
    ...allowed.map((item) => `- ${item}`),
    "Tests:",
    ...tests.map((item) => `- ${item}`),
    "Out-of-scope:",
    ...outOfScope.map((item) => `- ${item}`),
  ].join("\n");
}

export function parsedPlan(body: string): ApprovedPlan {
  const parsed = parsePlan(body);
  if (!parsed || !("plan" in parsed)) {
    throw new Error("fixture plan did not parse");
  }
  return parsed.plan;
}

export function approvalBody(body: string, when = "2026-10-19T10:32:38Z"): string {
  const plan = parsedPlan(body);
  return [
    "[Approval record]",
    `Issue: #${plan.issue}`,
    `Plan-Revision: ${plan.revisionLabel}`,
    `Plan-Hash: ${plan.hash}`,
    `Base-SHA: ${plan.baseSha}`,
    `Approved-Text: ${expectedApprovalText(plan.issue, plan.revision)}`,
    `When: ${when}`,
  ].join("\n");
}

export function dispatchBody(issue: number, revision: number, runId: string): string {
  return [`[Dispatch] run ${runId}`, `Issue: #${issue}`, `Plan-Revision: v${revision}`].join("\n");
}
