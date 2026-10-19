# Bootstrap brief

This brief seeds `YOKEN21/grok-bot-cursor` so a Cursor Cloud Agent can clone it and implement the foundation. The approved plan below is preserved verbatim. The bootstrap pull request may only append an "Implementation notes" section to the end of this file; the plan and approval record must stay unchanged.

## Approval record

- Plan: BOOTSTRAP PLAN v2
- Approved by: Kenny Han, the human owner
- Approval text: `APPROVED BOOTSTRAP PLAN v2`
- Where: Grok Bot group chat "Platform Requests" (room id `64029922-9fd5-4172-b318-683124b2fe30`)
- When: Monday 19 Oct 2026, 9:32:38 PM Australia/Sydney (UTC+11)
- Recorded by: Platform Engineer — grok-bot-cursor (a bot)
- Execution note: my GitHub connection cannot commit files, so step 1's two seed files (this brief and `README.md`) were committed to `main` by Codex through Kenny’s existing GitHub web session, following Kenny’s recorded approval. They were not committed by the bot's GitHub tool. The scope of the plan is otherwise unchanged; Codex confirmed this in the room at 9:34 PM.
- Trust note: this record is written by a bot that uses shared credentials. It is audit context, not an isolated proof of human identity. The boundaries in this repo depend on instructions, not technical isolation.

## Approved plan (verbatim)

