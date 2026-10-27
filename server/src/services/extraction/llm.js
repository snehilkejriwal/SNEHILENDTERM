import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const TIMEOUT_MS = 45000;

async function postJSON(url, headers, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.error?.message || `status ${res.status}`;
      throw new AppError(502, `The document reader is unavailable right now (${msg}). Enter the facts by hand to continue.`);
    }
    return data;
  } catch (err) {
    if (err instanceof AppError) throw err;
    const reason = err.name === 'AbortError' ? 'it took too long' : 'a network error';
    throw new AppError(502, `The document reader failed because of ${reason}. Enter the facts by hand to continue.`);
  } finally {
    clearTimeout(timer);
  }
}

// Returns the model's raw text. Provider is chosen by LLM_PROVIDER.
export async function complete(system, user) {
  if (env.LLM_PROVIDER === 'openrouter') {
    if (!env.OPENROUTER_API_KEY) throw new AppError(503, 'Document reading is not configured. Enter the facts by hand.');
    // OpenRouter speaks the OpenAI chat format and routes to the model named in OPENROUTER_MODEL.
    const data = await postJSON('https://openrouter.ai/api/v1/chat/completions', { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, 'X-Title': 'SettleWise' }, {
      model: env.OPENROUTER_MODEL,
      temperature: 0,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    return data?.choices?.[0]?.message?.content || '';
  }
  if (env.LLM_PROVIDER === 'gemini') {
    if (!env.GEMINI_API_KEY) throw new AppError(503, 'Document reading is not configured. Enter the facts by hand.');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;
    const data = await postJSON(url, { 'x-goog-api-key': env.GEMINI_API_KEY }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    });
    return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  }
  if (env.LLM_PROVIDER === 'anthropic') {
    if (!env.ANTHROPIC_API_KEY) throw new AppError(503, 'Document reading is not configured. Enter the facts by hand.');
    const data = await postJSON('https://api.anthropic.com/v1/messages', { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }, {
      model: env.ANTHROPIC_MODEL,
      max_tokens: 2000,
      temperature: 0,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  throw new AppError(503, 'Document reading is switched off. Enter the facts by hand.');
}
