import type { Stage } from '../../shared/i18n';
import type { Reel } from '../../shared/types';
import { useT } from '../lib/i18n';

const STEPS = [
  { key: 'idea', target: 'idea', stages: ['analyze'] },
  { key: 'hook', target: 'hooks', stages: ['hooks'] },
  { key: 'story', target: 'story', stages: ['story'] },
  { key: 'scenes', target: 'scenes', stages: ['scenes', 'stronger', 'translate'] },
  { key: 'prompts', target: 'scenes', stages: ['image', 'video', 'prompts'] },
] as const;

export function Pipeline({ reel, stage }: { reel: Reel; stage: Stage | null }) {
  const { t } = useT();
  const done: Record<string, boolean> = {
    idea: Boolean(reel.analysis),
    hook: Boolean(reel.selectedHookId),
    story: Boolean(reel.story),
    scenes: Boolean(reel.scenes?.length),
    prompts: Boolean(reel.scenes?.length && reel.scenes.every((s) => s.imagePrompt && s.videoPrompt)),
  };
  return (
    <nav className="pipeline" aria-label={t.workflow}>
      {STEPS.map((s, i) => {
        const active = stage !== null && (s.stages as readonly string[]).includes(stage);
        return (
          <a key={s.key} href={`#${s.target}`} className={`pipe ${done[s.key] ? 'pipe-done' : ''} ${active ? 'pipe-active' : ''}`} data-testid={`pipe-${s.key}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <span className="pipe-dot">{active ? <span className="spinner" /> : done[s.key] ? '✓' : i + 1}</span>
            {t.pipeline[s.key]}
          </a>
        );
      })}
    </nav>
  );
}
