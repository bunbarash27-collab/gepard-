import type { Story } from '../../shared/types';
import { fmtSec } from '../../shared/util';
import { Badge, Section } from './ui';

const TEMPO = { fast: 'fire', peak: 'red', pause: 'blue', steady: 'default' } as const;

export function StoryView({ story, duration }: { story: Story; duration: number }) {
  return (
    <Section id="story" step="03" title="STORY ENGINE">
      <div className="story-top">
        <div>
          <h4>STORY</h4>
          <p className="story-title">{story.title}</p>
          <p>{story.summary}</p>
          <p className="muted small">{story.structureNote}</p>
          {story.additions.length > 0 && <ul className="additions">{story.additions.map((a) => <li key={a}>{a}</li>)}</ul>}
        </div>
        <div>
          <h4>EMOTIONAL ARC</h4>
          <p>{story.emotionalArc}</p>
          <h4>PACING</h4>
          <p>{story.pacing}</p>
        </div>
      </div>
      <div className="timeline" aria-label="Beat timeline">
        {story.beats.map((b, i) => (
          <div key={i} className={`tl tl-${b.tempo}`} style={{ flexGrow: b.end - b.start }} title={`${b.beat} ${fmtSec(b.start)}–${fmtSec(b.end)}s`}>
            <b>{b.beat}</b><span>{fmtSec(b.start)}–{fmtSec(b.end)}s</span>
          </div>
        ))}
      </div>
      <ol className="beats">
        {story.beats.map((b, i) => (
          <li key={i}>
            <div className="beat-head"><b>{b.beat}</b><span className="muted">{fmtSec(b.start)}–{fmtSec(b.end)} sec</span><Badge tone={TEMPO[b.tempo]}>{b.tempo}</Badge></div>
            <p>{b.description}</p>
            <p className="muted small"><b>Viewer feels:</b> {b.emotion} · <b>Pacing:</b> {b.pacing}</p>
          </li>
        ))}
      </ol>
      <p className="muted small">Total: {duration} sec</p>
    </Section>
  );
}
