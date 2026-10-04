import { useState } from 'react';
import type { Scene } from '../../shared/types';
import { fmtSec } from '../../shared/util';
import { Badge, Button, Field, Modal, PromptBox } from './ui';

export const sceneNo = (i: number) => `SCENE ${String(i + 1).padStart(2, '0')}`;

export function SceneDetail({ scene, index, start, end }: { scene: Scene; index: number; start: number; end: number }) {
  return (
    <article className="scene" data-testid="scene">
      <header className="scene-head">
        <h3>{sceneNo(index)}</h3>
        <Badge tone="pink">{scene.goal}</Badge>
        <span className="scene-time">⏱ {fmtSec(start)}–{fmtSec(end)} сек</span>
      </header>
      <dl className="kv scene-kv">
        <div><dt>Что происходит</dt><dd>{scene.action}</dd></div>
        <div><dt>Текст на экране</dt><dd className="onscreen">{scene.onScreenText}</dd></div>
        <div><dt>Voiceover</dt><dd>{scene.voiceover}</dd></div>
        <div><dt>Camera</dt><dd>{scene.camera}</dd></div>
        <div><dt>Lighting</dt><dd>{scene.lighting}</dd></div>
        <div><dt>Sound</dt><dd>{scene.sound}</dd></div>
      </dl>
      <div className="prompts-2">
        <PromptBox title="IMAGE PROMPT" text={scene.imagePrompt} />
        <PromptBox title="VIDEO PROMPT" text={scene.videoPrompt} />
      </div>
    </article>
  );
}

const FIELDS: { key: keyof Scene; label: string; rows: number }[] = [
  { key: 'action', label: 'Что происходит', rows: 2 },
  { key: 'onScreenText', label: 'Текст на экране', rows: 1 },
  { key: 'voiceover', label: 'Voiceover', rows: 2 },
  { key: 'camera', label: 'Camera', rows: 2 },
  { key: 'lighting', label: 'Lighting', rows: 2 },
  { key: 'sound', label: 'Sound', rows: 1 },
  { key: 'imagePrompt', label: 'IMAGE PROMPT', rows: 7 },
  { key: 'videoPrompt', label: 'VIDEO PROMPT', rows: 7 },
];

export function SceneEditor({ scene, title, onSave, onClose }: { scene: Scene; title: string; onSave: (s: Scene) => void; onClose: () => void }) {
  const [s, setS] = useState(scene);
  const valid = s.duration > 0 && s.duration <= 60;
  return (
    <Modal
      wide
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant="primary" disabled={!valid} onClick={() => { onSave(s); onClose(); }}>Сохранить сцену</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Цель сцены"><input className="input" value={s.goal} onChange={(e) => setS({ ...s, goal: e.target.value.toUpperCase() })} /></Field>
        <Field label="Длительность, сек" hint={valid ? undefined : 'От 0,5 до 60 секунд'}>
          <input className="input" type="number" min={0.5} max={60} step={0.5} value={s.duration} onChange={(e) => setS({ ...s, duration: Number(e.target.value) })} />
        </Field>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <textarea className={`input ${f.rows > 3 ? 'mono' : ''}`} rows={f.rows} value={String(s[f.key])} onChange={(e) => setS({ ...s, [f.key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Modal>
  );
}
