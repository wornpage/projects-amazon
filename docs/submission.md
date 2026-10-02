# Draft submission

**Title:** Projects Briefing

**Primary track:** Alexa+

**Mini challenge:** AWS Builder

**Source:** https://github.com/wornpage/projects-amazon

**Public demo:** https://youtu.be/XkcJ2Nk2Yew — 80 seconds, English captions, saved actual Bedrock results. The later interface refinement is included in the source.

Projects Briefing helps a small team move from “what is blocked?” to a reviewed next action. In a conversational web interface, the assistant reads work items, explains their owners and blockers, and prepares a precise change. The person reviews a before/after card and confirms or cancels. Confirmed decisions persist, appear in history, and shape the next briefing.

The app is an explicitly labeled Alexa+ simulation. Its independent Node.js server exposes a working Streamable HTTP MCP endpoint using specification 2025-11-25. It implements Amazon Nova Micro through Amazon Bedrock Converse and executes the model's tool requests through an MCP client. The model can read and propose. Human confirmation uses a separate browser credential and checks the proposal's source revision. The interface uses the public MIT-licensed Wornpage component library.

The customer need is a short, useful work briefing that ends with a clear owner and next step. The workflow preserves human control while maintaining context across interactions. Saving a next action does not imply the work is complete.

This application was independently created during the challenge window. It uses six fictional work items and does not connect to production Projects, Alexa+ preview services, or the Nebius challenge edition.

**Current evidence:** the build and 57 automated tests pass. The actual Bedrock/MCP/browser journey also passed: briefing, ordinary-language proposal, exact human confirmation, refresh and an updated briefing. A live owner-change proposal was cancelled without changing work, and demo switching restored the saved decision. A failed spaced item-ID lookup led to exact-ID tool schemas; the repeated ordinary-language request then passed. Cumulative testing used 29/30 authorized calls, with a $0.001918455 token-cost estimate plus a $0.03 conservative hold for the original denied request. Original failures remain retained. These are token-based estimates, not an AWS billing statement.

**Observed limitation:** the owner-change request twice produced only a prose description. An explicit correction naming the proposal tool created the real card. Model tool selection needs further evaluation; a textual claim never grants confirmation permission or changes an item. Automated fixtures prove application behavior, not general model reliability.

The interface renders proposal replies from actual tool results, shows current proposal status in chat, includes pending proposals in fresh briefings, and hides planning sections. These changes pass local regressions and were exercised in the October 1 live workflow. The support case was closed at the owner's request after successful runtime access was demonstrated.

**Before submitting:** complete Devpost registration and the final entry, including product feedback and the selected Alexa+/AWS Builder tracks. The GitHub repository and YouTube demo are public; Devpost submission is still pending. A fresh model recording would need a separately authorized inference allowance because the current batch has only one call left.
