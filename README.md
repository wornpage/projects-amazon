# Projects Briefing

A conversational work companion: read the work, understand the blocker, propose a next action, and let the person confirm the decision.

This is an **Alexa+ web simulation**, with an independently authored demo workspace and a real MCP server. It does not connect to Alexa+ partner-preview tools, production Projects, or the Nebius edition.

## Run locally

Requires Node.js 24 and npm. The app binds to the local loopback interface.

```powershell
cd C:\jkbSoft\projects-amazon
npm ci
npx playwright install chromium
npm run build
npm start
```

Open **http://127.0.0.1:4317**. Use `npm run dev` for development; the frontend opens at http://127.0.0.1:5173 and proxies to the same backend.

The six fictional work items, proposals, conversation messages and confirmed decisions persist in `data/briefing.sqlite`. **New demo** starts a workspace; **Saved demos** returns to earlier demos created from the same browser session, including their decisions and history. Other browser sessions cannot list or switch to those demos. Keep the browser cookie to retain access: this does not recover demos after clearing cookies or expose unrelated historical workspaces. Existing databases migrate each old workspace into its own browser-owned group. Fonts and assets are bundled locally.

Failed sends keep the message in the composer for an explicit retry. Drafts also survive switching between demos while the page stays open; they are not persisted across a full page reload. New replies follow the conversation when you are at the bottom and leave your position intact while you read older messages.

## Wornpage interface

