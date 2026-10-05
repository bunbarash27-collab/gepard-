import type { Reel } from './types';
import { pad2, timeRange } from './util';

export function reelToText(reel: Reel): string {
  const hook = reel.hooks?.find((h) => h.id === reel.selectedHookId);
  const lines: string[] = [
    'VIRAL REEL FACTORY',
    `Idea: ${reel.idea}`,
    `Format: ${reel.settings.format} · ${reel.settings.duration} sec · ${reel.settings.style}`,
    '',
    '## REEL CONCEPT',
    reel.analysis?.concept ?? '',
    '',
    '## SELECTED HOOK',
    hook ? `${hook.hook}\nWhy it works: ${hook.whyItWorks}` : '',
    '',
    '## STORY',
    reel.story ? `${reel.story.summary}\nEmotional arc: ${reel.story.emotionalArc}\nPacing: ${reel.story.pacing}` : '',
    '',
    '## SCENES',
  ];
  reel.scenes?.forEach((s, i) => {
    lines.push(
      '',
      `### SCENE ${pad2(i + 1)} — ${s.beat} (${timeRange(s.start, s.end)})`,
      `Purpose: ${s.purpose}`,
      `Visual: ${s.visual}`,
      `Action: ${s.action}`,
      `Camera: ${s.camera}`,
      `Lighting: ${s.lighting}`,
      `Sound: ${s.sound}`,
      `On-screen text: ${s.onScreenText}`,
      `Voiceover: ${s.voiceover}`,
      '',
      'IMAGE PROMPT:',
      s.imagePrompt,
      '',
      'VIDEO PROMPT:',
      s.videoPrompt,
    );
  });
  return lines.join('\n');
}
