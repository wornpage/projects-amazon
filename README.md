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

The six fictional work items, proposals, conversation messages and confirmed decisions persist in `data/briefing.sqlite`. Each browser session has its own workspace. **New demo** starts a new workspace and retains the previous one. Fonts and assets are bundled locally.

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
aws login --profile projects-amazon --region us-east-1
npm run aws:check
```

`aws:check` first reads the persisted inference budget, including while the app is running. If the budget allows testing, it resolves credentials and reads current public token prices. It makes **zero inference calls**. A profile separates configuration, not IAM permissions. A root-backed sign-in still has root permissions; use an appropriately scoped IAM identity for continued development. Do not commit credentials or share verification codes in chat. Temporary sessions expire and require another sign-in.

Missing credentials or provider errors are explicit unavailable states. Production startup contains no model-stub setting. A stub is injected only by automated tests.

## MCP and confirmation

The MCP endpoint is `POST /mcp`, using Streamable HTTP and protocol **2025-11-25**, implemented with the official TypeScript SDK pinned at **1.31.0**.

```powershell
npm run mcp:session
```

This creates a new fictional workspace and prints its MCP bearer token and the three tools: `get_briefing`, `get_work_item`, and `propose_next_action`. The token is not an AWS credential and cannot authenticate the browser confirmation endpoint. The human browser cookie is separate and HttpOnly.

The Bedrock conversation executes real MCP tool calls. Each turn must first read the current workspace. A proposal records exact changed fields and the observed revision. Only a browser-confirmed action changes an item; stale proposals fail, duplicate confirmation applies once, and cancellation leaves the item unchanged. Updating a next action does not mark completion. Decision history retains the before/after values.

## Tests and bounded live validation

```powershell
npm run build
npm test
# Stop the running app before the live batch:
npm run validate:live
```

Automated tests exercise the real HTTP MCP transport, confirmation boundaries, persistence, session isolation, budget enforcement, desktop/mobile browser behavior, and unavailable-provider behavior. Test model fixtures make no AWS calls.

Live validation uses actual Bedrock through the browser. It retains `data/live-validation.json`, `data/live-validation-receipts.json`, and screenshots under `output/playwright/`. The command refuses to overwrite an earlier live batch. A database lock prevents another server opening the same database during validation.

The initial authorization is **$1 total inference testing and at most 20 attempted provider calls**, shared across app restarts and all demo workspaces. Every request has at most 800 output tokens, at most 24 KB of serialized context, and no automatic SDK retries. Current regional base-model prices are fetched from AWS's public price list before a call. Future calls reserve the full documented **128K input context** (131,072 tokens) plus 800 output tokens before dispatch; serialized bytes alone do not establish token count. The reservation must fit the remaining budget. Receipts retain this ceiling and its source, rates, timestamps, token usage, request IDs and estimated cost. Missing or out-of-limit usage and interrupted attempts stop further live inference. Historical receipts retain their original reservations. The displayed cost is a token-based estimate, **not an AWS billing statement**. Do not delete receipts or change the database to evade the authorization limit. [Nova Micro limits](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html).

## Current verification

The production build and **34 automated tests pass**, including the complete browser confirmation journey, persistence through an actual Node server restart, isolated sessions, malformed MCP calls, protocol negotiation, stale proposals, double clicks, cancellation, owner/blocker changes, and keyboard interaction with Wornpage controls. Two added budget checks prove that an unaffordable full-context reservation dispatches no request, and out-of-limit usage is retained and stops further calls. Conversation responses in automated tests use an explicitly injected model fixture. See [verification.md](docs/verification.md) for the requirement audit and remaining live gate.

The first real Bedrock call returned **AccessDeniedException**. No successful live conversation or live confirmation journey has been established. The failed batch and its reservation of **$0.00035378** remain in `data/`; actual billed usage was not established. No automatic retry or additional inference call was made. AWS's model-availability API reported the model authorized and available, which does not prove runtime invocation works. A separate free `CountTokens` diagnostic returned that Nova Micro does not support token counting. [AWS CountTokens documentation](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html).

The live gate remains incomplete. Resolve the provider denial and the retained usage uncertainty before resuming inference under the existing $1 / 20-call limit. Do not erase the ledger or overwrite the retained batch. `scripts/diagnose-aws.mjs` performs only a free CountTokens diagnostic and retains its result; it never invokes a model.

## Challenge materials

See [demo-script.md](docs/demo-script.md), [submission.md](docs/submission.md) and [product-feedback.md](docs/product-feedback.md). The challenge deadline is **October 23, 2026, 3 p.m. America/New_York**. A locally runnable repository and demonstration video are accepted for Alexa+; public hosting is not required. Prepare a video under three minutes and complete the required product feedback. Publishing the repository and submitting the entry are separate review steps.

Sources: [official requirements](https://amazonappdev2026.devpost.com/), [official FAQ](https://amazonappdev2026.devpost.com/details/faqs), [Nova Micro](https://docs.aws.amazon.com/en_en/bedrock/latest/userguide/model-card-amazon-nova-micro.html), [MCP transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

## Source and license

Independently authored for this challenge, under the MIT license. No private production Projects or Nebius source was copied. npm dependencies retain their respective licenses; bundled DM Sans and Manrope fonts use the SIL Open Font License. Local state, credentials, validation receipts and screenshots are ignored by Git.
