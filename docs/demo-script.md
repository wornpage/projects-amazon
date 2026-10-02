# Demonstration script — target 2 minutes 40 seconds

The current **80-second captioned review cut** is `output/review/demo-readable-v3/projects-briefing-readable.mp4`, with `captions.srt`, capture and video receipts. It shows four close views: the work item, actual proposal record, saved next-action change, and following actual Bedrock reply. The 1080p video uses 62px scene titles, 42px captions, and approximately 33–44px primary app text. It stays labeled as saved live results, contains no narration audio or fresh invocation, and does not reenact confirmation. Review it before deciding whether to record the fresh interactive version below. The original 90-second cut remains at `output/review/demo-review/projects-briefing-review.mp4`. Local videos are excluded from the source ZIP.

The live workflow is validated; review `verification.md` and the retained screenshots first. A fresh recording needs a separately authorized inference allowance because 29 of the approved 30 total calls have been used. Record the real Bedrock runtime in a fresh fictional workspace. Keep the simulation label visible. Do not show AWS authorization codes, credentials or private account pages.

| Time | On screen | Narration |
|---|---|---|
| 0:00–0:20 | Workspace and six work items | “Projects Briefing turns a work briefing into a reviewed next action. This is a simulated Alexa+ interface, powered by Amazon Bedrock and a working MCP server.” |
| 0:20–0:50 | Ask what can move forward today; expand the tool-call trace | “The assistant reads current owners, blockers, next actions and completion criteria through Streamable HTTP MCP. It works from the current workspace.” |
| 0:50–1:25 | Ask: “For the client portal, propose changing only nextAction to: Ask Jordan for the approved welcome copy tomorrow.” | “Bedrock uses the proposal tool to create this card. It shows the old and new values. It has not changed the work item.” |
| 1:25–1:50 | Confirm, refresh, open Decisions; show Confirmed on the chat entry | “A human confirmation saves the decision once. The change survives refresh, and the history preserves what changed. The item remains active.” |
| 1:50–2:15 | Ask for another briefing | “The next conversation reads the updated state instead of repeating an old recommendation.” |
| 2:15–2:35 | Show Decisions and expand the two unchanged fields | “The history keeps the exact change. Owner and blocker are still visible, and the item remains active. Saving a next action does not complete the work.” |
| 2:35–2:40 | Workspace and connection details | “One small workflow: understand the blocker, choose the next move, and keep the decision.” |

If the model describes a proposal without producing the card, correct it explicitly and record that limitation in the feedback. Do not treat prose as a completed action or substitute a test-model recording for a live demonstration. Video upload and Devpost submission follow review.