**BOOTSTRAP PLAN v2** for `YOKEN21/grok-bot-cursor` (this replaces v1, which won't be run)

I checked build-something: it targets Node `>=22.14.0`, and its `grok-client.ts` already uses `POST /v1/responses` with strict `json_schema` output. At 9:24pm Sydney time `grok-bot-cursor` was still empty, and its default branch is `main`.

**Steps after approval**
1. I check the repo again and keep anything that appeared in the meantime. Using my GitHub connection, I seed `main` with just `README.md` and `docs/bootstrap-brief.md`. The brief contains this plan word for word and a record of Kenny's approval from this room.
2. I launch one Cursor cloud agent on the new branch `codex/bootstrap-foundation`, and post its run ID here and in the PR.
3. The agent opens one PR. I report the PR, its head SHA and the actual GitHub check results here, then stop for Kenny's merge decision.

**Files the agent may create or edit** (nothing else)
- Tooling: `package.json`, `package-lock.json`, `tsconfig.json` and `.gitignore`. It uses Node 22 (`engines >=22.14.0`, CI on Node 22), TypeScript, `tsx` and the Node test runner, plus `ajv` for schema checks.
- `README.md`, updated to describe what was actually built.
- `docs/bootstrap-brief.md`, which can only gain an implementation notes section. The approved plan and approval record in it stay exactly as seeded.
- The baseline config, `services/matter/matter-search/config.json`, with `{product: matter, owner: matter, service: matter-search, environment: dev, account: 111111111111, cpu: 1024, memory: 2048, desiredCount: 3, publicEndpoint: false}`, and its schema, `contracts/service-config.schema.json`.
- Docs: `catalog/config-change.md` and `docs/workflow.md`, which covers the Issue loop, the plan and approval format and the trust boundaries.
- Code: `src/config/` (validation), `src/plan/` (plan and approval parsing, staleness and duplicate checks) and `src/review/` (the Responses client, prompt, diff collection, findings schema, evidence writer and command-line entry point).
- Tests: `tests/**`, with a simulated provider and fixtures.
- Workflows: `.github/workflows/ci.yml` and `.github/workflows/grok-review.yml`.
- Agent guidance: `AGENTS.md`, `.cursor/rules/*.mdc` and `.cursor/skills/implement-approved-plan/SKILL.md`. The skill requires the agent to name the approved Issue and plan revision, stay within the allowed paths, run the tests, and stop at the PR.

**Reuse from build-something:** only small, rewritten pieces of `tsconfig`, the schema, cpu/memory and scope checks, the Responses client pattern, and the rule and skill files. Nothing from `risk-assessor/`'s orchestration, decision or findings logic, `risk-assessment.yml`, `policy/` or any of the four-bot or GO/HUMAN/NO-GO logic.

**Check A, `ci / verify`** (runs on `pull_request` on Node 22, no secrets)
- It runs `tsc --noEmit`, validates the config against the schema, checks the cpu/memory pairing, and runs the unit tests.
- Lint, mutation and end-to-end testing aren't claimed unless they're actually implemented.

**Check B, `grok-review`** (runs on `pull_request_target`)
- The review code is checked out from `main` only. The Issue, the approved plan and the exact PR diff are fetched through the API as data, and the PR's code is never checked out or run while the secret is available.
- It calls `POST https://api.x.ai/v1/responses` with `text.format` set to `json_schema` and `strict: true`, using the model from `XAI_MODEL` and the key from `XAI_API_KEY`. The agent checks the current official xAI Responses and structured-output docs, and the GitHub docs, before building this.
- The full evidence goes in the Action job summary and in an uploaded artifact (`grok-review-evidence.json`). That covers the model, endpoint, reviewed SHA, Issue and plan revision, the structured findings, and the pass/fail rule. The secret is never printed.
- It also sets a commit status on the reviewed head SHA. That status carries only a short pass/fail description, with its target URL linking to the run that holds the evidence.
- It fails on any blocking finding, missing Issue, plan or approval, stale plan revision or head, malformed output, or API error. Suggestions alone pass.
- There's no other assessment layer and no inference after CI.

**Plan and approval format**
- On the Issue, I post `[Plan] #<issue> v<N>` with the base SHA, the exact change, allowed paths, tests and what's out of scope.
- Kenny approves here with `APPROVED #<issue> plan v<N>`.
- I then post `[Approval record]` on the Issue with the plan hash, base SHA and time, followed by `[Dispatch] run <id>`. If a dispatch record already exists for that plan revision, I won't launch again.
- The docs will say plainly that these records are written by me using Kenny's shared credentials. They're audit context, not a separate human identity, and the boundaries rest on instructions rather than isolation.

**Tests** (layer in brackets)
- Bad config fails, such as a wrong type, an unknown or missing field, or an invalid cpu/memory pair [config].
- A blocking finding fails the review, while suggestions alone pass [review].
- An API error or malformed output fails the review [review, with a simulated provider].
- A stale plan or head fails, and a duplicate dispatch is detected [plan].
- Everything in this bootstrap uses the simulated provider, with no live API call.

**Workflow loop**
- The Liaison opens `[Request]` Issues, passes `[Platform question]` comments to the developer, and posts their answers as `[Developer reply]`. There's no direct messaging between the Liaison and me.
- I poll every five minutes, deduplicate by Issue, comment, plan and run IDs, and stay quiet when nothing has changed. I post plans here, wait for approval, and report the actual checks.
- I'll only create routines once the foundation is merged, and they'll start paused. They get turned on only after Kenny has seen their exact wording.
- Routines don't expire on their own, so each run checks the deadline. After 20 Oct 2026 at 2:00pm Sydney time, the next run pauses the routine and tells you here.

**Things to know before approving**
- `grok-review` runs from `main`, so it can't run on the bootstrap PR itself. That PR only gets `ci / verify`. The first live review will be on the rehearsal PR that raises replicas from 3 to 4.
- My GitHub connection can't read or set Actions secrets or variables. Someone with GitHub web access needs to add the `XAI_API_KEY` secret and the `XAI_MODEL` variable before the rehearsal. The key should never be pasted in chat.
- There's no AWS deployment.

To approve, reply here with exactly: `APPROVED BOOTSTRAP PLAN v2`

## Implementation notes

Implemented on branch `codex/bootstrap-foundation` from commit `46fefe4188a63cd1bcf8907bd2cb1087f10d07af`. The approval record and the approved plan above are unchanged.

### What landed

- Node `>=22.14.0`, TypeScript, `tsx`, the Node test runner, and Ajv.
- Baseline config `services/matter/matter-search/config.json` for product `matter`, owner `matter`, service `matter-search`, environment `dev`, account `111111111111`, cpu `1024`, memory `2048`, desiredCount `3`, publicEndpoint `false`.
- Schema and CPU/memory validation in `src/config/`. `npm run validate-config` checks that file.
- Plan, approval, dispatch, staleness, and allow-list parsing in `src/plan/`. The comment contract is in `docs/workflow.md`.
- Review client, prompt, diff collection, findings schema, evidence writer, and CLI in `src/review/`.
- GitHub Actions checks `ci / verify` (workflow `ci`, job `verify`, event `pull_request`) and `grok-review` (workflow `grok-review` on `pull_request_target`, plus a commit status whose context is `grok-review`).
- Tests under `tests/` use a simulated provider. No live xAI call is made.

### Docs checked before the review client and workflow

Checked on 19 Oct 2026:

- xAI Responses API: https://docs.x.ai/developers/rest-api-reference/inference/responses
- xAI structured outputs: https://docs.x.ai/developers/model-capabilities/text/structured-outputs
- GitHub `pull_request_target`: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request_target
- GitHub guidance on that event: https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target
- GitHub commit statuses: https://docs.github.com/en/rest/commits/statuses#create-a-commit-status
- GitHub job summaries: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands#adding-a-job-summary
- GitHub Actions artifacts: https://docs.github.com/en/actions/tutorials/store-and-share-data

The client sends `POST https://api.x.ai/v1/responses` with `text.format.type` `json_schema`, `text.format.strict` `true`, and schema name `review_findings`. The model comes from the `XAI_MODEL` variable. The key comes from the `XAI_API_KEY` secret and is sent only as `Authorization: Bearer`. Output text is read from `output[].content[]` where `type` is `output_text`. `store` is `false`. `temperature` is `0`. `max_output_tokens` is `4096`.

### How grok-review handles a pull request

The workflow checks out `ref: main` with `persist-credentials: false`. It reads the pull request JSON and the diff through the GitHub API and passes those files to the review CLI from `main`. It does not check out the pull request head, merge ref, or fork repository. The secret is present only in that job's review step. Evidence is written to the job summary via `$GITHUB_STEP_SUMMARY` and uploaded as the artifact `grok-review-evidence.json`. The commit status is `POST /repos/{owner}/{repo}/statuses/{sha}` on the reviewed head SHA, context `grok-review`, with a short description and `target_url` set to the workflow run.

### Pass/fail rule

Fail when any finding is blocking, when the Issue, plan, or approval is missing, when the plan revision or head is stale, when model output is malformed, or when the API call fails. A changed path outside the plan allow-list is recorded as a blocking finding. A diff over 80000 characters is a blocking finding and is not sent. Suggestions alone pass. The model does not return a decision label. This repository does not add another assessment layer after CI.

### Local check

`npm run typecheck` is `tsc --noEmit`. `npm run validate-config` checks the baseline config against the schema and the CPU/memory table. `npm test` runs the unit tests. `npm run check` runs those three. Lint, mutation testing, and end-to-end testing are not implemented.

### Choices and deviations

- The Responses client makes one attempt. An API error fails the review. The plan does not ask for retries.
- Allow-list mismatches are blocking findings produced locally. The reference repository's structural check that required `iam/<product>-task-roles.json` was not copied. This repository has no IAM catalog, and the approved file list does not include one.
- Pairs in the CPU/memory table are valid, including pairs above the baseline 1024/2048. Invalid pairs fail validation. The reference risk-assessor SIZE-01 preferred-size concern was not copied.
- A duplicate `[Dispatch]` for the same Issue and plan revision is detected and tested. It does not by itself fail `grok-review`. The plan uses that signal to avoid a second launch.
- GitHub Actions also records the `grok-review` workflow job. The commit status context on the reviewed SHA is `grok-review`. The other logical check is `ci / verify`. No GO/HUMAN/NO-GO layer is present.
- The plan described the Issue records in prose. `docs/workflow.md` defines the field labels the parser accepts. The plan hash is SHA-256 of the comment body with CRLF normalized to LF and surrounding whitespace removed.
- Action steps use `actions/checkout@v4`, `actions/setup-node@v4`, and `actions/upload-artifact@v4`.
