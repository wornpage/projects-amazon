# Implementation and verification audit

Reviewed October 1, 2026, America/New_York. The app is a local Alexa+ simulation with actual Bedrock conversation, three MCP tools, and human-confirmed work decisions. Publication, video recording and Devpost submission remain review steps.

## Evidence

| Requirement | Evidence | Result |
|---|---|---|
| Separate Svelte 5/Vite, Node 24, SQLite app | Package manifest and independently authored source; no core Projects imports | Implemented |
| Six fictional work items and explicit count definitions | Seed data, store and browser assertions | Verified locally |
| Conversation, work cards, change review, history, simulation label | Wornpage interface; automated and actual-provider screenshots | Verified locally and live |
| Nova Micro / Bedrock Converse / us-east-1 / projects-amazon | Retained successful provider usage and request IDs | Verified live |
| Streamable HTTP MCP 2025-11-25 / SDK 1.31.0 | Initialization, discovery, malformed-input and protocol-negotiation tests | Verified locally |
| Exactly three MCP tools; model executes them through the MCP client | Wire-level discovery and actual Bedrock tool traces | Verified locally and live |
| Fresh facts each turn | Forced get_briefing selection and current-turn revision checks | Verified locally and live |
| Human confirmation outside model permissions | Separate HttpOnly credential and browser origin checks; MCP token cannot confirm | Verified locally |
| Displayed proposal is applied exactly once, only at its current revision | Store/API/browser tests for stale and duplicate confirmations; live displayed-value comparison | Verified locally and live |
| Cancellation changes no work item; saving an action does not complete work | Automated tests plus actual-model proposal confirmation/cancellation | Verified locally and live |
| Briefing → proposal → confirmation → refresh → updated briefing | Retained actual Bedrock continuation and persisted SQLite state | Verified live |
| Restart persistence and isolated demo sessions | Actual process-restart tests; live confirmed decision survives subsequent servers | Verified locally; restart also live |
| Test fixtures only in automated tests; clear provider failures | No production stub switch; unavailable-state tests and retained denied call | Verified locally and live |
| Initial 20-call batch and explicitly authorized extension to 30, ≤800 output tokens, ≤24 KB input, no SDK retries | Shared persisted ledger across all continuations; 29 attempts | Verified |
| $1 cap, current prices, retained failures, fail on unreviewed uncertainty | 57-test suite; actual receipts; original denial kept with reviewed $0.03 hold | Verified within retained bound; actual AWS bill unknown |
| Setup, demo script, submission/tool-feedback drafts, MIT source preparation | README, docs, license and public dependency notices | Prepared for review |

The build and **57 automated tests pass**. Automated conversation responses use a fixture; they do not measure model reliability. The suite prevents starting a conversation with only one provider call remaining, because the mandatory fresh read leaves no allowance for a reply.

## Live evidence and retained failures

The original denied batch is unchanged. Its cause remains unconfirmed, and it did not retain the full provider explanation. Later receipts retain bounded error messages and HTTP status. A free CountTokens diagnostic established that this Nova Micro deployment does not support token counting.

The later credential refresh had a distinct, reproducible `Region is missing` failure. Persisting `region = us-east-1` in the dedicated AWS profile fixed that refresh. A reviewed conservative hold made the original denial's maximum possible token cost affordable within the existing budget. One actual Converse diagnostic then succeeded. No paid-plan upgrade or IAM permission change was made. This does not establish why the original invocation was denied. At the owner's request, the Basic Support case was closed on September 30, 2026; AWS displayed Resolved and a Reopen case button. The closure did not provide a denial explanation or billing reconciliation. Its receipt and screenshot remain private under `data/` and `output/review/`.

The retained batch continued with these findings:

| Observation | Action and resulting evidence |
|---|---|
| A proposal was attempted before a fresh workspace read | Forced get_briefing at the start of each turn; server revision guard remains |
| A valid proposal omitted the prompt's trailing period | Harness checks intended wording, then verifies storage equals the exact displayed value; no proposal regenerated for punctuation |
| Client-portal proposal confirmed and saved | Refresh, next actual Bedrock briefing and subsequent server restarts read the saved action; status remains active |
| Owner-change request twice described a proposal without creating one | Both failures remain recorded. An explicit correction naming propose_next_action created a real pending card |
| Real owner proposal cancelled | Refresh preserved the original owner, revision 2, and one confirmed decision |

