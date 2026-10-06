import { strengthChecklist } from '../../shared/engine';
import { BEAT_LABELS } from '../../shared/i18n';
import type { Hook, Reel, StrongerResult } from '../../shared/types';
import { useT } from '../lib/i18n';
import { Button, Modal } from './ui';

function Timeline({ reel, hook }: { reel: Pick<Reel, 'scenes'>; hook?: Hook }) {
  const { t, lang } = useT();
  return (
    <div>
      {hook && <p className="small"><b>{t.hookText}</b> {hook.onScreenText || '—'}</p>}
      <ol className="mini-tl">
        {reel.scenes?.map((s) => <li key={s.id}><b>{t.timeRange(s.start, s.end)}</b> {BEAT_LABELS[lang][s.beat]} — {s.purpose}</li>)}
      </ol>
    </div>
  );
}

export function StrongerModal({ before, result, onApply, onClose }: { before: Reel; result: StrongerResult; onApply: () => void; onClose: () => void }) {
  const { t, lang } = useT();
  const oldHook = before.hooks?.find((h) => h.id === before.selectedHookId);
  const beforeChecks = oldHook ? strengthChecklist({ hook: oldHook, boosts: before.boosts }, lang) : [];
  const afterChecks = strengthChecklist({ hook: result.hook, boosts: [...before.boosts, ...result.improvements.map((i) => i.area)] }, lang);
  const count = (c: { ok: boolean }[]) => c.filter((x) => x.ok).length;
  return (
    <Modal
      title={t.strongerTitle}
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{t.keep}</Button><Button variant="fire" onClick={onApply}>{t.use}</Button></>}
    >
      <p className="muted">{t.checklist}: <b>{count(beforeChecks)}/7</b> → <b className="fire-text">{count(afterChecks)}/7</b> · {t.improvementsCount(result.improvements.length)}</p>
      <div className="ba">
        <div className="ba-col"><h4>{t.before}</h4><Timeline reel={before} hook={oldHook} /></div>
        <div className="ba-col ba-after"><h4>{t.after}</h4><Timeline reel={result} hook={result.hook} /></div>
      </div>
      <div className="improvements">
        {result.improvements.map((i) => (
          <article key={i.area} className="impr" data-testid="improvement">
            <h4>{i.label}</h4>
            <div className="impr-grid">
              <div><span className="tag">{t.before}</span><p>{i.before}</p></div>
              <div><span className="tag tag-fire">{t.after}</span><p>{i.after}</p></div>
            </div>
            <p className="why"><span className="tag tag-green">{t.whyStronger}</span> {i.why}</p>
          </article>
        ))}
      </div>
    </Modal>
  );
}
