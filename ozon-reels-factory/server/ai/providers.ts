import type { AIMode } from '../../shared/types';

export interface AIProvider {
  id: Exclude<AIMode, 'demo'>;
  model: string;
  /** Returns the raw JSON text produced by the model. */
  completeJSON(system: string, user: string, imageDataUrl?: string): Promise<string>;
}

const TIMEOUT_MS = 90_000;
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [1500, 4000];

export class HTTPError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function postJSON(url: string, headers: Record<string, string>, body: unknown, retryDelays = RETRY_DELAYS_MS): Promise<any> {
  // Providers regularly return transient overload/rate-limit errors; retry with backoff before giving up.
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    if (res.ok) return JSON.parse(text);
    if (!RETRY_STATUSES.has(res.status) || attempt >= retryDelays.length) {
      const msg = (() => { try { return JSON.parse(text)?.error?.message; } catch { return undefined; } })();
      throw new HTTPError(res.status, `HTTP ${res.status}: ${(msg ?? text).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, retryDelays[attempt]));
  }
}

/** OpenAI Chat Completions; OPENAI_BASE_URL allows any OpenAI-compatible endpoint. */
export function openAIProvider(apiKey: string, model: string, baseUrl = 'https://api.openai.com/v1'): AIProvider {
  return {
    id: 'openai',
    model,
    async completeJSON(system, user, image) {
      const content = image
        ? [{ type: 'text', text: user }, { type: 'image_url', image_url: { url: image } }]
        : user;
      const json = await postJSON(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { Authorization: `Bearer ${apiKey}` }, {
        model,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content }],
      });
      const out = json?.choices?.[0]?.message?.content;
      if (typeof out !== 'string') throw new Error('Пустой ответ OpenAI');
      return out;
    },
  };
}

/** `models[0]` is primary; the rest are tried in order when a model is overloaded or unavailable. */
export function geminiProvider(apiKey: string, models: string[]): AIProvider {
  return {
    id: 'gemini',
    model: models[0],
    async completeJSON(system, user, image) {
      const parts: any[] = [{ text: user }];
      const m = image?.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
      const body = {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
      };
      let lastError: unknown;
      for (const [i, model] of models.entries()) {
        try {
          const json = await postJSON(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            { 'x-goog-api-key': apiKey },
            body,
            // Skip long backoff on the primary when a fallback exists: switching models is faster.
            i < models.length - 1 ? [1500] : RETRY_DELAYS_MS,
          );
          const out = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('');
          if (!out) throw new Error('Пустой ответ Gemini');
          return out;
        } catch (err) {
          lastError = err;
          const fallbackable = err instanceof HTTPError && (RETRY_STATUSES.has(err.status) || err.status === 404);
          if (!fallbackable) throw err;
          console.warn(`[gemini] ${model} failed (${err.message.slice(0, 80)}), trying next model`);
        }
      }
      throw lastError;
    },
  };
}

export function providerFromEnv(env: NodeJS.ProcessEnv): AIProvider | null {
  const pref = (env.AI_PROVIDER ?? '').toLowerCase();
  const openai = env.OPENAI_API_KEY ? () => openAIProvider(env.OPENAI_API_KEY!, env.OPENAI_MODEL || 'gpt-4o-mini', env.OPENAI_BASE_URL || undefined) : null;
  const geminiModels = [env.GEMINI_MODEL || 'gemini-3.8-flash', ...(env.GEMINI_FALLBACK_MODELS ?? 'gemini-3.6-flash,gemini-3.5-flash').split(',')]
    .map((s) => s.trim())
    .filter((s, i, a) => s && a.indexOf(s) === i);
  const gemini = env.GEMINI_API_KEY ? () => geminiProvider(env.GEMINI_API_KEY!, geminiModels) : null;
  if (pref === 'demo') return null;
  if (pref === 'gemini' && gemini) return gemini();
  if (pref === 'openai' && openai) return openai();
  return openai?.() ?? gemini?.() ?? null;
}
