// Credentials live only in this module. Public snapshots deliberately contain no key.
const PROTOCOLS = ['responses', 'chat-completions'];
function endpoint(value) {
  const url = new URL(value || 'https://api.openai.com/v1');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error('Use HTTPS, or HTTP on a loopback address.');
  if (url.username || url.password || url.search || url.hash) throw new Error('The API base URL cannot contain credentials, a query, or a fragment.');
  return url.href.replace(/\/+$/, '');
}
let config = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || '',
  baseUrl: endpoint(process.env.OPENAI_BASE_URL),
  protocol: process.env.LLM_PROTOCOL || 'responses'
};
if (!PROTOCOLS.includes(config.protocol)) config.protocol = 'responses';
const clean = (value, requestKey = config.apiKey) => String(value || '').replaceAll(requestKey || '\u0000', '[redacted]').replaceAll(config.apiKey || '\u0000', '[redacted]').slice(0, 1800);
export function getPublicConfig() {
  return { configured: !!(config.apiKey && config.model), hasKey: !!config.apiKey, keyPresent: !!config.apiKey, model: config.model, baseUrl: config.baseUrl, protocol: config.protocol };
}
export function configureProvider({ apiKey, model, baseUrl, protocol } = {}) {
  const nextBase = endpoint(baseUrl ?? config.baseUrl);
  const nextKey = typeof apiKey === 'string' ? apiKey.trim() : '';
  if (nextBase !== config.baseUrl && !nextKey) throw new Error('Enter a new API key when changing the endpoint. A retained key is never sent to a different endpoint.');
  const nextModel = String(model ?? config.model).trim();
  const nextProtocol = protocol ?? config.protocol;
  if (!PROTOCOLS.includes(nextProtocol)) throw new Error('Unknown API protocol.');
  if (nextModel.length > 200 || /[\r\n]/.test(nextModel)) throw new Error('Invalid model name.');
  if (nextKey.length > 4096 || /[\r\n]/.test(nextKey)) throw new Error('Invalid API key.');
  config = { apiKey: nextKey || config.apiKey, model: nextModel, baseUrl: nextBase, protocol: nextProtocol };
  return getPublicConfig();
}
function visibleText(items) {
  return items.filter(item => item.type === 'message' && item.role === 'assistant')
    .flatMap(item => item.content || []).filter(part => part.type === 'output_text' || part.type === 'refusal')
    .map(part => part.text || part.refusal || '').join('\n');
}
function measuredUsage(input, output) {
  const reported = typeof input === 'number' && Number.isFinite(input) && input >= 0 && typeof output === 'number' && Number.isFinite(output) && output >= 0;
  return { usage: { input: reported ? input : 0, output: reported ? output : 0 }, usageReported: reported };
}
function validateCalls(calls) {
  const ids = new Set();
  for (const call of calls) {
    if (typeof call.id !== 'string' || !call.id.trim() || typeof call.name !== 'string' || !call.name.trim() || typeof call.arguments !== 'string' || !call.arguments.trim() || ids.has(call.id)) throw new Error('The endpoint returned a malformed or duplicate tool call.');
    ids.add(call.id);
  }
  return calls;
}
const openRouterChat = provider => provider.protocol === 'chat-completions' && new URL(provider.baseUrl).hostname === 'openrouter.ai';
function privateRouterContinuation(message) {
  if (Array.isArray(message.reasoning_details) && message.reasoning_details.length) return { reasoning_details: message.reasoning_details };
  if (typeof message.reasoning === 'string' && message.reasoning.length) return { reasoning: message.reasoning };
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.length) return { reasoning_content: message.reasoning_content };
  return {};
}
export async function callModel({ instructions, history, tools = [], signal, provider, model, maxOutputTokens = 6000, connectionTest = false }) {
  const pinned = provider || getPublicConfig();
  if (!config.apiKey || !(model || pinned.model)) throw new Error('Configure an API key and model before starting a real run.');
  if (pinned.baseUrl !== config.baseUrl) throw new Error('This run is pinned to a different API endpoint. Restore that endpoint before resuming.');
  if (pinned.model !== config.model || pinned.protocol !== config.protocol) throw new Error('Restore the model and protocol pinned to this run before resuming.');
  const protocol = pinned.protocol || config.protocol;
  const routerChat = openRouterChat(pinned);
  if (!PROTOCOLS.includes(protocol)) throw new Error('Unknown API protocol.');
  const controller = new AbortController();
  const requestKey = config.apiKey;
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort(); else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(new Error('The model request timed out after 120 seconds.')), 120000);
  const body = protocol === 'responses' ? {
    model: model || pinned.model, instructions, input: history, tools, parallel_tool_calls: false, store: false, include: ['reasoning.encrypted_content'], max_output_tokens: maxOutputTokens
  } : {
    model: model || pinned.model, messages: [{ role: 'system', content: instructions }, ...history],
    ...(tools.length ? { tools: tools.map(({ type, name, description, parameters, strict }) => ({ type, function: { name, description, parameters, strict } })), parallel_tool_calls: false } : {}),
    max_tokens: maxOutputTokens,
    ...(routerChat && connectionTest ? { reasoning: { enabled: false } } : {})
  };
  try {
    const response = await fetch(`${pinned.baseUrl}/${protocol === 'responses' ? 'responses' : 'chat/completions'}`, {
      method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${requestKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal
    });
    const raw = await response.text();
    let data; try { data = JSON.parse(raw); } catch { throw new Error(`The endpoint returned non-JSON (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(`Model API HTTP ${response.status}: ${clean(data.error?.message || data.message || 'Request failed', requestKey)}`);
    if (protocol === 'responses') {
      if (data.error || ['failed', 'cancelled'].includes(data.status)) throw new Error(clean(data.error?.message || `Model response ${data.status}.`, requestKey));
      const items = Array.isArray(data.output) ? data.output : [];
      if (!items.length) throw new Error('The endpoint returned no model output items.');
      const calls = validateCalls(items.filter(item => item.type === 'function_call').map(item => ({ id: item.call_id, name: item.name, arguments: item.arguments })));
      return { items, calls,
        text: visibleText(items), ...measuredUsage(data.usage?.input_tokens, data.usage?.output_tokens),
        status: data.status, incompleteReason: data.incomplete_details?.reason || null };
    }
    const message = data.choices?.[0]?.message;
    if (!message) throw new Error('No assistant message was returned by the endpoint.');
    if (message.tool_calls != null && !Array.isArray(message.tool_calls)) throw new Error('The endpoint returned malformed tool calls.');
    const continuation = routerChat ? privateRouterContinuation(message) : {};
    const usage = measuredUsage(data.usage?.prompt_tokens, data.usage?.completion_tokens);
    const incomplete = data.choices[0].finish_reason === 'length';
    // Some reasoning models exhaust the output budget before visible text.
    // Preserve that private continuation without presenting it as an answer.
    const reasoningOnlyIncomplete = routerChat && incomplete && (Object.keys(continuation).length || usage.usageReported && usage.usage.output > 0);
    if (!message.content && !message.tool_calls?.length && !reasoningOnlyIncomplete) throw new Error('The endpoint returned an empty assistant message.');
    const calls = validateCalls((message.tool_calls || []).map(call => {
      if (call?.type !== 'function' || !call.function) throw new Error('The endpoint returned a malformed tool call.');
      return { id: call.id, name: call.function.name, arguments: call.function.arguments };
    }));
    // OpenRouter requires returned reasoning blocks unchanged for tool
    // continuation. These fields stay in private API history, never reply.text
    // or visible events. Other hosts use standard Chat Completions messages.
    const item = { role: 'assistant', content: typeof message.content === 'string' ? message.content : null, ...continuation };
    if (calls.length) item.tool_calls = calls.map(call => ({ id: call.id, type: 'function', function: { name: call.name, arguments: call.arguments } }));
    return { items: [item], calls,
      text: item.content || '', ...usage,
      status: incomplete ? 'incomplete' : 'completed', incompleteReason: incomplete ? 'max_output_tokens' : null };
  } catch (error) {
    if (signal?.aborted) throw Object.assign(new Error('Model request paused.'), { name: 'AbortError' });
    if (controller.signal.aborted) throw new Error('The model request timed out after 120 seconds.');
    throw new Error(clean(error.message, requestKey));
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
export async function testConnection() {
  const testedConfig = config;
  const provider = getPublicConfig();
  const response = await callModel({ instructions: 'Reply with OK.', history: [{ role: 'user', content: 'Connection test.' }], provider, maxOutputTokens: openRouterChat(provider) ? 256 : 32, connectionTest: true });
  if (config !== testedConfig) throw new Error('Model connection settings changed while this test was running. Test the current connection again.');
  if (!response.text.trim()) throw new Error(response.status === 'incomplete' ? 'The endpoint authenticated, but the connection test reached its output limit before returning a visible answer. The model connection is not verified; try a model that supports this small test.' : 'The connection test returned no visible answer. The model connection is not verified.');
  return { ok: true, model: provider.model, protocol: provider.protocol, usage: response.usage, message: response.status === 'incomplete' ? 'The endpoint authenticated and returned model output; this small connection test reached its output limit.' : 'The configured endpoint returned a real model response.' };
}
