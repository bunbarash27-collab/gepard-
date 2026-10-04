import { analyzeProduct, generateAngles, generateScript, generateSocial } from './engine';
import { DEFAULT_VOICE, newProject } from './project';
import type { GeneratorSettings, Project, ProductInput } from './types';

const DEMO_IMAGE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480" viewBox="0 0 480 480">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1b2550"/><stop offset="1" stop-color="#0b1026"/></linearGradient>
<linearGradient id="box" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e8ecf5"/></linearGradient></defs>
<rect width="480" height="480" fill="url(#bg)"/>
<circle cx="380" cy="90" r="34" fill="#ffd98a" opacity=".9"/><circle cx="394" cy="80" r="30" fill="#1b2550"/>
<rect x="130" y="110" width="220" height="280" rx="14" fill="url(#box)"/>
<path d="M240 170a42 42 0 1 0 36 64a34 34 0 1 1 -36 -64z" fill="#1f3a8a"/>
<text x="240" y="300" font-family="Arial, sans-serif" font-size="30" font-weight="700" fill="#1f3a8a" text-anchor="middle">Тихая ночь</text>
<text x="240" y="330" font-family="Arial, sans-serif" font-size="15" fill="#5a6a9a" text-anchor="middle">средство от храпа</text>
<rect x="160" y="352" width="160" height="18" rx="9" fill="#1f3a8a" opacity=".12"/>
</svg>`;

export const DEMO_PRODUCT: ProductInput = {
  ozonUrl: '',
  imageDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(DEMO_IMAGE_SVG)}`,
  name: 'Средство от храпа «Тихая ночь»',
  category: 'Товары для сна',
  price: '890',
  specs: 'Мягкая силиконовая клипса для носа\nКомплект: 4 размера и футляр для хранения\nМожно мыть тёплой водой\nВес — 3 г',
  benefits: 'Удобно носить всю ночь\nПочти незаметна во время сна\nКомпактный футляр — удобно брать в поездки\nИзбавляет от храпа на 100% с первой ночи',
  audience: '',
  restrictions: 'Не называть лекарством\nНе обещать лечение апноэ',
  appearance: 'прозрачная мягкая клипса в белом пластиковом футляре; белая картонная коробка с тёмно-синей надписью «Тихая ночь» и рисунком полумесяца',
};

export const DEMO_SETTINGS: GeneratorSettings = { format: '9:16', duration: 30, platform: 'reels', style: 'cinematic', cta: 'Смотреть товар' };

/** Fully generated example project shown on first launch. */
export function buildDemoProject(): Project {
  const p = newProject(DEMO_PRODUCT);
  const analysis = analyzeProduct(DEMO_PRODUCT);
  const angles = generateAngles(DEMO_PRODUCT, analysis);
  const angle = angles[0];
  const ctx = { product: DEMO_PRODUCT, analysis, angle, settings: DEMO_SETTINGS };
  return {
    ...p,
    id: 'demo',
    isDemo: true,
    status: 'ready',
    analysis,
    angles,
    selectedAngleId: angle.id,
    scriptAngleId: angle.id,
    settings: DEMO_SETTINGS,
    scenes: generateScript(ctx),
    voice: { ...DEFAULT_VOICE, tone: 'calm' },
    social: generateSocial(ctx),
    generatedBy: 'demo',
  };
}
