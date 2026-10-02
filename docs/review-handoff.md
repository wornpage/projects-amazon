# Amazon app review handoff

## What is ready

Published October 2, 2026: [public GitHub source](https://github.com/wornpage/projects-amazon), [release 0.1.0](https://github.com/wornpage/projects-amazon/releases/tag/v0.1.0), and [public YouTube demo](https://youtu.be/XkcJ2Nk2Yew). The release source ZIP was verified against its uploaded SHA-256 digest. A fresh checkout installed, built, and passed 57 tests. Devpost registration and final submission remain pending.

Projects Briefing is a standalone local Alexa+ simulation with actual Nova Micro conversation, a three-tool Streamable HTTP MCP server, and browser-only confirmation. The production build and 57 automated tests pass. The revised interface starts with work, gives proposals a Needs review view, and distinguishes preparing a question from sending it. Retained live evidence demonstrates ordinary-language proposal creation, cancellation, exact confirmation, refresh, an updated briefing, and saved-demo recovery. Tests use fixtures only in automated runs.

The October 1 correction enumerates real item IDs in the MCP schemas after a failed spaced-ID lookup. All failures and receipt history remain retained. General model reliability is still unmeasured. The public Wornpage ChangePreview dependency has a minor singular-count grammar issue recorded in product feedback.

## Review materials

| Material | Location | Review purpose |
|---|---|---|
| Local app | `http://127.0.0.1:4317` | Inspect fictional work and saved history |
| Current captioned video | `output/review/demo-readable-v3/projects-briefing-readable.mp4` | 80 seconds, 1080p, four close views with large text; saved live results, no audio or fresh invocation |
| Video captions | `output/review/demo-readable-v3/captions.srt` | English script and timing |
| Capture and video receipts | `output/review/demo-readable-v3/capture-receipt.json` and `video-receipt.json` | Screenshot/video hashes, actual source-report link, measured text sizes and unchanged inference ledger |
| Preserved original video | `output/review/demo-review/projects-briefing-review.mp4` | Earlier 90-second overview; retained for comparison |
| Fresh interactive demo script | [demo-script.md](demo-script.md) | Target 2:40; requires a new inference allowance before recording |
| Submission text | [submission.md](submission.md) | Alexa+ and AWS Builder narrative, integration, evidence and limits |
| Product feedback | [product-feedback.md](product-feedback.md) | Observed outcomes and concrete recommendations |
| Verification audit | [verification.md](verification.md) | Local tests, actual-provider evidence and retained failures |
| Workflow comparison and changes | [workflow-review.md](workflow-review.md) | Work-first navigation, drafting, review, feedback and local accessibility checks |
| Setup and MIT source | [README.md](../README.md) | Independently runnable repository |

The video is a review artifact assembled from screenshots of the retained actual-model session. It does not reenact proposal creation or confirmation, and should not be described as a continuous fresh run. Its capture allowed only loopback GET/HEAD requests and verified the inference ledger unchanged. No test-model output was used.

## Decisions remaining for the owner

Review the app, submission text, feedback and video. Select the captioned saved-results cut or a fresh narrated recording for the public demonstration. A fresh recording needs a new explicit allowance; this app's operator extension currently cannot exceed 30 calls. No additional inference was performed to prepare this handoff.

The independently authored MIT source and captioned saved-results video are now public, and their URLs are in [submission-fields.md](submission-fields.md). Complete the personal registration fields and official-rule agreement, then the Devpost entry. Core Projects and Nebius are outside this handoff.

## Budget and privacy

Cumulative attempted calls remain 29/30. Token-cost estimate is $0.001918455, plus a $0.03 conservative hold for the original denied request; actual billed usage is unknown. One remaining call cannot complete a conversation, so new conversation stays unavailable. Saved work and decisions remain readable.

The source archive excludes SQLite, browser credentials, AWS credentials, provider receipts, screenshots, videos, output files and installed dependencies. The video shows only fictional workspace content and aggregate budget facts. Keep private receipt files outside the public repository.
