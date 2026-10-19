# Agent guide

This repository is a synthetic platform-change foundation. It is not a deployed service.

## Before editing

Name the approved Issue and the plan revision (`v<N>`). Read the `[Plan]` comment and the `[Approval record]` on that Issue. The approval text is `APPROVED #<issue> plan v<N>`. The plan hash and base SHA in the approval record match the plan comment.

If the Issue, the plan, or the approval is missing, stop. Do not invent an approval.

## While editing

Edit only the paths in the plan's allow-list. An empty allow-list allows nothing. A directory entry ends with `/`. Globs use `*` and `**`.

Do not create Issues, labels, releases, routines, or deployments. Do not change repository settings, secrets, or permissions. Do not merge.

Do not print secrets. Do not call the live xAI API from the local check. Tests use the simulated provider.

## Before the pull request

Run:

```text
npm run check
```

That is `tsc --noEmit`, baseline config validation, and the unit tests. Do not claim lint, mutation, or end-to-end results unless those checks exist.

Open one pull request. Name the Issue and the plan revision in the body. Stop at the pull request.

## Reviews

`ci / verify` runs on `pull_request` and uses no secrets. `grok-review` runs from `main` on `pull_request_target`. It treats pull request contents as data fetched through the API. It does not check out or run pull request code while the xAI key is available.

The comment format and the pass/fail rule are in `docs/workflow.md`. The config catalog is in `catalog/config-change.md`.
