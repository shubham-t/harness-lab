// Transport unit tests only. These fixtures never run in the demo and do not
// evaluate a model. Every fetch is mocked; no network requests or charges occur.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.OPENAI_API_KEY = '';
process.env.OPENAI_MODEL = '';
process.env.OPENAI_BASE_URL = '';
process.env.LLM_PROTOCOL = 'responses';
globalThis.fetch = async () => { throw new Error('Unexpected fetch in transport unit test'); };
let moduleId = 0;
const KEY = 'unit-test-credential-do-not-send';
const BASE = 'https://transport.invalid/v1';
const TOOL = { type: 'function', name: 'list_files', description: 'List files', strict: true, parameters: { type: 'object', properties: {}, required: [], additionalProperties: false } };
const history = [{ role: 'user', content: 'Unit transport fixture.' }];
const response = object => new Response(JSON.stringify(object));
const output = [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Unit fixture.' }] }];
async function provider(protocol = 'responses', baseUrl = BASE) {
  const client = await import(`../lib/provider.mjs?unit=${++moduleId}`);
  client.configureProvider({ apiKey: KEY, model: 'unit-model', baseUrl, protocol });
  return client;
}

test('transport unit: Responses request and opaque continuation items', async t => {
  const client = await provider();
  const items = [{ type: 'reasoning', encrypted_content: 'opaque-unit-state', summary: [] }, ...output, { type: 'function_call', call_id: 'unit-call', name: 'list_files', arguments: '{}' }];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, BASE + '/responses');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'unit-model');
    assert.deepEqual(body.input, history);
    assert.equal(body.store, false);
    assert.equal(body.parallel_tool_calls, false);
    assert.equal(body.max_output_tokens, 6000);
    assert.deepEqual(body.include, ['reasoning.encrypted_content']);
    assert.deepEqual(body.tools, [TOOL]);
    return response({ status: 'completed', output: items, usage: { input_tokens: 20, output_tokens: 8 } });
  });
  const result = await client.callModel({ instructions: 'Unit instructions.', history, tools: [TOOL] });
  assert.deepEqual(result.items, items);
  assert.equal(result.text, 'Unit fixture.');
  assert.equal(result.text.includes('opaque-unit-state'), false);
  assert.deepEqual(result.calls, [{ id: 'unit-call', name: 'list_files', arguments: '{}' }]);
  assert.deepEqual(result.usage, { input: 20, output: 8 });
});

test('transport unit: Chat Completions messages and tool adapter', async t => {
  const client = await provider('chat-completions');
  const toolCalls = [{ id: 'unit-chat', type: 'function', function: { name: 'list_files', arguments: '{}' } }];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, BASE + '/chat/completions');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.messages, [{ role: 'system', content: 'Unit instructions.' }, ...history]);
    assert.deepEqual(body.tools, [{ type: 'function', function: { name: TOOL.name, description: TOOL.description, parameters: TOOL.parameters, strict: true } }]);
    assert.equal(body.parallel_tool_calls, false);
    return response({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, reasoning_content: 'private-unit-field', tool_calls: toolCalls } }], usage: { prompt_tokens: 10, completion_tokens: 4 } });
  });
  const result = await client.callModel({ instructions: 'Unit instructions.', history, tools: [TOOL] });
  assert.deepEqual(result.items, [{ role: 'assistant', content: null, tool_calls: toolCalls }]);
  assert.equal(JSON.stringify(result).includes('private-unit-field'), false);
  assert.deepEqual(result.calls, [{ id: 'unit-chat', name: 'list_files', arguments: '{}' }]);
  assert.deepEqual(result.usage, { input: 10, output: 4 });
});

test('transport unit: OpenRouter preserves exact private reasoning details through tool continuation', async t => {
  const client = await provider('chat-completions', 'https://openrouter.ai/api/v1');
  const details = [{ type: 'reasoning.encrypted', data: 'private-unit-block-one', id: 'reasoning-1', index: 0 }, { type: 'reasoning.text', text: 'private-unit-block-two', index: 1 }];
  const toolCalls = [{ id: 'router-call', type: 'function', function: { name: 'list_files', arguments: '{}' } }];
  let invocation = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal('reasoning' in body, false, 'Agent calls must keep their normal reasoning settings');
    if (++invocation === 1) return response({ choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: 'Inspecting files.', tool_calls: toolCalls, reasoning_details: details, reasoning: 'unused-private-reasoning', reasoning_content: 'unused-private-alias' } }] });
    assert.deepEqual(body.messages.at(-2), { role: 'assistant', content: 'Inspecting files.', tool_calls: toolCalls, reasoning_details: details });
    assert.deepEqual(body.messages.at(-1), { role: 'tool', tool_call_id: 'router-call', content: '{"files":[]}' });
    return response({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Ready.' } }] });
  });
  const first = await client.callModel({ history, tools: [TOOL] });
  assert.deepEqual(first.items[0].reasoning_details, details);
  assert.equal(first.text, 'Inspecting files.');
  assert.equal(JSON.stringify({ text: first.text, calls: first.calls }).includes('private-'), false);
  assert.equal('reasoning' in first.items[0], false, 'Structured details take precedence over raw strings');
  assert.equal('reasoning_content' in first.items[0], false);
  const second = await client.callModel({ history: [...history, ...first.items, { role: 'tool', tool_call_id: 'router-call', content: '{"files":[]}' }], tools: [TOOL] });
  assert.equal(second.text, 'Ready.');
});

