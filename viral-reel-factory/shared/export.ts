import { BEAT_LABELS, UI } from './i18n';
import { promptsFor } from './prompts';
import type { Lang, Reel } from './types';
import { pad2 } from './util';

/** COPY ALL text: headings and narrative in the UI language, prompts in the chosen prompt language. */
export function reelToText(reel: Reel, promptLanguage: Lang = reel.settings.promptLanguage): string {
  const lang = reel.settings.language;
  const t = UI[lang];
  const e = t.export;
  const hook = reel.hooks?.find((h) => h.id === reel.selectedHookId);
  const lines: string[] = [
    'VIRAL REEL FACTORY',
    `${e.idea}: ${reel.idea}`,
    `${e.format}: ${reel.settings.format} · ${t.sec(reel.settings.duration)} · ${t.styles[reel.settings.style]}`,
    '',
    `## ${e.concept}`,
    reel.analysis?.concept ?? '',
    '',
    `## ${e.hook}`,
    hook ? `${hook.hook}\n${e.why}: ${hook.whyItWorks}` : '',
    '',
    `## ${e.story}`,
    reel.story ? `${reel.story.summary}\n${e.arc}: ${reel.story.emotionalArc}\n${e.pacing}: ${reel.story.pacing}` : '',
    '',
    `## ${e.scenes}`,
  ];
  const f = t.sceneFields;
  reel.scenes?.forEach((s, i) => {
    const p = promptsFor(s, promptLanguage);
    lines.push(
      '',
      `### ${t.sceneN(pad2(i + 1))} — ${BEAT_LABELS[lang][s.beat]} (${t.timeRange(s.start, s.end)})`,
      `${f.purpose}: ${s.purpose}`,
      `${f.visual}: ${s.visual}`,
      `${f.action}: ${s.action}`,
      `${f.camera}: ${s.camera}`,
      `${f.lighting}: ${s.lighting}`,
      `${f.sound}: ${s.sound}`,
      `${f.onScreenText}: ${s.onScreenText}`,
      `${e.voiceover}: ${s.voiceover}`,
      '',
      `${t.imagePrompt}:`,
      p.image,
      '',
      `${t.videoPrompt}:`,
      p.video,
    );
  });
  return lines.join('\n');
}
