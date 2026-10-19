import type { ApprovedPlan } from "../plan/parse.js";

export function buildPrompt(input: { plan: ApprovedPlan; diffText: string; files: readonly string[] }): {
  system: string;
  user: string;
} {
  const system = [
    "You review one pull request diff against an approved plan.",
    'Use severity "blocking" when the diff does something the plan does not allow, edits a path outside Allowed-Paths, or contradicts the approved change.',
    'Use severity "suggestion" for a non-blocking note. Suggestions alone are not failures.',
    "Return only the structured findings. Do not add a decision label, a score, or a merge recommendation.",
  ].join(" ");

  const user = [
    `Issue: #${input.plan.issue}`,
    `Plan revision: ${input.plan.revisionLabel}`,
    `Base SHA: ${input.plan.baseSha}`,
    "Exact change:",
    input.plan.change,
    "Allowed paths:",
    ...input.plan.allowedPaths.map((file) => `- ${file}`),
    "Tests named in the plan:",
    ...input.plan.tests.map((test) => `- ${test}`),
    "Out of scope:",
    ...input.plan.outOfScope.map((item) => `- ${item}`),
    "Changed files:",
    ...(input.files.length > 0 ? input.files.map((file) => `- ${file}`) : ["- (none)"]),
    "Diff:",
    input.diffText.length > 0 ? input.diffText : "(empty diff)",
  ].join("\n");

  return { system, user };
}