test('transport unit: OpenRouter raw reasoning fallbacks stay private and require the official host', async t => {
  for (const fields of [{ reasoning: 'private-unit-string', reasoning_content: 'unused-alias' }, { reasoning_content: 'private-unit-alias' }]) {
    const client = await provider('chat-completions', 'https://openrouter.ai/api/v1');
    t.mock.method(globalThis, 'fetch', async () => response({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Visible.', ...fields } }] }));
    const result = await client.callModel({ history });
    const selected = fields.reasoning ? 'reasoning' : 'reasoning_content';
    assert.equal(result.items[0][selected], fields[selected]);
    assert.equal(result.text, 'Visible.');
    t.mock.restoreAll();
  }
  for (const baseUrl of ['https://openrouter.ai.example/api/v1', 'https://proxy.openrouter.ai/api/v1']) {
    const client = await provider('chat-completions', baseUrl);
    const budgets = [];
    t.mock.method(globalThis, 'fetch', async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal('reasoning' in body, false);
      budgets.push(body.max_tokens);
      return response({ choices: [{ message: { role: 'assistant', content: 'OK', reasoning_details: [{ data: 'private-unit-details' }], reasoning: 'private-unit-string', reasoning_content: 'private-unit-alias' } }] });
    });
    const result = await client.callModel({ history });
    assert.equal(JSON.stringify(result).includes('private-unit'), false);
    assert.equal((await client.testConnection()).ok, true);
    assert.deepEqual(budgets, [6000, 32]);
    t.mock.restoreAll();
  }
});

test('transport unit: OpenRouter connection test limits reasoning and never verifies reasoning-only output', async t => {
  const client = await provider('chat-completions', 'https://openrouter.ai/api/v1');
  let next = { choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'OK', reasoning: 'private-unit-string' } }], usage: { prompt_tokens: 3, completion_tokens: 1 } };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.max_tokens, 256);
    assert.deepEqual(body.reasoning, { enabled: false });
    return response(next);
  });
  const verified = await client.testConnection();
  assert.equal(verified.ok, true);
  assert.equal(JSON.stringify(verified).includes('private-unit'), false);
  next = { choices: [{ finish_reason: 'length', message: { role: 'assistant', content: null, reasoning_details: [{ type: 'reasoning.encrypted', data: 'private-unit-details' }] } }], usage: { prompt_tokens: 3, completion_tokens: 256 } };
  await assert.rejects(client.testConnection(), error => /output limit.*not verified/.test(error.message) && !error.message.includes('private-unit'));
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal('reasoning' in JSON.parse(options.body), false);
    return response(next);
  });
  const incomplete = await client.callModel({ history });
  assert.equal(incomplete.status, 'incomplete');
  assert.equal(incomplete.text, '');
  assert.equal(incomplete.usage.output, 256);
  assert.deepEqual(incomplete.items[0].reasoning_details, next.choices[0].message.reasoning_details);
});

test('transport unit: keys stay private, blank retains only the same endpoint', async t => {
  const client = await provider();
  assert.equal(JSON.stringify(client.getPublicConfig()).includes(KEY), false);
  assert.equal(client.getPublicConfig().keyPresent, true);
  client.configureProvider({ apiKey: '', baseUrl: BASE + '/' });
  assert.throws(() => client.configureProvider({ baseUrl: 'https://different.invalid/v1' }), /new API key/);
  assert.throws(() => client.configureProvider({ baseUrl: 'http://public.invalid' }), /HTTPS/);
  assert.throws(() => client.configureProvider({ baseUrl: 'https://user:secret@transport.invalid' }), /credentials/);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    return new Response(JSON.stringify({ error: { message: `Rejected ${KEY}` } }), { status: 401 });
  });
  await assert.rejects(client.callModel({ history }), error => error.message.includes('[redacted]') && !error.message.includes(KEY));
});

