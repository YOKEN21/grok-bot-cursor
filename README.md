# grok-bot-cursor

Synthetic platform-change repository for the `matter` product. It is not a deployed service. There is no AWS deployment.

The approved bootstrap plan and its approval record are in [docs/bootstrap-brief.md](docs/bootstrap-brief.md).

## What is here

- Baseline config at `services/matter/matter-search/config.json`: product `matter`, owner `matter`, service `matter-search`, environment `dev`, account `111111111111`, cpu `1024`, memory `2048`, desiredCount `3`, publicEndpoint `false`. The schema is `contracts/service-config.schema.json`. The catalog entry is [catalog/config-change.md](catalog/config-change.md).
- Config validation in `src/config/`. It checks the schema and the CPU/memory pairs.
- Plan and approval parsing in `src/plan/`. It reads the Issue comment format in [docs/workflow.md](docs/workflow.md), including staleness and duplicate dispatch detection.
- The `grok-review` client in `src/review/`. It calls `POST https://api.x.ai/v1/responses` with `text.format` `json_schema` and `strict: true`. Tests use a simulated provider.
- Two GitHub checks: `ci / verify` and `grok-review`.

## Local check

Requires Node.js `>=22.14.0`.

```text
npm ci
npm run check
```

`npm run check` runs:

1. `tsc --noEmit`
2. `npm run validate-config` (schema and CPU/memory for the baseline config)
3. `npm test` (Node test runner, simulated provider)

Lint, mutation testing, and end-to-end testing are not implemented. The tests do not call xAI.

## Pull request checks

`ci / verify` runs on `pull_request` with Node 22. It uses no secrets. It runs the same typecheck, config validation, and unit tests as the local check.

`grok-review` runs on `pull_request_target` from `main`. It checks out `main`, fetches the Issue, the approved plan, and the pull request diff through the GitHub API, and reviews that data with the Responses API. It does not check out or run pull request code while `XAI_API_KEY` is available. The model comes from the `XAI_MODEL` variable. Full evidence is written to the job summary and to the artifact `grok-review-evidence.json`. A commit status named `grok-review` is set on the reviewed head SHA and links to the run.

`grok-review` cannot run on the bootstrap pull request, because the workflow is not on `main` yet. That pull request gets `ci / verify` only. The first live review is expected after merge, on the rehearsal pull request that raises `desiredCount` from 3 to 4.

## How a change is made

1. A request arrives as a GitHub Issue titled `[Request] ...`.
2. The Platform Engineer posts `[Plan] #<issue> v<N>` on the Issue.
3. Kenny approves that revision in the Grok Bot room with `APPROVED #<issue> plan v<N>`.
4. The Platform Engineer posts `[Approval record]` and `[Dispatch] run <id>` on the Issue and launches one cloud agent.
5. The agent opens one pull request and stops. Merging is a human decision.

The Issue loop, the comment format, and the trust boundaries are in [docs/workflow.md](docs/workflow.md). Agent instructions are in [AGENTS.md](AGENTS.md).
