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
