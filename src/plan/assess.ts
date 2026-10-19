import {
  linkedIssue,
  parseApproval,
  parseDispatch,
  parsePlan,
  type ApprovedPlan,
  type ApprovalRecord,
} from "./parse.js";

export type IssueComment = {
  body: string;
};

export type PlanAssessment = {
  ok: boolean;
  issue: number | null;
  plan: ApprovedPlan | null;
  approval: ApprovalRecord | null;
  duplicateDispatch: boolean;
  reasons: string[];
};

export function assessPlan(input: {
  pullBody: string;
  comments: readonly IssueComment[];
  pullBaseSha: string;
  reviewedSha: string;
  currentHeadSha: string;
}): PlanAssessment {
  const reasons: string[] = [];
  const link = linkedIssue(input.pullBody);
  if (link.issue === null) {
    return {
      ok: false,
      issue: null,
      plan: null,
      approval: null,
      duplicateDispatch: false,
      reasons: [link.reason ?? "missing Issue"],
    };
  }

  const issue = link.issue;
  let latest: { plan: ApprovedPlan } | { error: string } | null = null;
  for (const comment of input.comments) {
    const parsed = parsePlan(comment.body);
    if (parsed === null) {
      continue;
    }
    if ("error" in parsed) {
      if (parsed.issue === issue) {
        latest = { error: parsed.error };
      }
      continue;
    }
    if (parsed.plan.issue === issue) {
      latest = { plan: parsed.plan };
    }
  }

  if (!latest || !("plan" in latest)) {
    reasons.push(latest ? "missing plan: plan comment is incomplete" : "missing plan");
    return {
      ok: false,
      issue,
      plan: null,
      approval: null,
      duplicateDispatch: false,
      reasons,
    };
  }

  const plan = latest.plan;
  const approvals = input.comments
    .map((comment) => parseApproval(comment.body))
    .filter((record): record is ApprovalRecord => record !== null && record.issue === issue);

  const matching = approvals.find(
    (record) => record.revision === plan.revision && record.planHash === plan.hash && record.baseSha === plan.baseSha,
  );
  if (!matching) {
    if (approvals.length === 0) {
      reasons.push("missing approval");
    } else if (approvals.some((record) => record.revision !== plan.revision)) {
      const found = approvals.map((record) => record.revisionLabel).join(", ");
      reasons.push(`stale plan: approval is for ${found} but the latest plan is ${plan.revisionLabel}`);
    } else {
      reasons.push("stale plan: approval plan hash or base SHA does not match the latest plan comment");
    }
  } else if (plan.baseSha !== input.pullBaseSha.toLowerCase()) {
    reasons.push(
      `stale plan: base SHA ${plan.baseSha} does not match pull request base ${input.pullBaseSha.toLowerCase()}`,
    );
  }

  const reviewed = input.reviewedSha.toLowerCase();
  const current = input.currentHeadSha.toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(reviewed) || !/^[0-9a-f]{40}$/.test(current)) {
    reasons.push("stale head: reviewed SHA is missing or is not a commit SHA");
  } else if (reviewed !== current) {
    reasons.push(`stale head: reviewed SHA ${reviewed} does not match current head ${current}`);
  }

  const dispatches = input.comments
    .map((comment) => parseDispatch(comment.body))
    .filter((record) => record !== null && record.issue === issue && record.revision === plan.revision);
  const duplicateDispatch = dispatches.length >= 2;

  return {
    ok: reasons.length === 0,
    issue,
    plan,
    approval: matching ?? null,
    duplicateDispatch,
    reasons,
  };
}
