import type { AIMode } from '../../shared/types';

export interface JSONFormat {
  /** Short identifier of the output schema (the task name). */
  name: string;
  /** JSON Schema the response must follow (structured output). */
  schema: object;
}

export interface AIProvider {
  id: Exclude<AIMode, 'demo'>;
  model: string;
  /** Returns the raw JSON text produced by the model, constrained to `format.schema` when given. */
  completeJSON(system: string, user: string, format?: JSONFormat): Promise<string>;
}

export interface ProviderOptions {
  fetch?: typeof fetch;
  /** Total attempts for transient failures (429, 5xx, network, timeout). */
  attempts?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
    super(message);
    this.name = 'ProviderError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Removes the key from any text that may reach logs or the client. */
const redactor = (secret: string) => (text: string) => (secret ? text.split(secret).join('[REDACTED]') : text);

function errorDetail(text: string): string {
  try {
    const j = JSON.parse(text);
    const e = j?.error ?? j?.[0]?.error;
    if (e?.message) return [e.status ?? e.type ?? e.code, e.message].filter(Boolean).join(': ');
  } catch {
    // not JSON
  }
  return text.slice(0, 300);
}

function client(secret: string, opts: ProviderOptions) {
  const doFetch = opts.fetch ?? fetch;
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 1000;
  const redact = redactor(secret);

  async function once(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
    let res: Response;
    try {
      res = await doFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000) });
    } catch (err) {
      throw new ProviderError(`Network error: ${redact((err as Error).message)}`, undefined, true);
    }
    const text = await res.text();
    if (!res.ok) throw new ProviderError(`HTTP ${res.status}: ${redact(errorDetail(text))}`, res.status, RETRYABLE.has(res.status));
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError('Provider returned a non-JSON body', res.status, true);
    }
  }

  return async function postJSON(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await once(url, headers, body);
      } catch (err) {
        const e = err as ProviderError;
        if (!e.retryable || attempt >= attempts) throw e;
        console.warn(`[AI] transient error (attempt ${attempt}/${attempts}): ${e.message}`);
        await sleep(base * 2 ** (attempt - 1));
      }
    }
  };
}

/** OpenAI Chat Completions; OPENAI_BASE_URL allows any OpenAI-compatible endpoint. */
export function openAIProvider(apiKey: string, model: string, baseUrl = 'https://api.openai.com/v1', opts: ProviderOptions = {}): AIProvider {
  const postJSON = client(apiKey, opts);
  return {
    id: 'openai',
    model,
    async completeJSON(system, user, format) {
      const json = await postJSON(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { Authorization: `Bearer ${apiKey}` }, {
        model,
        response_format: format ? { type: 'json_schema', json_schema: { name: format.name, schema: format.schema, strict: false } } : { type: 'json_object' },
        temperature: 0.8,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      });
      const choice = json?.choices?.[0];
      const out = choice?.message?.content;
      if (typeof out !== 'string' || !out.trim()) throw new ProviderError(`Empty OpenAI response${choice?.finish_reason ? ` (finish_reason: ${choice.finish_reason})` : ''}`);
      return out;
    },
  };
}

/** Gemini generateContent (REST) with structured output via generationConfig.responseFormat (mimeType is an enum, not a MIME string). */
export function geminiProvider(apiKey: string, model: string, opts: ProviderOptions = {}): AIProvider {
  const postJSON = client(apiKey, opts);
  const gemini3 = /^gemini-3/.test(model);
  return {
    id: 'gemini',
    model,
    async completeJSON(system, user, format) {
      const json = await postJSON(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { 'x-goog-api-key': apiKey }, {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: {
          ...(format ? { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: format.schema } } } : { responseMimeType: 'application/json' }),
          // Gemini 3 models are tuned for the default temperature; low thinking keeps long scene lists within the timeout.
          ...(gemini3 ? { thinkingConfig: { thinkingLevel: 'LOW' } } : { temperature: 0.8 }),
        },
      });
      const cand = json?.candidates?.[0];
      const out = (cand?.content?.parts ?? []).filter((p: any) => !p.thought).map((p: any) => p.text ?? '').join('');
      if (!out.trim()) {
        const why = json?.promptFeedback?.blockReason ?? cand?.finishReason;
        throw new ProviderError(`Empty Gemini response${why ? ` (${why})` : ''}`);
      }
      if (cand?.finishReason === 'MAX_TOKENS') throw new ProviderError('Gemini response was cut off (MAX_TOKENS)', undefined, true);
      return out;
    },
  };
}

export function providerFromEnv(env: NodeJS.ProcessEnv, opts: ProviderOptions = {}): AIProvider | null {
  const pref = (env.AI_PROVIDER ?? '').toLowerCase();
  const openaiKey = env.OPENAI_API_KEY?.trim();
  const geminiKey = env.GEMINI_API_KEY?.trim();
  const openai = openaiKey ? () => openAIProvider(openaiKey, env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL, env.OPENAI_BASE_URL || undefined, opts) : null;
  const gemini = geminiKey ? () => geminiProvider(geminiKey, env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, opts) : null;
  if (pref === 'demo') return null;
  if (pref === 'gemini' && gemini) return gemini();
  if (pref === 'openai' && openai) return openai();
  return openai?.() ?? gemini?.() ?? null;
}
