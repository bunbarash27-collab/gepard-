import { BEAT_LABELS } from '../../shared/i18n';
import type { Story } from '../../shared/types';
import { useT } from '../lib/i18n';
import { Badge, Section } from './ui';

const TEMPO = { fast: 'fire', peak: 'red', pause: 'blue', steady: 'default' } as const;

export function StoryView({ story, duration }: { story: Story; duration: number }) {
  const { t, lang } = useT();
  const beat = BEAT_LABELS[lang];
  return (
    <Section id="story" step="03" title={t.storyTitle}>
      <div className="story-top">
        <div>
          <h4>{t.storyLabel}</h4>
          <p className="story-title">{story.title}</p>
          <p>{story.summary}</p>
          <p className="muted small">{story.structureNote}</p>
          {story.additions.length > 0 && <ul className="additions">{story.additions.map((a) => <li key={a}>{a}</li>)}</ul>}
        </div>
        <div>
          <h4>{t.arc}</h4>
          <p>{story.emotionalArc}</p>
          <h4>{t.pacing}</h4>
          <p>{story.pacing}</p>
        </div>
      </div>
      <div className="timeline" aria-label={t.timeline}>
        {story.beats.map((b, i) => (
          <div key={i} className={`tl tl-${b.tempo}`} style={{ flexGrow: b.end - b.start }} title={`${beat[b.beat]} ${t.timeRange(b.start, b.end)}`}>
            <b>{beat[b.beat]}</b><span>{t.timeRange(b.start, b.end)}</span>
          </div>
        ))}
      </div>
      <ol className="beats">
        {story.beats.map((b, i) => (
          <li key={i}>
            <div className="beat-head"><b>{beat[b.beat]}</b><span className="muted">{t.timeRange(b.start, b.end)}</span><Badge tone={TEMPO[b.tempo]}>{t.tempo[b.tempo]}</Badge></div>
            <p>{b.description}</p>
            <p className="muted small"><b>{t.viewerFeels}</b> {b.emotion} · <b>{t.pacingLabel}</b> {b.pacing}</p>
          </li>
        ))}
      </ol>
      <p className="muted small">{t.total(duration)}</p>
    </Section>
  );
}
