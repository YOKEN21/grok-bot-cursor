import { createHash } from "node:crypto";

const SHA40 = /^[0-9a-fA-F]{40}$/;
const SHA256 = /^[0-9a-fA-F]{64}$/;
const WHEN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const PLAN_HEADER = /^\[Plan\]\s+#(\d+)\s+v(\d+)\s*$/;
const DISPATCH_HEADER = /^\[Dispatch\]\s+run\s+(\S+)\s*$/;
const PLAN_FIELD = /^(Base-SHA|Change|Allowed-Paths|Tests|Out-of-scope):\s*(.*)$/;
const APPROVAL_FIELD = /^(Issue|Plan-Revision|Plan-Hash|Base-SHA|Approved-Text|When):\s*(.*)$/;
const DISPATCH_FIELD = /^(Issue|Plan-Revision):\s*(.*)$/;

export type ApprovedPlan = {
  issue: number;
  revision: number;
  revisionLabel: string;
  baseSha: string;
  change: string;
  allowedPaths: string[];
  tests: string[];
  outOfScope: string[];
  hash: string;
};

export type ApprovalRecord = {
  issue: number;
  revision: number;
  revisionLabel: string;
  planHash: string;
  baseSha: string;
  approvedText: string;
  when: string;
};

export type DispatchRecord = {
  runId: string;
  issue: number;
  revision: number;
};

export function canonicalComment(body: string): string {
  return body.replace(/\r\n/g, "\n").trim();
}

export function planHash(body: string): string {
  return createHash("sha256").update(canonicalComment(body), "utf8").digest("hex");
}

export function isSha40(value: string): boolean {
  return SHA40.test(value);
}

function linesOf(body: string): string[] {
  return canonicalComment(body).split("\n");
}

function listItems(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter((line) => line.length > 0);
}

function fieldBlocks(lines: string[], pattern: RegExp): Map<string, string[]> {
  const blocks = new Map<string, string[]>();
  let current: string | null = null;
  for (const line of lines) {
    const match = pattern.exec(line);
    if (match?.[1]) {
      current = match[1];
      const rest = match[2] ?? "";
      blocks.set(current, rest.length > 0 ? [rest] : []);
      continue;
    }
    if (current) {
      blocks.get(current)?.push(line);
    }
  }
  return blocks;
}

export function expectedApprovalText(issue: number, revision: number): string {
  return `APPROVED #${issue} plan v${revision}`;
}

export function parsePlan(body: string): { plan: ApprovedPlan } | { error: string; issue: number } | null {
  const canonical = canonicalComment(body);
  const lines = canonical.split("\n");
  const header = PLAN_HEADER.exec(lines[0] ?? "");
  if (!header?.[1] || !header[2]) {
    return null;
  }
  const issue = Number(header[1]);
  const revision = Number(header[2]);
  const blocks = fieldBlocks(lines.slice(1), PLAN_FIELD);
  const baseSha = (blocks.get("Base-SHA") ?? []).join("").trim().toLowerCase();
  const change = (blocks.get("Change") ?? [])
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
  const allowedPaths = listItems(blocks.get("Allowed-Paths") ?? []);
  const tests = listItems(blocks.get("Tests") ?? []);
  const outOfScope = listItems(blocks.get("Out-of-scope") ?? []);
  if (!isSha40(baseSha) || change.length === 0 || allowedPaths.length === 0 || tests.length === 0 || outOfScope.length === 0) {
    return { error: "plan comment is incomplete", issue };
  }
  return {
    plan: {
      issue,
      revision,
      revisionLabel: `v${revision}`,
      baseSha,
      change,
      allowedPaths,
      tests,
      outOfScope,
      hash: planHash(canonical),
    },
  };
}

export function parseApproval(body: string): ApprovalRecord | null {
  const lines = linesOf(body);
  if (lines[0] !== "[Approval record]") {
    return null;
  }
  const blocks = fieldBlocks(lines.slice(1), APPROVAL_FIELD);
  const issueText = (blocks.get("Issue") ?? []).join("").trim();
  const revisionText = (blocks.get("Plan-Revision") ?? []).join("").trim();
  const planHashText = (blocks.get("Plan-Hash") ?? []).join("").trim().toLowerCase();
  const baseSha = (blocks.get("Base-SHA") ?? []).join("").trim().toLowerCase();
  const approvedText = (blocks.get("Approved-Text") ?? []).join("").trim();
  const when = (blocks.get("When") ?? []).join("").trim();
  const issueMatch = /^#(\d+)$/.exec(issueText);
  const revisionMatch = /^v(\d+)$/.exec(revisionText);
  if (!issueMatch?.[1] || !revisionMatch?.[1] || !SHA256.test(planHashText) || !isSha40(baseSha) || !WHEN.test(when)) {
    return null;
  }
  const whenMs = Date.parse(when);
  if (!Number.isFinite(whenMs)) {
    return null;
  }
  const issue = Number(issueMatch[1]);
  const revision = Number(revisionMatch[1]);
  if (approvedText !== expectedApprovalText(issue, revision)) {
    return null;
  }
  return {
    issue,
    revision,
    revisionLabel: `v${revision}`,
    planHash: planHashText,
    baseSha,
    approvedText,
    when,
  };
}

export function parseDispatch(body: string): DispatchRecord | null {
  const lines = linesOf(body);
  const header = DISPATCH_HEADER.exec(lines[0] ?? "");
  if (!header?.[1]) {
    return null;
  }
  const blocks = fieldBlocks(lines.slice(1), DISPATCH_FIELD);
  const issueText = (blocks.get("Issue") ?? []).join("").trim();
  const revisionText = (blocks.get("Plan-Revision") ?? []).join("").trim();
  const issueMatch = /^#(\d+)$/.exec(issueText);
  const revisionMatch = /^v(\d+)$/.exec(revisionText);
  if (!issueMatch?.[1] || !revisionMatch?.[1]) {
    return null;
  }
  return {
    runId: header[1],
    issue: Number(issueMatch[1]),
    revision: Number(revisionMatch[1]),
  };
}

export function linkedIssue(body: string): { issue: number | null; reason?: string } {
  const explicit = [...body.matchAll(/^Issue:\s*#(\d+)\s*$/gm)].map((match) => Number(match[1]));
  const closing = [...body.matchAll(/\b(?:Fixes|Closes|Resolves)\s+#(\d+)\b/gi)].map((match) => Number(match[1]));
  const unique = [...new Set([...explicit, ...closing])];
  if (unique.length === 0) {
    return { issue: null, reason: "missing Issue" };
  }
  if (unique.length > 1) {
    return { issue: null, reason: "missing Issue: pull request body names more than one issue" };
  }
  return { issue: unique[0] ?? null };
}
