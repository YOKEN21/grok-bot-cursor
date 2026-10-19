# grok-bot-cursor

Synthetic platform-change demo repository. Not a deployed service, and no AWS deployment is included.

This repository is being bootstrapped. The approved bootstrap plan and its approval record are in [docs/bootstrap-brief.md](docs/bootstrap-brief.md).

## How changes work here

1. A developer request arrives as a GitHub Issue titled `[Request] ...`.
2. The Platform Engineer bot investigates, asks questions on the Issue, and posts a versioned plan.
3. Kenny approves that specific Issue and plan revision in the Grok Bot room "Platform Requests".
4. The bot records the approval on the Issue and dispatches one Cursor Cloud Agent, which opens a pull request.
5. GitHub CI runs two checks: `ci / verify` and `grok-review`.
6. The bot reports the PR and the actual check results, then stops. Merging is a human decision.

This README will be updated by the bootstrap pull request to describe what was actually implemented.