test('transport unit: malformed or failed HTTP 200 bodies are rejected', async t => {
  const client = await provider();
  let next;
  t.mock.method(globalThis, 'fetch', async () => next);
  for (const body of [{}, { output: [] }, { status: 'failed', error: { message: 'Unit failure' } }, { output: [{ type: 'function_call', name: 'list_files' }] }]) {
    next = response(body);
    await assert.rejects(client.callModel({ history }));
  }
  next = new Response('not JSON');
  await assert.rejects(client.callModel({ history }), /non-JSON/);
  next = response({});
  await assert.rejects(client.testConnection(), /no model output/);
  client.configureProvider({ protocol: 'chat-completions' });
  for (const body of [{}, { choices: [{ message: { role: 'assistant', content: null } }] }]) {
    next = response(body);
    await assert.rejects(client.callModel({ history }), /message/);
  }
});

test('transport unit: both protocols reject malformed and duplicate tool calls before continuation', async t => {
  for (const protocol of ['responses', 'chat-completions']) {
    await t.test(protocol, async () => {
      const client = await provider(protocol);
      const valid = { id: 'valid-call', name: 'list_files', arguments: '{}' };
      const envelope = calls => protocol === 'responses'
        ? { status: 'completed', output: calls.map(({ id, name, arguments: args }) => ({ type: 'function_call', call_id: id, name, arguments: args })) }
        : { choices: [{ finish_reason: 'tool_calls', message: { role: 'assistant', content: null, tool_calls: calls.map(({ id, name, arguments: args }) => ({ id, type: 'function', function: { name, arguments: args } })) } }] };
      let next;
      const fetchMock = t.mock.method(globalThis, 'fetch', async () => response(next));
      const malformed = [
        { id: undefined }, { id: null }, { id: 1 }, { id: '' }, { id: '   ' },
        { name: undefined }, { name: null }, { name: 1 }, { name: '' }, { name: '   ' },
        { arguments: undefined }, { arguments: null }, { arguments: {} }, { arguments: '' }, { arguments: '   ' }
      ];
      for (const fields of malformed) {
        next = envelope([{ ...valid, ...fields }]);
        await assert.rejects(client.callModel({ history }), /malformed/);
      }
      next = envelope([valid, { ...valid, name: 'read_file' }]);
      await assert.rejects(client.callModel({ history }), /duplicate/);
      // Valid names unknown to this harness are a dispatcher error, not a
      // transport-shape error. JSON argument validation also belongs there.
      next = envelope([{ ...valid, name: 'unsupported_tool', arguments: '{invalid-json' }]);
      const result = await client.callModel({ history });
      assert.deepEqual(result.calls, [{ ...valid, name: 'unsupported_tool', arguments: '{invalid-json' }]);
      assert.equal(fetchMock.mock.callCount(), malformed.length + 2);
      t.mock.restoreAll();
    });
  }
});

test('transport unit: Chat rejects non-array and non-function tool call structures', async t => {
  const client = await provider('chat-completions');
  let calls;
  t.mock.method(globalThis, 'fetch', async () => response({ choices: [{ message: { role: 'assistant', content: 'Progress.', tool_calls: calls } }] }));
  for (const invalid of [{}, 'tool-call', [null], [{ id: 'call', type: 'function' }], [{ id: 'call', type: 'custom', function: { name: 'list_files', arguments: '{}' } }]]) {
    calls = invalid;
    await assert.rejects(client.callModel({ history }), /malformed/);
  }
});

