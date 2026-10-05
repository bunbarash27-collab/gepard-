import { DURATIONS, STYLES } from '../../shared/options';
import type { ReelSettings } from '../../shared/types';
import { useT } from '../lib/i18n';
import { Button, Chips } from './ui';

export interface Draft { idea: string; settings: ReelSettings }

export function IdeaForm({ draft, onChange, onCreate, busy, onDemo }: { draft: Draft; onChange: (d: Draft) => void; onCreate: () => void; busy: boolean; onDemo: () => void }) {
  const { t } = useT();
  const set = (patch: Partial<ReelSettings>) => onChange({ ...draft, settings: { ...draft.settings, ...patch } });
  return (
    <section id="idea" className="hero">
      <div className="hero-glow" aria-hidden />
      <h1>VIRAL REEL FACTORY</h1>
      <p className="hero-sub">{t.subtitle}</p>
      <form className="idea-card" onSubmit={(e) => { e.preventDefault(); if (!busy) onCreate(); }}>
        <label className="idea-label" htmlFor="idea-input">{t.ideaLabel}</label>
        <textarea
          id="idea-input"
          className="idea-input"
          rows={4}
          maxLength={2000}
          placeholder={t.ideaPlaceholder}
          value={draft.idea}
          onChange={(e) => onChange({ ...draft, idea: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !busy) onCreate(); }}
        />
        <div className="settings">
          <div className="setting"><span>{t.duration}</span><Chips label={t.duration} options={DURATIONS.map((id) => ({ id, label: t.sec(id) }))} value={draft.settings.duration} onChange={(duration) => set({ duration })} disabled={busy} /></div>
          <div className="setting"><span>{t.format}</span><Chips label={t.format} options={[{ id: '9:16' as const, label: '9:16' }]} value={draft.settings.format} onChange={() => {}} disabled={busy} /></div>
          <div className="setting"><span>{t.style}</span><Chips label={t.style} options={STYLES.map((id) => ({ id, label: t.styles[id] }))} value={draft.settings.style} onChange={(style) => set({ style })} disabled={busy} /></div>
        </div>
        <div className="idea-actions">
          <Button type="button" variant="ghost" onClick={onDemo} disabled={busy}>{t.openDemo}</Button>
          <Button type="submit" variant="fire" size="lg" loading={busy}>{t.create}</Button>
        </div>
      </form>
    </section>
  );
}
