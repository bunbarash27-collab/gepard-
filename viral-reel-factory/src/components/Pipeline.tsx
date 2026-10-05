import type { Reel } from '../../shared/types';
import type { Stage } from '../App';

const STEPS = [
  { key: 'idea', label: 'IDEA', target: 'idea', stages: ['analyze'] },
  { key: 'hook', label: 'HOOK', target: 'hooks', stages: ['hooks'] },
  { key: 'story', label: 'STORY', target: 'story', stages: ['story'] },
  { key: 'scenes', label: 'SCENES', target: 'scenes', stages: ['scenes', 'stronger'] },
  { key: 'prompts', label: 'PROMPTS', target: 'scenes', stages: ['image', 'video'] },
] as const;

export function Pipeline({ reel, stage }: { reel: Reel; stage: Stage | null }) {
  const done: Record<string, boolean> = {
    idea: Boolean(reel.analysis),
    hook: Boolean(reel.selectedHookId),
    story: Boolean(reel.story),
    scenes: Boolean(reel.scenes?.length),
    prompts: Boolean(reel.scenes?.length && reel.scenes.every((s) => s.imagePrompt && s.videoPrompt)),
  };
  return (
    <nav className="pipeline" aria-label="Workflow">
      {STEPS.map((s, i) => {
        const active = stage !== null && (s.stages as readonly string[]).includes(stage);
        return (
          <a key={s.key} href={`#${s.target}`} className={`pipe ${done[s.key] ? 'pipe-done' : ''} ${active ? 'pipe-active' : ''}`} data-testid={`pipe-${s.key}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            <span className="pipe-dot">{active ? <span className="spinner" /> : done[s.key] ? '✓' : i + 1}</span>
            {s.label}
          </a>
        );
      })}
    </nav>
  );
}
