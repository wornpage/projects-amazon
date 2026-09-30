# Draft submission

**Title:** Projects Briefing

**Primary track:** Alexa+

**Mini challenge:** AWS Builder

Projects Briefing helps a small team move from “what is blocked?” to a reviewed next action. In a conversational web interface, the assistant reads work items, explains their owners and blockers, and prepares a precise change. The person reviews a before/after card and confirms or cancels. Confirmed decisions persist, appear in history, and shape the next briefing.

The app is an explicitly labeled Alexa+ simulation. Its independent Node.js server exposes a working Streamable HTTP MCP endpoint using specification 2025-11-25. It implements Amazon Nova Micro through Amazon Bedrock Converse and executes the model's tool requests through an MCP client. The model can read and propose. Human confirmation uses a separate browser credential and checks the proposal's source revision. The interface uses the public MIT-licensed Wornpage component library.

The customer need is a short, useful work briefing that ends with a clear owner and next step. The workflow preserves human control while maintaining context across interactions. Saving a next action does not imply the work is complete.

This application was independently created during the challenge window. It uses six fictional work items and does not connect to production Projects, Alexa+ preview services, or the Nebius challenge edition.

**Current evidence:** the build and 34 automated tests pass, including an actual server restart, browser double-click confirmation, reservation affordability, and retained out-of-limit usage. Automated conversation tests use a model fixture. The first actual Bedrock invocation was denied; successful live model behavior has not been established. This draft is not ready to claim a working live Bedrock demonstration.

**Before submitting:** insert the reviewed GitHub repository URL, a public English demo video under three minutes, and the final observed validation result. Include the actual Bedrock integration and product feedback. Public publication, reviewer access and Devpost submission have not been performed by the local build.
