import { ANGLE_META, STATUS_LABEL, STYLES } from './options';
import { buildProductLock, buildVoiceover, PLATFORM_LABEL } from './engine';
import type { Project } from './types';
import { fmtSec, timeline, totalDuration } from './util';

/** Structured project export, shaped to be fed to external image/video APIs later. */
export function projectToJSON(p: Project) {
  const angle = p.angles?.find((a) => a.id === p.selectedAngleId);
  const times = timeline(p.scenes);
  const vo = buildVoiceover(p.scenes, p.voice);
  return {
    schema: 'ozon-ai-reels-factory/v1',
    exported_at: new Date().toISOString(),
    status: p.status,
    product: {
      name: p.product.name,
      category: p.product.category,
      price: p.product.price,
      ozon_url: p.product.ozonUrl || null,
      specs: p.product.specs,
      benefits: p.product.benefits,
      restrictions: p.product.restrictions,
      has_reference_image: Boolean(p.product.imageDataUrl),
      product_lock: buildProductLock(p.product).clause,
    },
    audience: p.analysis?.audience ?? p.product.audience,
    analysis: p.analysis ?? null,
    concept: angle ? { type: angle.type, title: angle.title, idea: angle.idea, emotion: angle.emotion } : null,
    hook: angle?.hook ?? p.scenes[0]?.onScreenText ?? null,
    settings: { ...p.settings, total_duration: totalDuration(p.scenes) },
    scenes: p.scenes.map((s, i) => ({
      index: i + 1,
      goal: s.goal,
      start: times[i].start,
      end: times[i].end,
      duration: s.duration,
      action: s.action,
      on_screen_text: s.onScreenText,
      voiceover: s.voiceover,
      camera: s.camera,
      lighting: s.lighting,
      sound: s.sound,
      image_prompt: s.imagePrompt,
      video_prompt: s.videoPrompt,
    })),
    voiceover: { text: vo.text, direction: vo.direction, ...p.voice },
    image_prompts: p.scenes.map((s) => s.imagePrompt),
    video_prompts: p.scenes.map((s) => s.videoPrompt),
    caption: p.social?.caption ?? null,
    hashtags: p.social?.hashtags ?? [],
    keywords: p.social?.keywords ?? [],
    cta: p.social?.cta ?? p.settings.cta,
    caption_variations: p.social?.variations ?? [],
  };
}

function header(p: Project) {
  const angle = p.angles?.find((a) => a.id === p.selectedAngleId);
  const style = STYLES.find((s) => s.id === p.settings.style)?.label;
  return {
    angle,
    meta: `Концепция: ${angle ? `${ANGLE_META[angle.type].label} — ${angle.title}` : '—'}\nФормат: ${p.settings.format} · ${totalDuration(p.scenes)} сек · ${PLATFORM_LABEL[p.settings.platform]} · ${style}\nCTA: ${p.settings.cta}\nСтатус: ${STATUS_LABEL[p.status]}`,
  };
}

export function projectToMarkdown(p: Project): string {
  const { angle, meta } = header(p);
  const times = timeline(p.scenes);
  const vo = buildVoiceover(p.scenes, p.voice);
  const out: string[] = [`# ${p.product.name} — OZON AI REELS FACTORY`, '', meta.split('\n').map((l) => `- ${l}`).join('\n'), ''];
  if (p.analysis) {
    const a = p.analysis;
    out.push('## Анализ товара', '', `- **Аудитория:** ${a.audience}`, `- **Проблема:** ${a.pain}`, `- **Желание:** ${a.desire}`, `- **Главное преимущество:** ${a.mainBenefit}`, `- **Selling point:** ${a.sellingPoint}`, `- **Возражения:** ${a.objections.join('; ')}`, `- **Причины купить сейчас:** ${a.reasonsNow.join('; ')}`, '', '### Рекламные ограничения', '', ...a.rules.map((r) => `- ${r}`), '');
  }
  if (angle) out.push('## Концепция', '', `**${angle.title}** (${ANGLE_META[angle.type].label})`, '', `- Hook: ${angle.hook}`, `- Идея: ${angle.idea}`, '');
  out.push('## Сценарий', '');
  p.scenes.forEach((s, i) => {
    out.push(
      `### SCENE ${String(i + 1).padStart(2, '0')} · ${s.goal} · ${fmtSec(times[i].start)}–${fmtSec(times[i].end)} сек`, '',
      `- **Что происходит:** ${s.action}`, `- **Текст на экране:** ${s.onScreenText}`, `- **Voiceover:** ${s.voiceover}`,
      `- **Camera:** ${s.camera}`, `- **Lighting:** ${s.lighting}`, `- **Sound:** ${s.sound}`, '',
      '**IMAGE PROMPT**', '', '```', s.imagePrompt, '```', '', '**VIDEO PROMPT**', '', '```', s.videoPrompt, '```', '',
    );
  });
  out.push('## Voiceover', '', `_${vo.direction}_`, '', vo.text, '');
  if (p.social) {
    out.push('## Social package', '', '### Caption', '', p.social.caption, '', `**Hook:** ${p.social.hook}`, '', `**CTA:** ${p.social.cta}`, '', `**Hashtags:** ${p.social.hashtags.join(' ')}`, '', `**Keywords:** ${p.social.keywords.join(', ')}`, '');
    for (const v of p.social.variations) out.push(`### Вариант ${v.id} — ${v.label}`, '', v.caption, '');
  }
  return out.join('\n');
}

export function projectToText(p: Project): string {
  return projectToMarkdown(p)
    .replace(/^```$/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#+ /gm, '')
    .replace(/^_(.+)_$/gm, '$1')
    .replace(/\n{3,}/g, '\n\n');
}
