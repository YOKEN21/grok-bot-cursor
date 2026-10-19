---
name: implement-approved-plan
description: Implement one approved Issue plan. Name the Issue and plan revision, stay inside the allowed paths, run the tests, and stop at the pull request.
---

# Implement an approved plan

Use this skill for one approved change. Stop at the pull request. Do not merge.

## Required names

Name both of these before editing files:

- Issue number
- Plan revision (`v<N>`)

Read that `[Plan]` comment and the matching `[Approval record]`. The approval text is `APPROVED #<issue> plan v<N>`. The plan hash and base SHA match. If either record is missing, stop.

## Dispatch

If the recorded `[Dispatch]` run ID matches this agent's own run, carry on. If the recorded run ID is a different one, stop and report the conflict. Preventing duplicate launches is the Platform bot's job before it launches anything, not the coding agent's.

## Procedure

1. Read `docs/workflow.md` and the catalog entry for the change.
2. Edit only the allowed paths.
3. Run `npm run check`.
4. Open one pull request whose body names the Issue and the plan revision.
5. Stop.

## Boundaries

- Do not call the live xAI API. The local check uses the simulated provider.
- Do not print secrets.
- Do not check out or run pull request code from `grok-review`.
- Do not create a routine, a release, a label, or a deployment.
- Do not edit `.github/workflows/grok-review.yml` unless the plan's allowed paths include it.