test('transport unit: pinned endpoint, model and protocol reject changes before fetch', async t => {
  const client = await provider();
  const pinned = client.getPublicConfig();
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => { throw new Error('Must not fetch'); });
  client.configureProvider({ model: 'different-model' });
  await assert.rejects(client.callModel({ history, provider: pinned }), /pinned/);
  client.configureProvider({ model: 'unit-model', protocol: 'chat-completions' });
  await assert.rejects(client.callModel({ history, provider: pinned }), /pinned/);
  client.configureProvider({ apiKey: 'another-unit-key', baseUrl: 'http://127.0.0.1:9999/v1', protocol: 'responses' });
  await assert.rejects(client.callModel({ history, provider: pinned }), /pinned/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('transport unit: a connection test cannot verify settings changed while its request was pending', async t => {
  const changes = [
    { model: 'new-unit-model' },
    { protocol: 'chat-completions' },
    { apiKey: 'replacement-unit-credential' },
    { apiKey: 'replacement-unit-credential', baseUrl: 'https://replacement.invalid/v1' }
  ];
  for (const change of changes) {
    const client = await provider();
    let finish;
    t.mock.method(globalThis, 'fetch', (url, options) => {
      assert.equal(url, BASE + '/responses');
      assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
      assert.equal(JSON.parse(options.body).model, 'unit-model');
      return new Promise(resolve => { finish = resolve; });
    });
    const pending = client.testConnection();
    assert.equal(typeof finish, 'function', 'The old request must already be pending');
    client.configureProvider(change);
    finish(response({ status: 'completed', output, usage: { input_tokens: 3, output_tokens: 1 } }));
    await assert.rejects(pending, /settings changed.*Test the current connection again/);
    assert.equal(JSON.stringify(client.getPublicConfig()).includes(KEY), false);
    t.mock.restoreAll();
  }
  const client = await provider();
  t.mock.method(globalThis, 'fetch', async () => response({ status: 'completed', output, usage: { input_tokens: 3, output_tokens: 1 } }));
  const verified = await client.testConnection();
  assert.equal(verified.ok, true);
  assert.equal(verified.model, 'unit-model');
  assert.equal(verified.protocol, 'responses');
  assert.deepEqual(verified.usage, { input: 3, output: 1 });
});

test('transport unit: abort propagates and missing usage is explicitly unreported', async t => {
  const client = await provider();
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Unit abort', 'AbortError')), { once: true });
  }));
  const controller = new AbortController();
  const pending = client.callModel({ history, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  t.mock.restoreAll();
  t.mock.method(globalThis, 'fetch', async () => response({ status: 'completed', output }));
  const result = await client.callModel({ history });
  assert.equal(result.usageReported, false);
  assert.deepEqual(result.usage, { input: 0, output: 0 });
});

// Rate-limit retries and request pacing are transport behavior shared by every preset.
const limited = message => new Response(JSON.stringify({ error: { message } }), { status: 429, headers: { 'retry-after': '0.01' } });
async function pacedProvider(env) {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try { return await provider(); } finally { for (const key of Object.keys(env)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } }
}
test('transport unit: HTTP 429 retries the same request and reports each retry', async t => {
  const client = await pacedProvider({ MODEL_RETRY_429: '2', MODEL_MIN_INTERVAL_MS: '0' });
  const bodies = [];
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { bodies.push(options.body); return ++calls < 3 ? limited('Unit rate limit') : response({ status: 'completed', output }); });
  const retries = [];
  const result = await client.callModel({ history, onRetry: info => { retries.push(info); } });
  assert.equal(calls, 3);
  assert.equal(result.text, 'Unit fixture.');
  assert.deepEqual(retries.map(r => [r.attempt, r.maxAttempts, r.status, r.message]), [[1, 2, 429, 'Unit rate limit'], [2, 2, 429, 'Unit rate limit']]);
  assert.ok(retries.every(r => r.waitMs === 10));
  assert.ok(bodies.every(body => body === bodies[0]), 'The retried request must be identical.');
});
test('transport unit: HTTP 429 beyond the retry budget fails with the provider message', async t => {
  const client = await pacedProvider({ MODEL_RETRY_429: '1', MODEL_MIN_INTERVAL_MS: '0' });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return limited('Still limited'); });
  await assert.rejects(client.callModel({ history }), /Model API HTTP 429: Still limited/);
  assert.equal(calls, 2);
});
test('transport unit: a connection test never retries HTTP 429', async t => {
  const client = await pacedProvider({ MODEL_RETRY_429: '3', MODEL_MIN_INTERVAL_MS: '0' });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return limited('No retry for tests'); });
  await assert.rejects(client.testConnection(), /HTTP 429/);
  assert.equal(calls, 1);
});
test('transport unit: a pause during a retry wait aborts without a second request', async t => {
  const client = await pacedProvider({ MODEL_RETRY_429: '3', MODEL_MIN_INTERVAL_MS: '0' });
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(JSON.stringify({ error: { message: 'Slow limit' } }), { status: 429, headers: { 'retry-after': '30' } }); });
  const controller = new AbortController();
  const pending = client.callModel({ history, signal: controller.signal, onRetry: () => controller.abort() });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});
test('transport unit: request pacing spaces consecutive requests equally', async t => {
  const client = await pacedProvider({ MODEL_RETRY_429: '0', MODEL_MIN_INTERVAL_MS: '150' });
  const startedAt = [];
  t.mock.method(globalThis, 'fetch', async () => { startedAt.push(Date.now()); return response({ status: 'completed', output }); });
  await client.callModel({ history });
  await client.callModel({ history });
  await client.callModel({ history });
  assert.equal(startedAt.length, 3);
  assert.ok(startedAt[1] - startedAt[0] >= 140 && startedAt[2] - startedAt[1] >= 140, `Requests started ${startedAt[1] - startedAt[0]} ms and ${startedAt[2] - startedAt[1]} ms apart; expected at least 150 ms.`);
});
