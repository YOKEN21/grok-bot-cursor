# Service config change

A config change edits one synthetic service file, `services/<product>/<service>/config.json`. This repository is not a deployed service, and there is no AWS deployment.

## Baseline

`services/matter/matter-search/config.json` is the baseline:

| Field | Value |
| --- | --- |
| product | matter |
| owner | matter |
| service | matter-search |
| environment | dev |
| account | 111111111111 |
| cpu | 1024 |
| memory | 2048 |
| desiredCount | 3 |
| publicEndpoint | false |

The schema is `contracts/service-config.schema.json`. `npm run validate-config` checks this file against that schema and against the CPU/memory table below.

## Shape

- `product`, `owner`, and `service` are non-empty strings.
- `environment` is `dev` or `prod`.
- `account` is the synthetic account `111111111111`.
- `cpu` and `memory` are integers and must be one of the pairs below.
- `desiredCount` is an integer greater than or equal to 0.
- `publicEndpoint` is a boolean.
- Unknown fields fail validation.

## CPU and memory

CPU is in units. Memory is in MiB. `npm run validate-config` accepts only these pairs:

- CPU 256 with memory 512, 1024, or 2048
- CPU 512 with memory 1024, 2048, 3072, or 4096
- CPU 1024 with memory 2048, 3072, 4096, 5120, 6144, 7168, or 8192
- CPU 2048 with memory 4096 through 16384 in steps of 1024
- CPU 4096 with memory 8192 through 30720 in steps of 1024

Any other combination fails the check. The schema check and the pair check both run. A pair in this table is valid, including a pair above the baseline 1024/2048.

## Request

A complete config-change request names the Issue, the service file, and the exact field change. The approved plan's allow-list for a config-only change is `services/<product>/<service>/config.json`. The rehearsal change after this foundation merges raises `desiredCount` from 3 to 4.
