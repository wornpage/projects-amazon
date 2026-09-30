# Product feedback — observed draft

This feedback reflects local development and a retained live batch of 19 Bedrock attempts: one denial and 18 responses with usable token counts. The main briefing/confirmation journey passed. The separate owner-change example needed an explicit correction before a proposal card existed. Automated fixtures establish application behavior, not model reliability.

| Tool, API or SDK | Use | What worked | Friction and recommendation | Use again? |
|---|---|---|---|---|
| Amazon challenge documentation | Select Alexa+ and AWS Builder | FAQ permits a simulator and local repository | Put partner-preview eligibility beside every setup link | Yes |
| AWS CLI temporary sign-in | Dedicated projects-amazon profile | Temporary console sign-in completed | Background prompt initially hid where to paste the code; persist profile region for later SDK refresh | Yes; show the waiting prompt |
| Bedrock / Nova Micro | Converse and client-side tool use | Actual briefing, proposal, confirmed-state read and corrected owner proposal succeeded | Metadata said authorized/available before an invocation was denied. Later owner requests twice described a proposal without calling its tool | Yes, with bounded evaluation and human confirmation |
| AWS SDK for JavaScript v3 | Named profile, maxTokens 800, maxAttempts 1 | Successful calls returned token counts and request IDs | Retain full bounded error messages and HTTP status. Our first denied receipt omitted the explanation | Yes |
| AWS account and quota APIs | Read plan, organization and token quota | Useful read-only account facts | These checks do not prove runtime access or explain a particular denial | Yes, alongside actual invocation evidence |
| AWS Basic Support | Approved free account-access case | Case creation and owner-requested closure worked without a paid support upgrade | No request-specific denial or billing explanation arrived before closure; actual model access was subsequently demonstrated | Useful for account issues; this case is closed |
| AWS public price list | Verify regional rates | Current rates, effective dates and response hash support retained reservations | Nova Micro rejected CountTokens. Reserve the documented context bound when exact preflight counting is unavailable | Yes |
| MCP TypeScript SDK 1.31.0 | Streamable HTTP server/client | Three tools, discovery and version negotiation work locally and with actual Bedrock | Unknown tools return an error result, not necessarily an exception; highlight this in examples | Yes |
| Wornpage Components | Public immutable Svelte packages | Buttons, fields, tabs, disclosures, alerts and ChangePreview cover the workflow; keyboard checks pass | Button archive omits its license; canonical notice is bundled here. One-change count has a grammar issue | Yes |
| Svelte 5 / Vite | Typed conversation and production build | Reactive state and public component entries work on desktop/mobile | The application must still verify labels, tab panels and confirmation behavior | Yes |
| Node 24 / SQLite | Local state, proposals and history | Actual server restarts preserve data; WAL supports read-only preflight | Read the same persistent budget on every entry path; never substitute an empty ledger | Yes |
| Express / Zod | HTTP and strict inputs | Invalid changes, stale revisions and unauthorized origins fail without mutation | Browser confirmation and MCP credentials need an explicit application boundary | Yes |
| Playwright | Real browser verification | Clicks, refresh, cancellation, repeated confirmation and screenshots are testable | A fixture cannot prove provider behavior; retain live failures separately | Yes |
| Fontsource | Bundle DM Sans / Manrope | No external font requests | Keep OFL notices with assets | Yes |
| Codex | Independent implementation and review | Helped build, test and inspect the app and preserve diagnostic evidence | Human review and actual-provider checks remain necessary; passing local tests alone is insufficient | Yes |

## Concrete friction and changes

**Credential refresh:** a missing region in the dedicated profile caused the SDK's temporary-login refresh to fail. Persisting `us-east-1` fixed that refresh. The subsequent Converse diagnostic succeeded. This does not prove that missing region caused the earlier AccessDenied response; that cause and actual billed usage remain unknown.

**Budget recovery:** the original denied receipt lacked usable usage. We retained it as uncertain and reviewed a conservative $0.03 hold based on the full documented context in both directions at the higher historical/current rates. That established affordable remaining cost without erasing the failure, assuming zero cost or increasing the authorization. A new unreviewed failure still pauses inference.

**Tool sequencing:** a real turn attempted a proposal before a fresh read. Forcing get_briefing with toolChoice at each turn solved that sequence problem while preserving the server's revision guard. Temperature is now zero, following Nova's tool-calling guidance. [Tool calling guidance](https://docs.aws.amazon.com/nova/latest/userguide/prompting-tools-function.html).

**Prose versus tools:** two owner-change requests produced prose describing a proposal, including an invitation to confirm, but no tool call and no card. An explicit correction naming propose_next_action created the card. The successful cancellation then left work and revision unchanged. The app now finishes a successful proposal directly from the saved tool result, shows record-based proposal status in chat, and includes pending proposals in fresh briefings. These changes pass local regressions without further provider calls. Broader model tool-selection reliability remains unproven.

**Response presentation:** Nova emitted planning tags, Markdown markers and internal identifiers in its text. Planning sections are now removed from the display and subsequent model text history, while old retained records remain unchanged. Successful proposal replies are generated concisely by the app from the real saved result. Plain-text briefing responses may still contain Markdown markers. [Nova tool-response format](https://docs.aws.amazon.com/nova/latest/userguide/tool-use-invocation.html).

**Validation assumptions:** a correct live next-action proposal omitted one terminal period. The harness now checks intended wording and separately asserts that confirmation stores the exact displayed text, rather than treating prompt punctuation as evidence of a storage defect. The failed check is retained.

## Feature requests

- Provide a self-service Alexa+ MCP testing path outside gated preview access, with a stateful decision example and separate human confirmation.
- Distinguish model metadata availability from account runtime access, and return request-specific remediation for denials.
- Document model-specific CountTokens support beside each model card and show a supported budget-reservation alternative.
- Include examples that validate actual tool results before presenting a proposed action as ready, including repeated conversation turns and browser decisions between them.

[CountTokens is documented as free](https://docs.aws.amazon.com/bedrock/latest/userguide/count-tokens.html); the retained response from this model stated it was unsupported. The original diagnostic, provider failures, successful usage and screenshots remain private local evidence, outside the public-source archive.
