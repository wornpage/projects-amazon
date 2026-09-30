# Draft submission

**Title:** Projects Briefing

**Primary track:** Alexa+

**Mini challenge:** AWS Builder

Projects Briefing helps a small team move from “what is blocked?” to a reviewed next action. In a conversational web interface, the assistant reads work items, explains their owners and blockers, and prepares a precise change. The person reviews a before/after card and confirms or cancels. Confirmed decisions persist, appear in history, and shape the next briefing.

The app is an explicitly labeled Alexa+ simulation. Its independent Node.js server exposes a working Streamable HTTP MCP endpoint using specification 2025-11-25. It implements Amazon Nova Micro through Amazon Bedrock Converse and executes the model's tool requests through an MCP client. The model can read and propose. Human confirmation uses a separate browser credential and checks the proposal's source revision. The interface uses the public MIT-licensed Wornpage component library.

The customer need is a short, useful work briefing that ends with a clear owner and next step. The workflow preserves human control while maintaining context across interactions. Saving a next action does not imply the work is complete.

This application was independently created during the challenge window. It uses six fictional work items and does not connect to production Projects, Alexa+ preview services, or the Nebius challenge edition.

**Current evidence:** the build and 46 automated tests pass. The actual Bedrock/MCP/browser journey also passed: briefing, proposal, exact human confirmation, refresh and an updated briefing. A live owner-change proposal was cancelled without changing work. The batch used 19/20 calls, with a $0.001265915 token-cost estimate plus a $0.03 conservative hold for the original denied request. Original failures remain retained. These are token-based estimates, not an AWS billing statement.

**Observed limitation:** the owner-change request twice produced only a prose description. An explicit correction naming the proposal tool created the real card. Model tool selection needs further evaluation; a textual claim never grants confirmation permission or changes an item. Automated fixtures prove application behavior, not general model reliability.

Subsequent local refinements render proposal replies from actual tool results, show current proposal status in chat, include pending proposals in fresh briefings, and hide planning sections. They pass local regressions; they have not consumed additional live calls. The support case was closed at the owner's request after successful runtime access was demonstrated.

**Before submitting:** insert the reviewed GitHub repository URL and a public English demo video under three minutes. Review the observed limitations and include the product feedback. A fresh recording needs a separately authorized inference allowance: the current batch has only one call left. Repository publication, reviewer access and Devpost submission have not been performed.