Important local receipts, excluded from the public repository:

- `data/live-validation.json`: original denied batch, unchanged.
- `data/access-diagnostic-2026-09-30T04-33-57.344Z.json`: first successful bounded Converse diagnostic.
- `data/live-validation-continuation-2026-09-30T04-53-18.413Z.json`: three passing checks for the core live journey, then an owner-proposal failure. Its status remains failed.
- `data/live-validation-continuation-2026-09-30T05-00-14.855Z.json`: retained repeated owner-proposal failure.
- `data/live-validation-continuation-2026-09-30T05-01-35.719Z.json`: successful explicit correction, real cancellation and desktop/mobile rendering, with a hash link to the prior core-journey evidence.
- Matching `*-receipts.json` files retain usage. Screenshots are under `output/playwright/live-validation-2026-09-30T05-01-35.719Z/`.

These establish the demonstrated workflow, not a general model-reliability rate. Tool selection can require correction; a prose description alone never creates a card or grants confirmation permission. The actual proposal and history cards remain the authoritative change record.

## Local refinements after the live batch

No further provider calls were made for these changes:

- A successful proposal finishes the turn directly from the saved MCP result, with a concise app-generated review message. A regression test makes any third model call fail, proving the normal read/propose path needs two calls.
- The briefing tool includes actual pending proposals and recent decision summaries, so later turns receive the state of human decisions alongside the work items.
- Chat displays current proposal status from stored records, including confirmed, cancelled and stale. A fixture reproducing the observed false prose claim shows no proposal card or confirm control and explicitly states that no proposal was created.
- Nova planning sections are excluded from visible assistant text and subsequent model text history. Tests cover multiple, nested, unclosed and planning-only outputs, preserve user text, and keep previously retained message records unchanged.

The build and local/browser regressions pass. These checks do not establish improved natural-language tool selection against Nova; that needs a separately authorized live allowance. Plain-text briefing replies may still contain Markdown markers.

The previously saved actual Bedrock session was also opened with the new interface on desktop and mobile. Confirmed/cancelled labels, concise proposal text, hidden planning sections and the original saved decision were verified with zero inference calls. That read-only receipt is `output/review/saved-live-history-refinement-v2.json`; it is display/persistence evidence, not a new model-validation run.

## Local usability pass — October 1, 2026

The build and 54 tests pass after adding failed-send draft recovery, browser-owned demo switching, duplicate pending-card reuse, and conversation scroll behavior. Tests cover explicit retry after a failed network send; restored decisions after switching and refresh; rejection of another browser's switch request; persistence of demo groups across restart; and migration of old sessions without exposing unrelated demos or altering their credentials. Cancelled proposals are retained and are not reused. Reading old chat is not interrupted by new replies.

An ignored database backup was saved before the local demo-group migration. Drafts retained while switching are page-local; clearing cookies removes browser access to retained demos. The model's MCP permissions remain limited to the active workspace and do not include browsing or switching demos. Inference limits and receipts remain shared across every workspace. No live provider calls were made for this pass; ordinary-language model tool selection still needs a fresh bounded validation allowance.

## Historical budget at the September 30 validation checkpoint

| Measure | Value | Meaning |
|---|---:|---|
| Attempted calls | 19 / 20 | Includes the original denial and every continuation |
| Calls with usable usage | 18 | Returned token counts; not an AWS billing statement |
| Estimated token cost | $0.001265915 | Usage multiplied by retained regional rates |
| Denied call cost hold | $0.03 | Conservative bound; actual cost remains unknown |
| Remaining dollar allowance | $0.968734085 | $1 minus estimate and hold |
| Remaining calls | 1 | Insufficient for a new conversation, which needs at least two |

Verified rates were $0.035 per million input tokens and $0.14 per million output tokens. [AWS regional price list](https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AmazonBedrock/current/us-east-1/index.json).

The denied receipt remains `uncertain`. Its operator review holds a full documented context in both directions at the higher historical/current rates, rounded up to a cent. The review retains the original receipt hash, original reservation, pricing sources and reason. It cannot reset call counts, change actual unknown usage to zero, or authorize an unaffordable retry. Any new unreviewed uncertainty stops inference. Future requests reserve the full 131,072-token input ceiling plus 800 output tokens. [Model limits](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html).

