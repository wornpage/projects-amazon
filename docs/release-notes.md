# Projects Briefing 0.1.0

Projects Briefing turns a work conversation into a precise change that a person reviews and confirms. The local Alexa+ simulation uses actual Amazon Nova Micro through Bedrock Converse and a Streamable HTTP MCP client/server pair. The assistant reads work and proposes changes; only the browser can confirm them.

The interface starts with work items, prepares questions without sending, and puts pending proposals and saved decisions in dedicated views. It preserves drafts after failed sends, recovers browser-owned demos, rejects stale confirmations, and applies duplicate confirmation once. All six work items are fictional. Saving a next action does not complete work.

## Run and verify

Requires Node.js 24. See [README.md](../README.md) for installation and the dedicated `projects-amazon` AWS profile. `npm run build` and 57 tests passed locally, including the real HTTP MCP transport and browser workflow. Automated conversation fixtures are confined to tests.

Actual Bedrock validation previously demonstrated proposal, exact confirmation, refresh, an updated briefing, and cancellation. The retained failures remain documented in [verification.md](verification.md). The later interface changes were verified locally and against saved live history; no additional inference was used for publication preparation.

## Scope

This is an Alexa+ web simulation with an independently authored local workspace, not an Alexa+ partner-preview integration. Credentials and SQLite state stay on the operator's machine. The initial inference ceiling is 20 calls and $1 per local ledger, with no automatic reset or browser budget override.

The source is MIT licensed and uses public Wornpage component releases. This release does not include production Projects or Nebius source, private workspaces, AWS credentials, or provider receipt files. The submission targets Alexa+ and AWS Builder; final public video and Devpost entry status are tracked separately.
