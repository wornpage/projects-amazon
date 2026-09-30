<script>
  import { onMount } from 'svelte';
  import { Button, IconButton } from '@wornpage/button';
  import { Textarea } from '@wornpage/form-fields';
  import { Accordion, Collapsible } from '@wornpage/disclosure';
  import { Tabs, tabDomIds } from '@wornpage/tabs';
  import { Alert } from '@wornpage/alert';
  import { Badge, ChangePreview } from '@wornpage/data-display';
  import { conversationText } from '../shared/conversation-text.mjs';
  let workspace = $state(null);
  let loading = $state(true);
  let busy = $state(false);
  let message = $state('');
  let error = $state('');
  let notice = $state('');
  let view = $state('work');
  let expanded = $state(null);
  const pending = $derived(workspace?.proposals.filter(value => value.status === 'pending') ?? []);
  const tabs = $derived([
    { id: 'work', label: `Work items (${workspace?.counts.total ?? 0})` },
    { id: 'decisions', label: `Decisions (${workspace?.history.length ?? 0})` }
  ]);
  const workIds = tabDomIds('workspace', 'work');
  const decisionIds = tabDomIds('workspace', 'decisions');
  const prompts = ['What can we move forward today?', 'What is blocking the client portal?', 'Propose asking Jordan for the approved welcome copy tomorrow.'];
  const labels = { owner: 'Owner', blocker: 'Blocker', nextAction: 'Next action' };
  const previewFields = (original, changes) => Object.entries(labels).map(([field, label]) => ({
    id: field, label,
    before: original[field] || 'No blocker recorded',
    after: (field in changes ? changes[field] : original[field]) || 'No blocker recorded'
  }));
  const time = value => new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).format(new Date(value));
  function proposalEvidence(entry) {
    return entry.trace.filter(call => call.tool === 'propose_next_action' && !call.error).map(call => {
      const proposal = workspace.proposals.find(value => value.id === call.result.id);
      if (!proposal) return { id: call.result.id, label: 'Proposal record unavailable', variant: 'warn' };
      if (proposal.status === 'confirmed') return { id: proposal.id, label: 'Confirmed', variant: 'default' };
      if (proposal.status === 'cancelled') return { id: proposal.id, label: 'Cancelled', variant: 'muted' };
      if (proposal.sourceRevision !== workspace.revision) return { id: proposal.id, label: 'Needs a fresh proposal', variant: 'warn' };
      return { id: proposal.id, label: 'Awaiting your confirmation', variant: 'warn' };
    });
  }

  async function request(path, body) {
    const response = await fetch(path, body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Demo-Session': workspace.sessionId }, body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message ?? 'The request could not be completed.');
    return data;
  }
  async function refresh() {
    try { workspace = await request('/api/workspace'); }
    catch (failure) { error = failure.message; }
    finally { loading = false; }
  }
  async function send(text = message) {
    if (!text.trim() || busy || !workspace?.model.available) return;
    busy = true; error = ''; notice = ''; message = '';
    try { workspace = (await request('/api/chat', { message: text })).workspace; }
    catch (failure) { error = failure.message; await refresh(); }
    finally { busy = false; }
  }
  async function decide(proposal, action) {
    busy = true; error = ''; notice = '';
    try {
      const data = await request(`/api/proposals/${proposal.id}/${action}`, action === 'confirm' ? { sourceRevision: proposal.sourceRevision } : {});
      workspace = data.workspace;
      notice = action === 'confirm' ? 'Decision saved. The work item now shows your confirmed change.' : 'Proposal cancelled. The work item is unchanged.';
    } catch (failure) { error = failure.message; await refresh(); }
    finally { busy = false; }
  }
  async function newWorkspace() {
    busy = true; error = ''; notice = '';
    try { workspace = (await request('/api/session/new', {})).workspace; expanded = null; view = 'work'; notice = 'A fresh demo workspace is ready. Your previous workspace is retained.'; }
    catch (failure) { error = failure.message; }
    finally { busy = false; }
  }
  function composerKey(event) {
    if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send(); }
  }
  onMount(() => { void refresh(); });
</script>

<svelte:head><title>Projects Briefing · A clear next step</title></svelte:head>