## October 1 live correction and current budget

The owner explicitly approved raising the cumulative call ceiling from 20 to 30 while keeping the $1 cap. A local operator action retained this authorization in `inference_authorizations`; it preserves all prior attempts and cost holds and has no browser or MCP endpoint. Tests cover restart persistence, rejection of reset/repeated extensions, the maximum 30 ceiling, and refusal of the next dispatch at exhaustion.

The first new live check successfully proposed an ordinary-language owner change and cancelled it without changing work. It then failed because Nova supplied `client portal` instead of `client-portal` as an item ID. This failed report remains `data/live-companion-check-2026-10-01T23-32-13.600Z.json`.

Both item tools now enumerate the exact workspace IDs in their MCP schema. The same ordinary-language client-portal request then created a real review card. Confirmation saved the exact displayed next action; refresh and a subsequent actual Bedrock briefing read it back. New-demo creation and Saved demos switching restored its decision/history. An identical direct MCP request reused the model-created card without extra inference. Duplicate ordinary-language requests were not revalidated live.

The passing report is `data/live-companion-correction-2026-10-01T23-36-48.295Z.json`, with matching receipts and a SHA link to the earlier owner/cancellation evidence. Its screenshot is `output/review/live-companion-correction-2026-10-01T23-36-48.295Z/saved-live-demo.png`. These prove the specific demonstrated flows, not a general reliability rate. The earlier local-only evidence above remains historical.

| Measure | Current value | Meaning |
|---|---:|---|
| Attempted calls | 29 / 30 | Includes all failures and prior continuations |
| Calls with usable usage | 28 | Returned token counts |
| Estimated token cost | $0.001918455 | Not an AWS billing statement |
| Original denied call hold | $0.03 | Actual usage still unknown |
| Remaining dollar allowance | $0.968081545 | $1 less estimates and hold |
| Remaining calls | 1 | Insufficient for a conversation; inference stopped |

Current regional rates were reverified from the official AWS price list: $0.035 per million input tokens and $0.14 per million output tokens. The correction used four calls; the total new validation used ten. Every failed receipt is retained. Browsing saved decisions makes zero inference calls.

## Challenge delivery

The later [workflow review](workflow-review.md) makes work the first view, adds Needs review alongside Work items and Decisions, prepares questions without sending, and moves keyboard focus when real proposals and human decisions return. It keeps draft entry available while sending is paused. Two additional interaction tests and the expanded unavailable-provider checks bring the passing suite to 57. Saved actual-provider work/history rendered at desktop, narrow desktop and mobile sizes without new inference calls or changes to the ledger. The existing live reports and videos remain historical evidence; no general model reliability or full accessibility-conformance claim is made.

A read-only saved-session capture and approximately 90-second English-captioned review video are retained under `output/review/demo-review/`. Five actual app views cover work, tool traces, the confirmed change, unchanged fields, and connection/budget boundaries. Capture blocked writes and non-loopback requests and verified identical before/after inference-ledger SHA-256 values. The cut uses screenshots, contains no narration audio, and is explicitly a saved-results walkthrough, not a new inference or confirmation run. See [review-handoff.md](review-handoff.md) for review artifacts and remaining external steps.

The revised readable cut is `output/review/demo-readable-v3/projects-briefing-readable.mp4`: 80 seconds at 1920×1080, with four close views captured at three device pixels per CSS pixel. Scene titles are 62px, captions 42px, and primary app text approximately 33–44px. All four rendered scenes were inspected for clipping and text readability. The original cut is preserved. Capture and video receipts bind the actual saved results and verify an unchanged inference ledger; no new provider calls or model fixtures were used. The video always identifies itself as saved live results and does not reenact a pending proposal or confirmation. Nebius was not changed.

The reviewed [requirements](https://amazonappdev2026.devpost.com/) and [FAQ](https://amazonappdev2026.devpost.com/details/faqs) give an October 23, 2026, 3 p.m. EDT deadline. Alexa+ accepts a locally runnable repository and web simulation without partner-preview access or public hosting. AWS Builder requires a documented AWS integration. Submission still needs the reviewed public repository, an English video under three minutes, and product feedback. None has been published or submitted by this local validation.