The Svelte interface uses the public [Wornpage Components](https://github.com/wornpage/components) packages for buttons, text entry, keyboard tabs, disclosures, alerts, status badges, and before/after change reviews. Both proposals and saved decisions use `ChangePreview`, with a stable denominator of three editable fields: owner, blocker, and next action.

Packages are pinned to immutable GitHub release archives, with integrity hashes in `package-lock.json`. They are public MIT dependencies; the application does not import core Projects source or private wrappers. See [third-party-notices.md](docs/third-party-notices.md) for versions and provenance.

## Amazon Bedrock setup

The server uses the named AWS profile **projects-amazon**, region **us-east-1**, and model **amazon.nova-micro-v1:0**. Other AWS profiles and browser-supplied credentials are not selected. Configure that profile with an identity authorized for `bedrock:InvokeModel` on the model below.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "bedrock:InvokeModel",
    "Resource": "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0"
  }]
}
```

Existing AWS console credentials can be used with AWS CLI 2's temporary sign-in flow:

```powershell
aws configure set region us-east-1 --profile projects-amazon
aws login --profile projects-amazon --region us-east-1
npm run aws:check
```

Persist the region in the profile: supplying `--region` to `aws login` alone did not configure the SDK's later token-refresh region in our setup. `aws:check` reads the persisted budget, resolves credentials and reads current public token prices. It makes **zero inference calls** and does not prove a live invocation will succeed. A profile separates configuration, not IAM permissions. A root-backed sign-in still has root permissions; use an appropriately scoped IAM identity for continued development. Do not commit credentials or share verification codes in chat. Temporary sessions expire and require another sign-in.

Missing credentials or provider errors are explicit unavailable states. Production startup contains no model-stub setting. A stub is injected only by automated tests.

## MCP and confirmation

The MCP endpoint is `POST /mcp`, using Streamable HTTP and protocol **2025-11-25**, implemented with the official TypeScript SDK pinned at **1.31.0**.

```powershell
npm run mcp:session
```

This creates a new fictional workspace and prints its MCP bearer token and the three tools: `get_briefing`, `get_work_item`, and `propose_next_action`. The token is not an AWS credential and cannot authenticate the browser confirmation endpoint. The human browser cookie is separate and HttpOnly.

The Bedrock conversation executes real MCP tool calls. Each turn forces a fresh `get_briefing` call, including pending proposals and recent decision summaries, before allowing other tool choices. A successful proposal tool result produces the app's concise review message immediately; no extra model call is used to restate it. Repeating an identical pending proposal for the same item and revision reuses its existing card; cancelled proposals remain recorded and can be proposed anew. A proposal records exact changed fields and the observed revision. Only a browser-confirmed action changes an item; stale proposals fail, duplicate confirmation applies once, and cancellation leaves the item unchanged. Updating a next action does not mark completion. Decision history retains the before/after values.

Each assistant turn displays proposal evidence from the stored tool result and current proposal status. Prose alone shows **No proposal created in this turn**. Existing chat entries update to confirmed, cancelled or stale as appropriate. Nova planning sections are omitted from visible replies and subsequent model text history; previously retained message records are preserved.

## Tests and bounded live validation

```powershell
npm run build
npm test
# Stop the running app before the live batch:
npm run validate:live
```

Automated tests exercise the real HTTP MCP transport, confirmation boundaries, persistence, session isolation, budget enforcement, desktop/mobile browser behavior, and unavailable-provider behavior. Test model fixtures make no AWS calls.

Live validation uses actual Bedrock through the browser. It retains `data/live-validation.json`, `data/live-validation-receipts.json`, and screenshots under `output/playwright/`. The command refuses to overwrite an earlier live batch. After reviewing a failed batch, `npm run validate:live -- --resume` creates a uniquely named continuation under the same ledger and authorization. It refuses to repeat a batch with a successful continuation. A database lock prevents another server opening the same database during validation.

The initial authorization is **$1 total inference testing and at most 20 attempted provider calls**, shared across app restarts and all demo workspaces. Every request has at most 800 output tokens, at most 24 KB of serialized context, and no automatic SDK retries. Current regional base-model prices are fetched from AWS's public price list and cached for at most an hour. Future calls reserve the full documented **128K input context** (131,072 tokens) plus 800 output tokens before dispatch; serialized bytes alone do not establish token count. The reservation must fit the remaining budget. Receipts retain this ceiling and its source, rates, timestamps, token usage, request IDs and estimated cost. Missing or out-of-limit usage and interrupted attempts stop further live inference. Historical receipts retain their original reservations. The displayed cost is a token-based estimate, **not an AWS billing statement**. Do not delete receipts or change the database to evade the authorization limit. [Nova Micro limits](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html).

A locally reviewed `AccessDeniedException` can receive a conservative cost hold when its retained model, region, profile, request bound, request ID and historical/current pricing establish a bound. The review reserves a full context in both directions at the higher rates, rounded up to a cent; the original attempt stays uncertain and its actual cost stays unknown. This operator action is unavailable to the browser and model. After inspecting the receipt and stopping the app, `node scripts/diagnose-aws.mjs --review-denial RECEIPT_ID` performs that review and **can make one charged Converse call**. It cannot repeat the review or reset either limit. Other unreviewed uncertainty still stops inference.

## Current verification

The production build and **55 automated tests pass**, including the complete browser confirmation journey, persistence through an actual Node server restart, isolated sessions, malformed MCP calls, protocol negotiation, stale proposals, double clicks, cancellation, owner/blocker changes, keyboard interaction, proposal-status evidence, planning-text handling, and retained-budget enforcement. Automated conversation tests use an explicitly injected model fixture. See [verification.md](docs/verification.md) for the full evidence and limitations.

On September 30, 2026, the actual Bedrock → MCP → browser journey passed: read a briefing, propose a client-portal next action, confirm exactly the displayed text, refresh, and read the saved action in a subsequent live briefing. A real owner-change proposal was also cancelled without changing the item or revision. This continuation preserves the original denied call and every intervening failed check.

On October 1, the owner authorized a retained extension from 20 to **30 total calls**, keeping the **$1 cumulative cap**. An ordinary-language owner request created a real card and cancellation preserved the item. A client-portal request exposed an incorrect spaced item ID; the MCP schemas now enumerate the exact workspace IDs. Repeating the same ordinary-language request after that correction passed proposal → exact confirmation → refresh → updated live Bedrock briefing. Saved-demo switching restored the decision. An identical direct MCP request reused the pending card without extra inference; duplicate ordinary-language requests were not revalidated live.

**Limits of this evidence:** every failed check remains retained; successful examples do not establish general model reliability. A described change is actionable only when the actual review card exists. The first AccessDenied cause and actual billed usage remain unknown; its reviewed **$0.03 hold** remains in the ledger. The support case was closed at the owner's request after access was demonstrated; closure does not reconcile that usage.

The current checkpoint is **29/30 attempts**, with **$0.001918455** in token-cost estimates and **$0.03** held, leaving **$0.968081545** under the $1 ceiling. Only one provider call remains. Conversation is therefore unavailable under the current allowance: even a fresh briefing needs two calls. Browsing saved work and decisions makes no inference calls. A fresh demo recording needs a separately authorized allowance; the app contains no budget-reset control.

The operator-only `store.extendInferenceAllowance(callLimit, reason)` records an explicit authorization in SQLite, preserving all receipts and the $1 cap. It accepts only a higher ceiling up to 30, requires a retained reason, and is unavailable through HTTP or MCP. Existing databases without an authorization retain the initial 20-call ceiling. The October 1 extension is already recorded; do not repeat it or delete the ledger.

## Challenge materials

The local captioned review video and the complete owner review checklist are described in [review-handoff.md](docs/review-handoff.md). Video preparation used the saved actual Bedrock session and made zero inference calls.

See [demo-script.md](docs/demo-script.md), [submission.md](docs/submission.md) and [product-feedback.md](docs/product-feedback.md). The challenge deadline is **October 23, 2026, 3 p.m. America/New_York**. A locally runnable repository and demonstration video are accepted for Alexa+; public hosting is not required. Prepare a video under three minutes and complete the required product feedback. Publishing the repository and submitting the entry are separate review steps.

Sources: [official requirements](https://amazonappdev2026.devpost.com/), [official FAQ](https://amazonappdev2026.devpost.com/details/faqs), [Nova Micro](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html), [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Source and license

Independently authored for this challenge, under the MIT license. No private production Projects or Nebius source was copied. npm dependencies retain their respective licenses; bundled DM Sans and Manrope fonts use the SIL Open Font License. Local state, credentials, validation receipts and screenshots are ignored by Git.
