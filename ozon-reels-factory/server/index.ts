import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AIService } from './ai/AIService';
import { providerFromEnv } from './ai/providers';
import { parseOzonUrl } from './ozon';
import type { AITask } from '../shared/types';

try {
  process.loadEnvFile?.('.env');
} catch {
  // .env is optional
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT) || 3000;
const TASKS: AITask[] = ['analyze', 'angles', 'script', 'viral', 'continue', 'social'];

const ai = new AIService(providerFromEnv(process.env));
const app = express();
app.use(express.json({ limit: '8mb' }));

app.get('/api/status', (_req, res) => {
  res.json(ai.status());
});

app.post('/api/ai/:task', async (req, res) => {
  const task = req.params.task as AITask;
  if (!TASKS.includes(task)) return void res.status(404).json({ error: 'Unknown task' });
  try {
    res.json(await ai.run(task, req.body));
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: (err as Error).message });
  }
});

app.post('/api/ozon/parse', async (req, res) => {
  res.json(await parseOzonUrl(String(req.body?.url ?? '')));
});

if (isProd) {
  const dist = path.join(root, 'dist');
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`OZON AI REELS FACTORY → http://localhost:${port} (${ai.status().message})`);
});
