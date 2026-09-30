# Product feedback — observed draft

This feedback reflects local development and one denied Bedrock invocation. Automated model fixtures establish workflow behavior, not model reliability.

| Tool, API or SDK | Use and onboarding | What worked | What needs work | Use again? |
|---|---|---|---|---|
| Amazon challenge documentation | Select Alexa+ and AWS Builder; read requirements and FAQ | The FAQ clearly permits our own simulator and a locally runnable repository | Preview-only Alexa+ setup links can appear usable by entrants; put the eligibility explanation beside each link | Yes; use the FAQ alongside the track guide |
| AWS CLI temporary sign-in | Authenticate the dedicated projects-amazon profile through the console | A fresh sign-in and immediate code transfer completed temporary authentication | The original code expired while its CLI prompt was in a background command session. Show which local process is waiting for a code | Yes; keep the prompt visible |
| Amazon Bedrock / Nova Micro | Conversational runtime and client-side tool use through Converse | The model and regional metadata are discoverable; the public price list is readable | First invocation returned AccessDeniedException despite authorized/available metadata and a nonzero token quota. Model reliability remains unverified | Conditional on resolving runtime access |
| AWS SDK for JavaScript v3 | Sign requests using the named profile; send Converse with maxTokens 800 and maxAttempts 1 | Configuration and typed command interfaces fit a small Node server; failures expose request metadata | Retain the provider message and HTTP status, not just the exception name. Our original receipt omitted the full explanation | Yes; keep bounded calls and diagnostic receipts |
| AWS Free Tier and Service Quotas APIs | Read account plan and model quota without inference | Confirmed the account plan and a nonzero token quota | Neither check explains the denied runtime request or proves inference is available | Yes for diagnostics, alongside runtime evidence |
| AWS public price list | Verify regional Nova Micro token rates before dispatch | Supplies current input/output rates and effective dates for retained reservations | Nova Micro rejected the free CountTokens operation, so an exact token preflight was unavailable | Yes; retain conservative cost reservations |
| MCP TypeScript SDK 1.31.0 | Real Streamable HTTP server and client; setup from SDK exports | Required protocol, discovery, reads, proposals, and version negotiation work in tests | Unknown tools return an error result; our first negative test incorrectly expected an exception. Highlight this shape in examples | Yes |
| Wornpage Components | Install immutable public release archives and import Svelte entries | Shared buttons, fields, tabs, disclosures, alerts and ChangePreview cover the workflow; keyboard checks pass | Button's archive omits its license file; we included the canonical MIT notice. ChangePreview's one-change count has a minor grammar issue | Yes |
| Svelte 5 and Vite | Typed conversation interface and local/production builds | Reactive work state and bundled component entries work together; desktop/mobile tests pass | Accessibility still needs application-level review of tab panels, labels and confirmation behavior | Yes |
| Node 24 and SQLite | Local server, per-session work data, proposals and history | Real process-restart tests preserve decisions and conversation; WAL permits a read-only budget preflight | A persisted uncertainty must remain visible in every preflight; our original aws:check used an empty in-memory ledger and was corrected | Yes |
| Express and Zod | HTTP routes and strict input validation | Malformed changes, invalid revisions, unauthorized origins and hidden confirmation tools fail without item mutation | Carefully keep browser confirmation and MCP permissions separate; frameworks do not establish that boundary automatically | Yes |
| Playwright | Automated browser journeys and screenshots | Real clicks, keyboard controls, refresh, double clicks and restarted servers are testable | A model fixture cannot prove provider behavior. Keep fixture screenshots and live evidence clearly identified | Yes |
| Fontsource | Bundle DM Sans and Manrope locally | The interface requests no external font assets | Preserve the fonts' OFL notices with the built assets | Yes |
| Codex | Draft implementation, tests, setup and challenge materials | Helped build the independent app and inspect the confirmation boundary | Human review and actual provider validation remain necessary; a green local suite does not prove a working live model | Yes, with evidence-based review |

## Feature request

**Important:** provide a self-service Alexa+ MCP testing path outside gated preview access, with a stateful decision example and a separate human-confirmation channel.

**Important:** make Bedrock readiness checks distinguish model metadata availability from an account's ability to invoke the model, and return a specific remediation for account restrictions.

## Friction log

| Task | Expected | Observed | Severity | Workaround or suggestion |
|---|---|---|---|---|
| Complete CLI sign-in | A visible local prompt ready for the code | The background command prompt was separate from the app terminal; the first code expired | Important | Start a fresh sign-in, transfer the code promptly, and show the actual waiting process |
| Validate Nova Micro | Authorized/available metadata leads to a successful bounded invocation | First Converse request was denied; quota metadata did not explain why | Critical for this demo | Retain the request ID, halt inference, and investigate account-specific access before retrying |
| Estimate tokens before inference | Free CountTokens can estimate this model's input | Nova Micro returned that it does not support token counting | Important | Use a bounded request and conservative cost reservation; advertise model support clearly |
| Recheck the app after a failed attempt | Preflight reports the persisted pause | Original aws:check used a fresh ledger | Important | Corrected to read the live SQLite ledger; regression tests cover the pause |

[AWS documents CountTokens as free](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html). The original provider attempt and diagnostic responses remain retained; no additional inference was made while preparing this feedback.
