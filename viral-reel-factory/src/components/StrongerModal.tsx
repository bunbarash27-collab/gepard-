import { strengthChecklist } from '../../shared/engine';
import type { Hook, Reel, StrongerResult } from '../../shared/types';
import { fmtSec } from '../../shared/util';
import { Button, Modal } from './ui';

function Timeline({ reel, hook }: { reel: Pick<Reel, 'scenes'>; hook?: Hook }) {
  return (
    <div>
      {hook && <p className="small"><b>Hook text:</b> {hook.onScreenText || '—'}</p>}
      <ol className="mini-tl">
        {reel.scenes?.map((s) => <li key={s.id}><b>{fmtSec(s.start)}–{fmtSec(s.end)}s</b> {s.beat} — {s.purpose}</li>)}
      </ol>
    </div>
  );
}

export function StrongerModal({ before, result, onApply, onClose }: { before: Reel; result: StrongerResult; onApply: () => void; onClose: () => void }) {
  const oldHook = before.hooks?.find((h) => h.id === before.selectedHookId);
  const beforeChecks = oldHook ? strengthChecklist({ hook: oldHook, boosts: before.boosts }) : [];
  const afterChecks = strengthChecklist({ hook: result.hook, boosts: [...before.boosts, ...result.improvements.map((i) => i.area)] });
  const count = (c: { ok: boolean }[]) => c.filter((x) => x.ok).length;
  return (
    <Modal
      title="🔥 MAKE IT STRONGER"
      onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Keep current version</Button><Button variant="fire" onClick={onApply}>Use stronger version</Button></>}
    >
      <p className="muted">Strength checklist: <b>{count(beforeChecks)}/7</b> → <b className="fire-text">{count(afterChecks)}/7</b> · {result.improvements.length} improvements</p>
      <div className="ba">
        <div className="ba-col"><h4>BEFORE</h4><Timeline reel={before} hook={oldHook} /></div>
        <div className="ba-col ba-after"><h4>AFTER</h4><Timeline reel={result} hook={result.hook} /></div>
      </div>
      <div className="improvements">
        {result.improvements.map((i) => (
          <article key={i.area} className="impr" data-testid="improvement">
            <h4>{i.label}</h4>
            <div className="impr-grid">
              <div><span className="tag">BEFORE</span><p>{i.before}</p></div>
              <div><span className="tag tag-fire">AFTER</span><p>{i.after}</p></div>
            </div>
            <p className="why"><span className="tag tag-green">WHY IT IS STRONGER</span> {i.why}</p>
          </article>
        ))}
      </div>
    </Modal>
  );
}
