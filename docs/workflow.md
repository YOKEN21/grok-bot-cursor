# Workflow

This repository records platform changes as GitHub Issues and pull requests. It does not deploy anything.

## Issue loop

The Liaison opens a `[Request]` Issue, passes `[Platform question]` comments to the developer, and posts the answer as `[Developer reply]`. The Liaison and the Platform Engineer do not message each other directly.

The Platform Engineer reads the Issue, posts a versioned plan, and waits for Kenny Han to approve that exact revision in the Grok Bot room "Platform Requests". After approval, the Platform Engineer posts an `[Approval record]` and one `[Dispatch]` on the Issue, then launches one Cursor cloud agent. The agent opens one pull request and stops. Merging is a human decision.

These records are written by the Platform Engineer bot with Kenny's shared credentials. They are audit context, not a separate proof of human identity. The boundaries in this repository rest on instructions, not on technical isolation.

## Plan comment

The plan comment is the last `[Plan]` comment on the Issue for that Issue number. Its hash is the SHA-256 of the comment body after CRLF is normalized to LF and surrounding whitespace is removed. Compute the hash from the body the API returns.

```text
[Plan] #<issue> v<N>

Base-SHA: <40 lowercase or mixed-case hex characters>
Change: <what will change>
Allowed-Paths:
- <exact path, directory prefix ending in /, or glob with * or **>
Tests:
- <command the implementer runs>
Out-of-scope:
- <what the change will not do>
```

Every labeled section is required. `Allowed-Paths`, `Tests`, and `Out-of-scope` use `- ` items. An empty allow-list is not a valid plan. A trailing slash matches a directory prefix. `*` matches inside one path segment. `**` matches across segments. Any other entry matches one exact path.

## Approval

Kenny approves in the Grok Bot room with this exact text:

```text
APPROVED #<issue> plan v<N>
```

The Platform Engineer then posts this on the Issue:

```text
[Approval record]
Issue: #<issue>
Plan-Revision: v<N>
Plan-Hash: <64 hex characters>
Base-SHA: <40 hex characters>
Approved-Text: APPROVED #<issue> plan v<N>
When: <ISO-8601 time with a timezone, such as 2026-10-19T10:32:38Z>
```

`Approved-Text` must match the room approval exactly. `Plan-Hash` and `Base-SHA` must match the latest plan comment. `When` is the time recorded on the Issue.

## Dispatch

```text
[Dispatch] run <id>
Issue: #<issue>
Plan-Revision: v<N>
```

A second dispatch for the same Issue and plan revision is a duplicate. The Platform Engineer does not launch another agent for that revision. Duplicate detection does not by itself fail `grok-review`.

## Pull request link

The pull request body contains one Issue link, either a line `Issue: #<number>` or a single `Fixes` / `Closes` / `Resolves #<number>` line. Two different numbers fail the review as a missing Issue.

## Staleness

The review fails when any of these is true:

- The latest plan revision differs from the approval's revision.
- The approval hash or base SHA differs from the latest plan comment.
- The pull request base SHA differs from the plan's base SHA.
- The head SHA under review differs from the pull request's current head SHA.

The head check runs before the model call and again after it. A moved head fails the review.

## Checks

There are two logical checks.

`ci / verify` is the job in `.github/workflows/ci.yml` (workflow name `ci`, job name `ci / verify`). It runs on `pull_request` with Node 22. It runs `tsc --noEmit`, validates `services/matter/matter-search/config.json` against the schema and the CPU/memory table, and runs the unit tests. It uses no secrets.

`grok-review` is `.github/workflows/grok-review.yml`, on `pull_request_target`, plus a commit status whose context is `grok-review`. The workflow checks out `main` and reads the Issue comments, the approved plan, and the pull request diff through the GitHub API. It does not check out or run the pull request head while `XAI_API_KEY` is available. The model is the `XAI_MODEL` repository variable. The key is the `XAI_API_KEY` secret. The client calls `POST https://api.x.ai/v1/responses` with `text.format` set to `json_schema` and `strict: true`.

The pass/fail rule is:

> Fail when any finding is blocking, when the Issue, plan, or approval is missing, when the plan revision or head is stale, when model output is malformed, or when the API call fails. A changed path outside the plan allow-list is recorded as a blocking finding. A diff over 80000 characters is a blocking finding and is not sent. Suggestions alone pass.

The model returns findings only. It does not return a decision label. A blocking finding fails the review. Suggestions alone pass. Evidence (model, endpoint, reviewed SHA, Issue, plan revision, findings, and this rule) is written to the job summary and to the artifact `grok-review-evidence.json`. The commit status on the reviewed head SHA carries a short description. Its target URL is the workflow run that holds the evidence. The secret is not printed.

`grok-review` runs from `main`. It cannot run on the bootstrap pull request, because `main` does not contain the workflow until that pull request merges. The first live review is expected on the rehearsal pull request that raises `desiredCount` from 3 to 4. Someone with GitHub web access needs to add `XAI_API_KEY` and `XAI_MODEL` before that rehearsal. The key is not pasted into chat.

## Polling and routines

After this foundation is merged, the Platform Engineer polls every five minutes, deduplicates by Issue, comment, plan, and run id, and stays quiet when nothing has changed. Routines are not created by this bootstrap. They are created only after the foundation is merged, they start paused, and they are turned on only after Kenny has seen their exact wording. Routines do not expire on their own. Each run checks the deadline. After 20 Oct 2026 at 2:00pm Australia/Sydney, the next run pauses the routine and reports that in the Grok Bot room.

## Local check

On Node 22.14.0 or newer:

```text
npm ci
npm run check
```

`npm run check` is `tsc --noEmit`, config validation, and the unit tests. The tests use a simulated provider. They do not call xAI. Lint, mutation testing, and end-to-end testing are not part of this foundation.
