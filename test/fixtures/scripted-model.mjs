// Automated tests only. Production startup has no stub-provider environment flag.
export function scriptedModel() {
  let count = 0;
  return {
    async availability() { return { available: true, message: 'Automated test model fixture' }; },
    async converse({ messages }) {
      count++;
      const userText = messages.findLast(value => value.role === 'user' && value.content.some(part => part.text))?.content.find(part => part.text)?.text ?? '';
      const currentResults = messages.at(-1).content.filter(part => part.toolResult);
      const tool = (name, input) => ({ stopReason: 'tool_use', output: { message: { role: 'assistant', content: [{ toolUse: { toolUseId: `test-${count}`, name, input } }] } } });
      const final = text => ({ stopReason: 'end_turn', output: { message: { role: 'assistant', content: [{ text }] } } });
      if (!currentResults.length) return tool('get_briefing', {});
      const data = currentResults[0].toolResult.content[0].json;
      if (data.items) {
        if (/propose|update|change/i.test(userText)) return tool('propose_next_action', { itemId: 'client-portal', sourceRevision: data.revision, changes: { nextAction: 'Ask Jordan for the approved welcome copy tomorrow.' } });
        return final(`Studio launch has ${data.counts.open} open items and ${data.counts.blocked} blocked items. Client portal next action: ${data.items.find(item => item.id === 'client-portal').nextAction} Workspace revision ${data.revision}.`);
      }
      if (data.error) return final(`The tool returned ${data.error.code}. No item was changed.`);
      return final('I prepared a next-action proposal for the client portal. Review the card and confirm it to save the decision. The work item is unchanged until you confirm.');
    },
    close() {}
  };
}
