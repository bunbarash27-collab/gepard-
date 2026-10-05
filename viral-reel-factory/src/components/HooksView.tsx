import type { Hook } from '../../shared/types';
import { useT } from '../lib/i18n';
import { Button, Section } from './ui';

export function HooksView({ hooks, selectedId, onSelect, busy }: { hooks: Hook[]; selectedId?: string; onSelect: (h: Hook) => void; busy: boolean }) {
  const { t } = useT();
  return (
    <Section id="hooks" step="02" title={t.hooksTitle} aside={<span className="muted small">{t.hooksHint}</span>}>
      <div className="hooks">
        {hooks.map((h, i) => {
          const on = h.id === selectedId;
          return (
            <article key={h.id} className={`hook ${on ? 'hook-on' : ''}`} data-testid={`hook-${h.type}`}>
              <div className="hook-type">{i + 1}. {t.hookTypes[h.type]}</div>
              <h4>{t.hookLabel}</h4>
              <p className="hook-text">{h.hook}</p>
              <h4>{t.why}</h4>
              <p className="muted">{h.whyItWorks}</p>
              <p className="hook-shot"><b>{t.firstSec}</b> {h.openingShot}</p>
              <Button variant={on ? 'primary' : 'soft'} onClick={() => onSelect(h)} disabled={busy}>{on ? t.selected : t.select}</Button>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
