import type { AIMode } from '../../shared/types';

export interface AIProvider {
  id: Exclude<AIMode, 'demo'>;
  model: string;
  /** Returns the raw JSON text produced by the model. */
  completeJSON(system: string, user: string, imageDataUrl?: string): Promise<string>;
}

const TIMEOUT_MS = 90_000;

async function postJSON(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
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

export function geminiProvider(apiKey: string, model: string): AIProvider {
  return {
    id: 'gemini',
    model,
    async completeJSON(system, user, image) {
      const parts: any[] = [{ text: user }];
      const m = image?.match(/^data:(image\/[\w.+-]+);base64,(.+)$/);
      if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
      const json = await postJSON(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        { 'x-goog-api-key': apiKey },
        {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8 },
        },
      );
      const out = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('');
      if (!out) throw new Error('Пустой ответ Gemini');
      return out;
    },
  };
}

export function providerFromEnv(env: NodeJS.ProcessEnv): AIProvider | null {
  const pref = (env.AI_PROVIDER ?? '').toLowerCase();
  const openai = env.OPENAI_API_KEY ? () => openAIProvider(env.OPENAI_API_KEY!, env.OPENAI_MODEL || 'gpt-4o-mini', env.OPENAI_BASE_URL || undefined) : null;
  const gemini = env.GEMINI_API_KEY ? () => geminiProvider(env.GEMINI_API_KEY!, env.GEMINI_MODEL || 'gemini-2.5-flash') : null;
  if (pref === 'demo') return null;
  if (pref === 'gemini' && gemini) return gemini();
  if (pref === 'openai' && openai) return openai();
  return openai?.() ?? gemini?.() ?? null;
}
