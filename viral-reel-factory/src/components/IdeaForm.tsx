import { DURATIONS, STYLES } from '../../shared/options';
import type { ReelSettings } from '../../shared/types';
import { Button, Chips } from './ui';

export interface Draft { idea: string; settings: ReelSettings }

export function IdeaForm({ draft, onChange, onCreate, busy, onDemo }: { draft: Draft; onChange: (d: Draft) => void; onCreate: () => void; busy: boolean; onDemo: () => void }) {
  const set = (patch: Partial<ReelSettings>) => onChange({ ...draft, settings: { ...draft.settings, ...patch } });
  const empty = !draft.idea.trim();
  return (
    <section id="idea" className="hero">
      <div className="hero-glow" aria-hidden />
      <h1>VIRAL REEL FACTORY</h1>
      <p className="hero-sub">Turn an idea into a cinematic short video.</p>
      <form className="idea-card" onSubmit={(e) => { e.preventDefault(); if (!empty && !busy) onCreate(); }}>
        <label className="idea-label" htmlFor="idea-input">What do you want to create?</label>
        <textarea
          id="idea-input"
          className="idea-input"
          rows={4}
          maxLength={2000}
          placeholder="A girl gets into her car, shuts the door — and suddenly she's in a world of dinosaurs."
          value={draft.idea}
          onChange={(e) => onChange({ ...draft, idea: e.target.value })}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !empty && !busy) onCreate(); }}
        />
        <div className="settings">
          <div className="setting"><span>Duration</span><Chips label="Duration" options={DURATIONS} value={draft.settings.duration} onChange={(duration) => set({ duration })} disabled={busy} /></div>
          <div className="setting"><span>Format</span><Chips label="Format" options={[{ id: '9:16' as const, label: '9:16' }]} value={draft.settings.format} onChange={() => {}} disabled={busy} /></div>
          <div className="setting"><span>Style</span><Chips label="Style" options={STYLES} value={draft.settings.style} onChange={(style) => set({ style })} disabled={busy} /></div>
        </div>
        <div className="idea-actions">
          <Button type="button" variant="ghost" onClick={onDemo} disabled={busy}>Open demo project</Button>
          <Button type="submit" variant="fire" size="lg" loading={busy} disabled={empty}>CREATE REEL</Button>
        </div>
      </form>
    </section>
  );
}
