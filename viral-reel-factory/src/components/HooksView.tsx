import type { Hook } from '../../shared/types';
import { Button, Section } from './ui';

const LABEL: Record<Hook['type'], string> = { curiosity: 'Curiosity Hook', shock: 'Shock Hook', emotional: 'Emotional Hook', visual: 'Visual Hook', story: 'Story Hook' };

export function HooksView({ hooks, selectedId, onSelect, busy }: { hooks: Hook[]; selectedId?: string; onSelect: (h: Hook) => void; busy: boolean }) {
  return (
    <Section id="hooks" step="02" title="HOOK ENGINE" aside={<span className="muted small">Pick the opening that builds the reel</span>}>
      <div className="hooks">
        {hooks.map((h, i) => {
          const on = h.id === selectedId;
          return (
            <article key={h.id} className={`hook ${on ? 'hook-on' : ''}`} data-testid={`hook-${h.type}`}>
              <div className="hook-type">{i + 1}. {LABEL[h.type]}</div>
              <h4>HOOK</h4>
              <p className="hook-text">{h.hook}</p>
              <h4>Why it works</h4>
              <p className="muted">{h.whyItWorks}</p>
              <p className="hook-shot"><b>First 2 sec:</b> {h.openingShot}</p>
              <Button variant={on ? 'primary' : 'soft'} onClick={() => onSelect(h)} disabled={busy}>{on ? '✓ SELECTED' : 'SELECT'}</Button>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
