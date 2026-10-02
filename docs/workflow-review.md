# Amazon workflow review

## What the platform comparison showed

The reviewed Projects/WebMCP/Nebius interaction puts visible work, pending decisions, and human approval in reachable views. Its documented Decision Workspace brings the item context, draft, and final human save together. The Amazon app previously placed conversation first, displayed proposals outside the selected tab, used small body text, and disabled the whole composer when the provider was unavailable.

This review used the surviving public edition documentation and interaction patterns as references. No Projects or Nebius source was copied into Amazon, and neither checkout was changed. The independently authored Amazon app keeps its existing Svelte interface, three-tool server MCP contract, SQLite workspace isolation, and browser-only confirmation.

## Changes to the active interface

| User need | Current behavior |
|---|---|
| Know where to start | Work appears first in both document and visual order. The entry panel offers View your work or Review proposed changes based on actual pending records. |
| Ask about a concrete item | Ask about this work prepares a question and focuses the composer. It sends nothing; Send is a separate explicit action. Starter questions also prepare drafts. |
| Continue while the provider is unavailable | Work, existing review cards, decisions, and question drafts remain available. Sending is disabled, and the provider explanation is in an accessible disclosure. |
| Find proposals | Needs review is a dedicated tab with an explicit pending count. A successfully saved proposal opens that view and moves focus to it. |
| Understand confirmation | Confirmation opens the actual saved decision; cancellation returns to work. Stale confirmation and duplicate-application protections remain intact. |
| Understand progress | Conversation, saving, cancellation, and workspace changes have distinct status text. Saving a human decision does not display model-thinking animation. |
| Read and navigate | Main work and reply text is 16px; controls and composer text are 16px. A skip link, keyboard tabs, panel focus, and stable work-header scrolling support navigation. |
| Interpret counts | Open work is out of all six items; blocked and ready counts are out of open work. ChangePreview keeps all three editable fields in its denominator. |

## Evidence and limits

The production build and **57 tests pass**. Browser tests verify that preparing a question causes no chat request, actual proposal results move focus into review, confirmation opens the saved decision, unavailable providers permit drafts but no sends, and progress reflects the actual operation. Existing tests cover stale proposals, cancellation, double confirmation, persistence, session isolation, and keyboard disclosures.

Read-only rendering of the retained actual Bedrock session was checked at widths 1440, 720 and 390 pixels. The client-portal next action and saved decision remained visible; primary work text measured 16px, and no document-level horizontal overflow occurred. The capture allowed only loopback GET/HEAD requests and verified an unchanged inference ledger. Screenshots and its receipt are under `output/review/workflow-usability/`.

This is local interaction and saved-history evidence, not a new model qualification or a complete WCAG conformance audit. No additional Bedrock calls were made; the shared authorization remains 29/30 attempts and $1. The previously prepared videos are preserved captures of the earlier interface. Publication and Devpost submission remain human review steps.
