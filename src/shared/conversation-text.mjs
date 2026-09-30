// Nova can include planning sections in text blocks. Keep those out of the
// displayed reply and subsequent text history without modifying tool blocks.
export function assistantText(text) {
  let depth = 0;
  let visible = '';
  for (const part of text.split(/(<\/?thinking\b[^>]*>)/gi)) {
    if (/^<thinking\b/i.test(part)) depth++;
    else if (/^<\/thinking\b/i.test(part)) depth = Math.max(0, depth - 1);
    else if (depth === 0) visible += part;
  }
  return visible.trim();
}

export function conversationText(entry) {
  if (entry.role !== 'assistant') return entry.text;
  const proposals = entry.trace.filter(call => call.tool === 'propose_next_action' && !call.error).map(call => call.result);
  if (!proposals.length) return assistantText(entry.text);
  return proposals.map(value => `Prepared a change for “${value.original.title}”.`).join('\n') +
    '\nReview the proposed values in the change card. Work stays unchanged until you confirm.';
}
