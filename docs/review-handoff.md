# Amazon app review handoff

## What is ready

Projects Briefing is a standalone local Alexa+ simulation with actual Nova Micro conversation, a three-tool Streamable HTTP MCP server, and browser-only confirmation. The production build and 55 automated tests pass. Retained live evidence demonstrates ordinary-language proposal creation, cancellation, exact confirmation, refresh, an updated briefing, and saved-demo recovery. Tests use fixtures only in automated runs.

The October 1 correction enumerates real item IDs in the MCP schemas after a failed spaced-ID lookup. All failures and receipt history remain retained. General model reliability is still unmeasured. The public Wornpage ChangePreview dependency has a minor singular-count grammar issue recorded in product feedback.

## Review materials

| Material | Location | Review purpose |
|---|---|---|
| Local app | `http://127.0.0.1:4317` | Inspect fictional work and saved history |
| Captioned video cut | `output/review/demo-review/projects-briefing-review.mp4` | Approximately 90 seconds of actual saved live results; no audio or fresh invocation |
| Video captions | `output/review/demo-review/captions.srt` | English script and timing |
| Capture receipt | `output/review/demo-review/capture-receipt.json` | Screenshot hashes and unchanged inference-ledger digest |
| Fresh interactive demo script | [demo-script.md](demo-script.md) | Target 2:40; requires a new inference allowance before recording |
| Submission text | [submission.md](submission.md) | Alexa+ and AWS Builder narrative, integration, evidence and limits |
| Product feedback | [product-feedback.md](product-feedback.md) | Observed outcomes and concrete recommendations |
| Verification audit | [verification.md](verification.md) | Local tests, actual-provider evidence and retained failures |
| Setup and MIT source | [README.md](../README.md) | Independently runnable repository |

The video is a review artifact assembled from screenshots of the retained actual-model session. It does not reenact proposal creation or confirmation, and should not be described as a continuous fresh run. Its capture allowed only loopback GET/HEAD requests and verified the inference ledger unchanged. No test-model output was used.

## Decisions remaining for the owner

Review the app, submission text, feedback and video. Select the captioned saved-results cut or a fresh narrated recording for the public demonstration. A fresh recording needs a new explicit allowance; this app's operator extension currently cannot exceed 30 calls. No additional inference was performed to prepare this handoff.

After review, publish the independently authored MIT source to a public repository, make the approved video publicly accessible, add those URLs to the submission, and submit through Devpost. These external actions have not been performed. Core Projects and Nebius are outside this handoff.

## Budget and privacy

Cumulative attempted calls remain 29/30. Token-cost estimate is $0.001918455, plus a $0.03 conservative hold for the original denied request; actual billed usage is unknown. One remaining call cannot complete a conversation, so new conversation stays unavailable. Saved work and decisions remain readable.

The source archive excludes SQLite, browser credentials, AWS credentials, provider receipts, screenshots, videos, output files and installed dependencies. The video shows only fictional workspace content and aggregate budget facts. Keep private receipt files outside the public repository.
