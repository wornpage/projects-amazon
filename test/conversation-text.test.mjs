import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantText, conversationText } from '../src/shared/conversation-text.mjs';

test('assistant display excludes multiple, nested and unfinished planning sections', () => {
  assert.equal(assistantText('<thinking>private</thinking>Current facts.'), 'Current facts.');
  assert.equal(assistantText('<thinking>one</thinking>First. <THINKING>two</THINKING>Second.'), 'First. Second.');
  assert.equal(assistantText('<thinking>outer<thinking>inner</thinking>still private</thinking>Answer.'), 'Answer.');
  assert.equal(assistantText('Answer.<thinking>unfinished private text'), 'Answer.');
  assert.equal(assistantText('<thinking>no visible answer'), '');
  assert.equal(assistantText('Keep <button>literal text</button> and **Markdown**.'), 'Keep <button>literal text</button> and **Markdown**.');
});

test('new and retained proposal replies use actual tool results while user and failed-tool text are preserved', () => {
  const retained = { role: 'assistant', text: 'Verbose model text with an invented saved status.', trace: [
    { tool: 'propose_next_action', error: false, result: { original: { title: 'Fix mobile sign-in' } } }
  ] };
  assert.equal(conversationText(retained), 'Prepared a change for “Fix mobile sign-in”.\nReview the proposed values in the change card. Work stays unchanged until you confirm.');
  assert.equal(retained.text, 'Verbose model text with an invented saved status.');
  assert.equal(conversationText({ role: 'user', text: '<thinking>My literal label</thinking>', trace: [] }), '<thinking>My literal label</thinking>');
  assert.equal(conversationText({ role: 'assistant', text: '<thinking>Hidden plan</thinking>Could not propose.', trace: [{ tool: 'propose_next_action', error: true, result: { error: {} } }] }), 'Could not propose.');
});
