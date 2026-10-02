# Devpost submission fields

## Project name

Projects Briefing

## Tagline

A work briefing that ends with a clear next step and a decision you control.

## Primary track and mini challenge

Alexa+ (simulated experience); AWS Builder.

## Inspiration

Small teams do not only need another summary. They need to understand what is waiting, choose a useful next move, and remember the decision. Projects Briefing connects a short conversation with the work itself while preserving human control over changes.

## What it does

The companion reads six fictional work items with owners, blockers, next actions, and completion criteria. A person can ask about an item or propose a change. A before/after card shows exactly what would change. Confirmation saves the decision; cancellation leaves the item alone. The next briefing reads the updated state, and history keeps the exact change. A next action does not mark the work complete.

## How we built it

The Svelte 5/Vite interface uses public Wornpage components. A Node.js 24 server stores the isolated demo workspace, proposals, history, and inference receipts in SQLite. Amazon Nova Micro runs through Amazon Bedrock Converse in us-east-1. The conversation executes three tools through a real Streamable HTTP MCP client and server using protocol 2025-11-25: get_briefing, get_work_item, and propose_next_action.

The model can read and propose. Human confirmation uses a separate HttpOnly browser credential and checks the source workspace revision. Confirmation applies once, stale proposals are rejected, and workspaces are isolated by browser ownership.

## Challenges and lessons

An earlier model request described a proposal without creating a tool result. The interface now treats the actual saved proposal as authoritative and never grants confirmation from prose alone. A later failed lookup used a title instead of an item ID; enumerating exact IDs in the tool schema corrected that demonstrated case. Provider failures and unknown usage remain in the cost ledger. See the product feedback for onboarding and model-specific friction.

## What we verified

The build and 57 local tests passed, covering HTTP MCP, confirmation, cancellation, stale and duplicate actions, persistence, isolated demos, and keyboard interaction. Actual Bedrock validation demonstrated the briefing/proposal/confirmation/updated-briefing flow. Local test fixtures are not evidence of general model reliability. Later presentation work used saved actual results and no additional inference calls.

## AWS Builder integration

Amazon Bedrock Converse invokes amazon.nova-micro-v1:0 in us-east-1 through the AWS SDK for JavaScript v3 and a dedicated AWS profile. Responses request bounded MCP tools that the Node server executes through an MCP client. Usage receipts retain token counts and estimates based on AWS's regional price list. Output is limited to 800 tokens per call; automatic retries are disabled. The app persists its test allowance across restarts and demo workspaces.

## What is new

The standalone app, Bedrock conversation, MCP tools, confirmation boundary, local persistence, and demo interface were independently authored during the challenge. It shares public Wornpage components and general product ideas with Projects; it does not contain production Projects or the Nebius edition's source.

## Links and materials

- GitHub source: https://github.com/wornpage/projects-amazon
- Public YouTube/Vimeo demonstration URL: pending upload.
- Full product feedback: [product-feedback.md](product-feedback.md).
- Setup and reproduction: [README.md](../README.md).

## Final entry check

The demo link must be public on YouTube or Vimeo, under three minutes, and in English. Confirm the selected account, entrant details, eligibility, and official-rule agreement in Devpost before final submission. These are entry steps; a GitHub release alone is not a submitted hackathon entry.
