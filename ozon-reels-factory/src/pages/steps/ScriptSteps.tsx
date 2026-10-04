import { useState } from 'react';
import { createBlankScene } from '../../../shared/engine';
import { CTA_PRESETS, DURATIONS, PLATFORMS, STYLES } from '../../../shared/options';
import type { GeneratorSettings, Scene } from '../../../shared/types';
import { fmtSec, scenesLabel, timeline, totalDuration } from '../../../shared/util';
import { SceneDetail, SceneEditor, sceneNo } from '../../components/SceneViews';
import { Badge, Button, Card, Chips, ConfirmModal, CopyButton, Empty, Field, Modal } from '../../components/ui';
import { api } from '../../lib/api';
import { reportMode } from '../../lib/flow';
import type { StepProps } from '../Workspace';

function DurationInfo({ scenes, target }: { scenes: Scene[]; target: number }) {
  const total = totalDuration(scenes);
  const ok = Math.abs(total - target) < 0.01;
  return <Badge tone={ok ? 'green' : 'amber'} title="Сумма длительностей сцен">Итого {fmtSec(total)} сек{ok ? '' : ` · цель ${target} сек`}</Badge>;
}

export function ScriptStep({ project, save, ctx, toast, go }: StepProps) {
  const [busy, setBusy] = useState<'script' | 'viral' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [compare, setCompare] = useState(false);
  const s = project.settings;
  const customCta = !CTA_PRESETS.includes(s.cta);
  const setSettings = (patch: Partial<GeneratorSettings>) => save((p) => ({ ...p, settings: { ...p.settings, ...patch } }));
  const times = timeline(project.scenes);
  const stale = project.scenes.length > 0 && project.scriptAngleId !== project.selectedAngleId;

  const generate = async () => {
    if (!ctx) return;
    setBusy('script');
    try {
      const r = await api.script(ctx);
      reportMode(r, toast);
      // A new script invalidates the viral comparison and the social package built for the old one.
      save((p) => ({ ...p, scenes: r.data, scriptAngleId: p.selectedAngleId, viral: undefined, social: undefined, generatedBy: r.mode }));
      toast(`Сценарий готов: ${scenesLabel(r.data.length)}`);
    } catch (e) {
      toast(`Ошибка генерации: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  const viral = async () => {
    if (project.viral) return setCompare(true);
    if (!ctx) return;
    setBusy('viral');
    try {
      const r = await api.viral(ctx, project.scenes);
      reportMode(r, toast);
      save((p) => ({ ...p, scenes: r.data.scenes, viral: { beforeScenes: p.scenes, changes: r.data.changes, appliedAt: new Date().toISOString() }, generatedBy: r.mode }));
      setCompare(true);
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="script-layout">
      <Card className="generator">
        <h2 className="card-title">GENERATOR</h2>
        {ctx && <p className="muted">Концепция: <b>{ctx.angle.title}</b> · «{ctx.angle.hook}» <button className="link" onClick={() => go('angles')}>сменить</button></p>}
        <Field group label="Формат"><Chips label="Формат" options={[{ id: '9:16' as const, label: '9:16 вертикальный' }]} value={s.format} onChange={() => {}} /></Field>
        <Field group label="Длительность"><Chips label="Длительность" options={DURATIONS.map((d) => ({ id: d, label: `${d} сек` }))} value={s.duration} onChange={(duration) => setSettings({ duration })} /></Field>
        <Field group label="Платформа"><Chips label="Платформа" options={PLATFORMS} value={s.platform} onChange={(platform) => setSettings({ platform })} /></Field>
        <Field group label="Стиль"><Chips label="Стиль" options={STYLES} value={s.style} onChange={(style) => setSettings({ style })} /></Field>
        <Field group label="CTA">
          <Chips label="CTA" options={[...CTA_PRESETS.map((c) => ({ id: c, label: c })), { id: '__custom', label: 'Выбрать свой вариант' }]} value={customCta ? '__custom' : s.cta} onChange={(cta) => setSettings({ cta: cta === '__custom' ? (customCta ? s.cta : 'Заказать на Ozon') : cta })} />
        </Field>
        {customCta && <Field label="Свой CTA"><input className="input" value={s.cta} maxLength={60} onChange={(e) => setSettings({ cta: e.target.value })} placeholder="Например: Заказать со скидкой" /></Field>}
        <Button variant="primary" size="lg" loading={busy === 'script'} disabled={!ctx || !s.cta.trim()} onClick={() => (project.scenes.length ? setConfirm(true) : generate())}>
          {project.scenes.length ? '↻ Перегенерировать сценарий' : '✨ Сгенерировать сценарий'}
        </Button>
        {stale && <p className="note note-warn">Сценарий создан для другой концепции. Перегенерируйте, чтобы применить выбранную.</p>}
      </Card>

      <div className="script-main">
        {project.scenes.length === 0 ? (
          <Empty icon="🎬" title="Сценария пока нет" text="Выберите параметры ролика слева и нажмите «Сгенерировать сценарий»." />
        ) : (
          <>
            <div className="viral-bar">
              <div>
                <h2>СТРУКТУРА РОЛИКА</h2>
                <div className="row wrap"><Badge>{scenesLabel(project.scenes.length)}</Badge><DurationInfo scenes={project.scenes} target={s.duration} />{project.viral && <Badge tone="pink">🔥 Viral-правки применены</Badge>}</div>
              </div>
              <div className="viral-cta">
                <Button variant="fire" size="lg" loading={busy === 'viral'} onClick={viral}>{project.viral ? '🔥 BEFORE / AFTER' : '🔥 MAKE IT VIRAL'}</Button>
                <small className="muted">Усиливает удержание по проверенным приёмам. Вирусность не гарантируется.</small>
              </div>
            </div>
            {project.scenes.map((sc, i) => <SceneDetail key={sc.id} scene={sc} index={i} start={times[i].start} end={times[i].end} />)}
            <div className="cta-row"><Button variant="primary" size="lg" onClick={() => go('storyboard')}>К раскадровке →</Button></div>
          </>
        )}
      </div>

      {confirm && <ConfirmModal title="Перегенерировать сценарий?" text="Текущие сцены, ручные правки, viral-улучшения и social package будут заменены." confirmLabel="Перегенерировать" onConfirm={generate} onClose={() => setConfirm(false)} />}
      {compare && project.viral && (
        <Modal
          wide
          title="🔥 MAKE IT VIRAL — BEFORE / AFTER"
          onClose={() => setCompare(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => { save((p) => ({ ...p, scenes: p.viral!.beforeScenes, viral: undefined })); setCompare(false); toast('Изменения откатены'); }}>↶ Откатить изменения</Button>
              <Button variant="primary" onClick={() => setCompare(false)}>Оставить улучшения</Button>
            </>
          }
        >
          <p className="muted">Что изменилось в ролике. Приёмы повышают шансы удержать зрителя, но не гарантируют вирусность. Откат вернёт сцены к состоянию до улучшения (правки после него тоже пропадут).</p>
          <table className="compare">
            <thead><tr><th>Что</th><th>BEFORE</th><th>AFTER</th></tr></thead>
            <tbody>
              {project.viral.changes.map((c, i) => (
                <tr key={i}><td><b>{c.area}</b></td><td className="before">{c.before}</td><td className="after">{c.after}</td></tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}
    </div>
  );
}

export function StoryboardStep({ project, save, ctx, toast }: StepProps) {
  const [editing, setEditing] = useState<{ scene: Scene; isNew: boolean } | null>(null);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const scenes = project.scenes;
  const times = timeline(scenes);

  const setScenes = (fn: (s: Scene[]) => Scene[]) => save((p) => ({ ...p, scenes: fn(p.scenes) }));
  const move = (i: number, d: -1 | 1) => setScenes((s) => {
    const n = [...s];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });

  const continueStory = async () => {
    if (!ctx) return;
    setBusy(true);
    try {
      const r = await api.continueStory(ctx, scenes);
      reportMode(r, toast);
      setScenes((s) => [...s, r.data]);
      toast(`${sceneNo(scenes.length)} добавлена — продолжение истории`);
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="panel-head">
        <div>
          <h2>STORYBOARD</h2>
          <div className="row wrap"><DurationInfo scenes={scenes} target={project.settings.duration} /><Badge tone="default" title="Генерация изображений появится позже">Генерация кадров: Coming soon</Badge></div>
        </div>
        <div className="row wrap">
          <Button onClick={() => ctx && setEditing({ scene: createBlankScene(ctx), isNew: true })} disabled={!ctx}>＋ ДОБАВИТЬ СЦЕНУ</Button>
          <Button variant="fire" onClick={continueStory} loading={busy} disabled={!ctx}>▶ CONTINUE STORY</Button>
        </div>
      </div>
      <p className="muted">CONTINUE STORY анализирует последнюю сцену и создаёт следующую, сохраняя продукт, персонажей, одежду, локацию, время суток, стиль и камеру — следующий кадр начинается с последнего кадра предыдущей сцены.</p>

      {scenes.length === 0 ? <Empty icon="🎞" title="Сцен нет" text="Добавьте сцену вручную или сгенерируйте сценарий." /> : (
        <div className="board">
          {scenes.map((sc, i) => (
            <article key={sc.id} className="board-card" data-testid="board-card">
              <div className="thumb">
                {project.product.imageDataUrl && <img src={project.product.imageDataUrl} alt="" />}
                <div className="thumb-overlay">
                  <span className="thumb-no">{sceneNo(i)}</span>
                  <span className="thumb-text">{sc.onScreenText}</span>
                  <span className="thumb-ph">thumbnail placeholder</span>
                </div>
              </div>
              <div className="board-body">
                <div className="row between"><Badge tone="pink">{sc.goal}</Badge><span className="scene-time">{fmtSec(times[i].start)}–{fmtSec(times[i].end)} с · {fmtSec(sc.duration)} сек</span></div>
                <p>{sc.action}</p>
                <p className="vo">🎙 {sc.voiceover}</p>
                <details>
                  <summary>Image prompt</summary>
                  <pre>{sc.imagePrompt}</pre>
                  <CopyButton text={sc.imagePrompt} label="COPY IMAGE PROMPT" />
                </details>
                <details>
                  <summary>Video prompt</summary>
                  <pre>{sc.videoPrompt}</pre>
                  <CopyButton text={sc.videoPrompt} label="COPY VIDEO PROMPT" />
                </details>
                <div className="board-actions">
                  <Button size="sm" onClick={() => setEditing({ scene: sc, isNew: false })}>✏️ РЕДАКТИРОВАТЬ</Button>
                  <Button size="sm" variant="danger" onClick={() => setToDelete(i)}>🗑 УДАЛИТЬ</Button>
                  <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Переместить выше">↑</Button>
                  <Button size="sm" variant="ghost" disabled={i === scenes.length - 1} onClick={() => move(i, 1)} aria-label="Переместить ниже">↓</Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <SceneEditor
          title={editing.isNew ? 'Новая сцена' : `Редактирование · ${sceneNo(scenes.findIndex((s) => s.id === editing.scene.id))}`}
          scene={editing.scene}
          onClose={() => setEditing(null)}
          onSave={(sc) => {
            setScenes((s) => (editing.isNew ? [...s, sc] : s.map((x) => (x.id === sc.id ? sc : x))));
            toast(editing.isNew ? 'Сцена добавлена' : 'Сцена сохранена');
          }}
        />
      )}
      {toDelete !== null && (
        <ConfirmModal
          title={`Удалить ${sceneNo(toDelete)}?`}
          text={`«${scenes[toDelete]?.action}» будет удалена из сценария.`}
          danger
          confirmLabel="Удалить"
          onConfirm={() => { const id = scenes[toDelete].id; setScenes((s) => s.filter((x) => x.id !== id)); toast('Сцена удалена'); }}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
