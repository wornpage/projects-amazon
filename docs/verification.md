# Implementation and verification audit

Reviewed September 29, 2026, America/New_York. The approved scope is a local Alexa+ simulation with an actual Bedrock integration, three MCP tools, and human-confirmed work decisions. Repository publication, a public video, and Devpost submission follow owner review.

## Evidence

| Requirement | Current evidence | Result |
|---|---|---|
| Separate app; Svelte 5/Vite, Node 24, SQLite | This repository's package manifest, server, and database; no core Projects imports | Implemented |
| Six fictional work items with owners, blockers, next actions, completion criteria | `src/server/seed.mjs`, store assertions | Verified locally |
| Conversation, work cards, precise proposal, saved history, simulation label | Browser journey tests; Wornpage controls and ChangePreview in `src/client/App.svelte` | Verified with a test model |
| Nova Micro, Bedrock Converse, us-east-1, dedicated projects-amazon profile | `src/server/model.mjs`, pinned AWS SDK, actual failed provider receipt | Implemented; live success unproven |
| Streamable HTTP MCP 2025-11-25 using SDK 1.31.0 | Real HTTP initialization, SDK client discovery, read/proposal calls | Verified locally |
| Exactly get_briefing, get_work_item, propose_next_action | Wire-level tool list and validation tests; no confirmation tool | Verified locally |
| Initialization, malformed inputs, protocol negotiation | Wire-level tests for latest/older/unknown versions, unsupported headers, invalid patches, unknown tools | Verified locally |
| Human confirmation outside model permissions | Separate HttpOnly browser credential, origin and revision checks; MCP token cannot authenticate confirmation | Verified locally |
| Exact current proposal; stale proposals fail; duplicate confirmation applies once | Store, API, and browser tests, including an actual double click | Verified locally |
| Cancellation leaves items unchanged; next action does not complete work | Store and browser assertions; owner/blocker change updates counts while status stays active | Verified locally |
| Briefing → proposal → confirmation → refresh → updated briefing | Automated browser conversation over real MCP and SQLite | Verified with a test model |
| Persistence after restart and isolated sessions | A confirmed decision and conversation survive stopping one Node process and starting another; separate browser workspaces remain isolated | Verified locally |
| Stubs only in tests; provider failures clearly unavailable | Test fixtures inject the model; production has no stub switch. Actual local preview shows inference paused | Verified locally |
| One live batch, at most 20 attempts, bounded input, max 800 output tokens, no SDK retries | One retained batch, one denied attempt; persistent ledger and enforcement tests | Bounds verified; live journey incomplete |
| Current pricing, $1 total test budget, receipts and stop on uncertain usage | Public price parser, full-context reservation affordability, retained out-of-limit usage, persistent ledger; aws:check reads that same ledger | Verified locally; denied attempt usage unresolved |
| Setup, demo script, submission text, tool feedback, MIT public-source preparation | README, `docs/`, MIT license, pinned public dependencies and bundled notices | Prepared for review |

## Live gate

The retained batch stopped after AccessDeniedException. No successful live conversation was produced. The original error receipt retained the provider request ID and code, but not its full explanation. New error receipts retain the bounded provider message and HTTP status. The original evidence remains unchanged.

Future reservations use Nova Micro's documented 128K context ceiling, rounded conservatively to 131,072 input tokens, plus the pinned 800 output tokens. The full reservation must fit before dispatch. Reported usage beyond either ceiling is retained with its response request ID and stops further calls. Two new regression cases bring the local suite to 34 passing tests. The original failed reservation and usage pause remain intact. [Model limits](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html).

Read-only AWS checks found an active Free plan, no AWS organization membership, an authorized/available model, and a nonzero Nova Micro on-demand token quota. These checks do not establish runtime access or identify the denial's cause. There is no evidence here that upgrading the account or broadening IAM permissions would fix it. Account-specific diagnostics and a support draft are retained privately under ignored `data/`.

With owner approval, the diagnostic was sent through AWS Basic Support and an Account / Other Account Issues case was created. Its observed status was Unassigned; no denial explanation or usage confirmation had arrived. The case receipt and screenshot are retained privately under ignored `data/` and `output/`. Creating the case made no model calls and changed no paid plan or permissions.

Resolve the denial and reconcile the retained usage before another inference attempt. Any resumption must preserve the failed record and remain within the original 20-attempt / $1 allowance. The app is not claimed complete or ready for a live demo while this gate is unresolved.

## Challenge requirements

The current [requirements](https://amazonappdev2026.devpost.com/) and [FAQ](https://amazonappdev2026.devpost.com/details/faqs) were read in the browser. The deadline remains October 23, 2026, 3 p.m. EDT. The Alexa+ path accepts a locally runnable GitHub repository and a web simulation; gated preview access and public hosting are unnecessary. AWS Builder requires a documented AWS integration. A public English video under three minutes and product feedback are required at submission.