<div class="app-shell">
  <header class="topbar">
    <a href="/" class="brand" aria-label="Projects Briefing home"><span class="brand-mark" aria-hidden="true">p<span>·</span></span><span>Projects <strong>Briefing</strong></span></a>
    <div class="topbar-right"><span class="simulation-badge"><span class="small-dot"></span>Alexa+ simulation</span><IconButton class="refresh-button" label="Refresh workspace" onclick={refresh} disabled={busy || loading}>↻</IconButton></div>
  </header>

  <main>
    <section class="intro" aria-labelledby="page-title">
      <div><div class="eyebrow"><span class="eyebrow-rule"></span>THE WORK, IN FOCUS</div><h1 id="page-title">A clear next step.</h1><p>Understand what’s waiting. Decide what moves forward.</p></div>
      <div class="workspace-label"><span class="workspace-icon" aria-hidden="true">◇</span><div><strong>Studio launch</strong><span>Fictional demo workspace{#if workspace} · revision {workspace.revision}{/if}</span></div></div>
    </section>

    {#if error}<Alert tone="danger" title="Request unavailable" dismissible dismissLabel="Dismiss error" ondismiss={() => error = ''}>{error}</Alert>{/if}
    {#if notice}<Alert tone="success">{notice}</Alert>{/if}

    {#if loading}<div class="loading" role="status">Opening your demo workspace…</div>
    {:else if workspace}
      <div class="summary-strip" aria-label="Workspace summary">
        <div><span class="metric-label">Open work</span><strong>{workspace.counts.open}<small> / {workspace.counts.total} items</small></strong></div>
        <div><span class="metric-label"><span class="small-dot amber"></span>Waiting on a blocker</span><strong>{workspace.counts.blocked}<small> / {workspace.counts.open} open</small></strong></div>
        <div><span class="metric-label"><span class="small-dot"></span>Ready for a next action</span><strong>{workspace.counts.ready}<small> / {workspace.counts.open} open</small></strong></div>
        <div class="summary-note"><span aria-hidden="true">↗</span><p>A next action moves work forward.<br />Completion still needs its evidence.</p></div>
      </div>

      <div class="main-grid">
        <section class="conversation-panel panel" aria-labelledby="conversation-title">
          <div class="panel-heading"><div><span class="section-kicker">YOUR WORK COMPANION</span><h2 id="conversation-title">Let’s find the next move.</h2></div><span class="companion-symbol" aria-hidden="true">✳</span></div>
          <div class="conversation-body" aria-live="polite" aria-busy={busy}>
            {#if workspace.messages.length === 0}
              <div class="welcome-message"><span class="avatar" aria-hidden="true">✳</span><div><strong>Start with the work you have.</strong><p>I can read the board, explain a blocker, and propose a change for you to review. You decide what gets saved.</p></div></div>
              <div class="starter-questions"><span>TRY ASKING</span>{#each prompts as prompt}<Button class="starter-button" onclick={() => send(prompt)} disabled={busy || !workspace.model.available}>{prompt}<span aria-hidden="true">↗</span></Button>{/each}</div>
            {:else}
              {#each workspace.messages as entry (entry.id)}
                {@const evidence = proposalEvidence(entry)}
                <article class:from-user={entry.role === 'user'} class:connection-notice={entry.role === 'notice'} class="chat-message">
                  <div class="message-meta"><strong>{entry.role === 'user' ? 'You' : entry.role === 'notice' ? 'Connection notice' : 'Briefing'}</strong><time datetime={entry.createdAt}>{time(entry.createdAt)}</time></div><p>{conversationText(entry)}</p>
                  {#if entry.role !== 'user'}<div class="message-evidence" data-testid="message-evidence">
                    {#each evidence as result (result.id)}<Badge label={result.label} variant={result.variant} size="sm" />{/each}
                    {#if evidence.length === 0}<span>No proposal created in this turn.</span>{/if}
                  </div>{/if}
                  {#if entry.trace.length}<div class="tool-trace"><Accordion label={`${entry.trace.length} MCP tool ${entry.trace.length === 1 ? 'call' : 'calls'}`}><ol>{#each entry.trace as call}<li><code>{call.tool}</code><span>{call.error ? 'Returned an error' : 'Read or proposed demo state'}</span></li>{/each}</ol></Accordion></div>{/if}
                </article>
              {/each}
            {/if}
            {#if busy}<div class="thinking" role="status"><span></span><span></span><span></span><p>Working through the request…</p></div>{/if}
          </div>
          {#if !workspace.model.available}<div class="connection-notice-banner"><Alert tone="warning" title="Conversation is unavailable"><p>{workspace.model.message}</p><Button class="recheck-button" onclick={refresh} disabled={busy}>Recheck connection</Button></Alert></div>{/if}
          <form class="composer" onsubmit={event => { event.preventDefault(); void send(); }}>
            <label for="message">Message your work companion</label><Textarea id="message" bind:value={message} onkeydown={composerKey} maxlength="1500" rows={2} spellcheck placeholder="What can we move forward today?" disabled={busy || !workspace.model.available} />
            <div class="composer-bottom"><span>Changes wait for your confirmation.</span><Button variant="primary" type="submit" disabled={busy || !workspace.model.available || !message.trim()} aria-label="Send message">Send <span aria-hidden="true">↑</span></Button></div>
          </form>
          <div class="model-line"><span class="small-dot" class:offline={!workspace.model.available}></span><span>Amazon Bedrock · Nova Micro</span><span>Typed conversation</span></div>
        </section>

        <section class="work-panel" aria-labelledby="work-title">
          <div class="work-heading"><div><span class="section-kicker">STUDIO LAUNCH</span><h2 id="work-title">The work on your plate.</h2></div><Button onclick={newWorkspace} disabled={busy}>New demo <span aria-hidden="true">↗</span></Button></div>
          <div class="view-tabs"><Tabs id="workspace" label="Workspace views" {tabs} bind:active={view} /></div>
          {#each pending as proposed (proposed.id)}
            <article class="proposal-card" data-testid="proposal-card" aria-labelledby={`proposal-${proposed.id}`}>
              <div class="proposal-eyebrow"><span aria-hidden="true">✧</span>PROPOSED CHANGE<Badge label="Needs your review" variant="muted" size="sm" /></div><h3 id={`proposal-${proposed.id}`}>{proposed.original.title}</h3>
              <ChangePreview class="proposal-review" title="Review changes" headingLevel={3} fields={previewFields(proposed.original, proposed.changes)} />
              {#if proposed.sourceRevision !== workspace.revision}<p class="stale-note" role="status">The workspace changed. Ask for a fresh proposal before confirming.</p>{:else}<p class="proposal-footnote">This changes the next step. It does not mark the work complete.</p>{/if}
              <div class="proposal-actions"><Button variant="primary" onclick={() => decide(proposed, 'confirm')} disabled={busy || proposed.sourceRevision !== workspace.revision}>Confirm action <span aria-hidden="true">✓</span></Button><Button onclick={() => decide(proposed, 'cancel')} disabled={busy}>Cancel proposal</Button></div>
            </article>
          {/each}
            <div id={workIds.panelId} role="tabpanel" aria-labelledby={workIds.tabId} hidden={view !== 'work'} class="work-cards">
              {#each workspace.items as item (item.id)}
                <article class="work-card" class:completed={item.status === 'done'} data-testid={`item-${item.id}`}>
                  <div class="item-top"><span class="item-category">{item.category}</span><Badge label={item.status === 'done' ? 'Done' : item.blocker ? 'Waiting' : 'Ready'} variant={item.status === 'done' ? 'muted' : item.blocker ? 'warn' : 'default'} size="sm" /></div>
                  <h3>{item.title}</h3><div class="item-owner"><span class="owner-avatar" aria-hidden="true">{item.owner.slice(0, 1)}</span><span>{item.owner}</span></div>
                  <div class="next-action"><span>NEXT ACTION</span><p>{item.nextAction}</p></div>
                  <Collapsible summary="Blocker & completion criteria" ariaLabel={`Blocker & completion criteria for ${item.title}`} panelId={`details-${item.id}`} open={expanded === item.id} onchange={open => expanded = open ? item.id : null}><dl class="item-details"><div><dt>Blocker</dt><dd>{item.blocker || 'No blocker recorded.'}</dd></div><div><dt>Completion criteria</dt><dd>{item.completionCriteria}</dd></div></dl></Collapsible>
                </article>
              {/each}
            </div>
            <div id={decisionIds.panelId} role="tabpanel" aria-labelledby={decisionIds.tabId} hidden={view !== 'decisions'} class="decisions-list">
              {#if workspace.history.length === 0}<div class="empty-history"><span aria-hidden="true">↳</span><h3>Your decisions will live here.</h3><p>Confirm a proposal to keep a record of what changed and when you confirmed it.</p></div>{/if}
              {#each workspace.history as decision (decision.id)}<article class="decision-card"><div class="decision-top"><span class="small-dot"></span><strong>Decision saved</strong><time datetime={decision.createdAt}>{time(decision.createdAt)}</time></div><h3>{decision.after.title}</h3><ChangePreview class="decision-review" title="Saved change" headingLevel={3} currentLabel="Before confirmation" proposedLabel="Confirmed" fields={previewFields(decision.before, decision.after)} /><span>Workspace revision {decision.revision}</span></article>{/each}
            </div>
        </section>
      </div>

      <div class="demo-details"><Collapsible summary="Demo & connection details" panelId="connection-details"><section class="connection-details"><div><h3>A working simulation</h3><p>Six fictional items, an independent SQLite workspace, and a real Streamable HTTP MCP server. This app is not connected to Alexa+ or production Projects.</p></div><div><h3>Bounded live inference</h3><p>{workspace.budget.attemptedCalls} / {workspace.budget.callLimit} calls attempted. Estimated completed-call cost: ${workspace.budget.estimatedCostUsd.toFixed(6)}. Reserved cost: ${workspace.budget.reservedUsd.toFixed(6)}. Authorization: $1 total. {workspace.budget.uncertainCalls} attempts have uncertain usage: {workspace.budget.reviewedUncertainCalls} covered by reviewed conservative holds; {workspace.budget.unreviewedUncertainCalls} awaiting review. These holds do not establish actual billed usage.</p></div><div><h3>MCP connection</h3><p>Protocol 2025-11-25 · <code>/mcp</code> · run <code>npm run mcp:session</code> for an isolated client workspace. Model tools can read and propose; confirmation is a browser action.</p></div></section></Collapsible></div>
      <footer class="page-footer"><span>Projects Briefing <span class="footer-dot">·</span> Amazon Developer Hackathon 2026</span><span>Independent demo · Six fictional work items</span></footer>
    {/if}
  </main>
</div>
