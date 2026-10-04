import { useRef, useState } from 'react';
import { buildProductLock, buildVoiceover, refreshLockInPrompt } from '../../../shared/engine';
import { projectToJSON, projectToMarkdown, projectToText } from '../../../shared/export';
import { SPEEDS, TONES, VOICES } from '../../../shared/options';
import type { VoiceSettings } from '../../../shared/types';
import { fmtSec, scenesLabel, timeline } from '../../../shared/util';
import { sceneNo } from '../../components/SceneViews';
import { Badge, Button, Card, Chips, ConfirmModal, CopyButton, Field, PromptBox } from '../../components/ui';
import { api } from '../../lib/api';
import { download, resizeImage, slugify } from '../../lib/files';
import { reportMode } from '../../lib/flow';
import type { StepProps } from '../Workspace';

export function PromptsStep({ project, save, toast }: StepProps) {
  const lock = buildProductLock(project.product);
  const [appearance, setAppearance] = useState(project.product.appearance);
  const fileRef = useRef<HTMLInputElement>(null);
  const all = (k: 'imagePrompt' | 'videoPrompt') => project.scenes.map((s, i) => `${sceneNo(i)} · ${s.goal}\n${s[k]}`).join('\n\n');

  const applyLock = (product = { ...project.product, appearance }) => {
    const next = buildProductLock(product);
    save((p) => ({
      ...p,
      product,
      scenes: p.scenes.map((s) => ({ ...s, imagePrompt: refreshLockInPrompt(s.imagePrompt, next), videoPrompt: refreshLockInPrompt(s.videoPrompt, next) })),
    }));
    toast('Product Lock обновлён во всех промптах');
  };

  return (
    <div className="prompts-page">
      <Card className="lock">
        <div className="lock-head">
          <h2 className="card-title">🔒 PRODUCT LOCK</h2>
          <Badge tone={lock.hasReference ? 'green' : 'amber'}>{lock.hasReference ? 'Reference photo подключено' : 'Нет reference photo'}</Badge>
        </div>
        <div className="lock-grid">
          <div className="lock-ref">
            {project.product.imageDataUrl ? <img src={project.product.imageDataUrl} alt="Reference товара" /> : <div className="upload-ph">Загрузите фото товара — оно станет главным визуальным reference</div>}
            <Button size="sm" onClick={() => fileRef.current?.click()}>{project.product.imageDataUrl ? 'Заменить фото' : 'Загрузить фото'}</Button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                applyLock({ ...project.product, appearance, imageDataUrl: await resizeImage(f) });
              } catch (err) {
                toast((err as Error).message, 'error');
              }
            }} />
          </div>
          <div>
            <p className="muted">AI сохраняет во всех кадрах:</p>
            <ul className="lock-list">
              {['Форму товара', 'Цвет', 'Логотип', 'Название', 'Упаковку', 'Основные элементы дизайна', 'Расположение элементов', 'Визуальные особенности'].map((x) => <li key={x}>✓ {x}</li>)}
            </ul>
            <Field label="Внешний вид товара" hint="Добавляется в каждый промпт, где виден товар">
              <textarea className="input" rows={3} value={appearance} onChange={(e) => setAppearance(e.target.value)} placeholder="Белая коробка с синим логотипом…" />
            </Field>
            <div className="row wrap">
              <Button variant="primary" size="sm" disabled={appearance === project.product.appearance} onClick={() => applyLock()}>Применить ко всем промптам</Button>
              <CopyButton text={lock.clause} label="COPY LOCK" />
            </div>
            {!lock.hasReference && <p className="note note-warn">Без фото генераторы не знают, как выглядит товар. При генерации прикрепляйте фото товара как image reference.</p>}
          </div>
        </div>
        <pre className="lock-clause">{lock.clause}</pre>
      </Card>

      <div className="panel-head">
        <h2>PROMPTS</h2>
        <div className="row wrap">
          <CopyButton text={all('imagePrompt')} label="COPY ALL IMAGE PROMPTS" variant="soft" size="md" />
          <CopyButton text={all('videoPrompt')} label="COPY ALL VIDEO PROMPTS" variant="soft" size="md" />
        </div>
      </div>
      {project.scenes.map((s, i) => (
        <div key={s.id} className="prompt-scene">
          <h3>{sceneNo(i)} <Badge tone="pink">{s.goal}</Badge></h3>
          <div className="prompts-2">
            <PromptBox title="IMAGE PROMPT" text={s.imagePrompt} />
            <PromptBox title="VIDEO PROMPT" text={s.videoPrompt} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VoiceoverStep({ project, save }: StepProps) {
  const v = project.voice;
  const vo = buildVoiceover(project.scenes, v);
  const times = timeline(project.scenes);
  const timed = project.scenes.map((s, i) => `[${fmtSec(times[i].start)}–${fmtSec(times[i].end)} c] ${s.voiceover}`).join('\n');
  const set = (patch: Partial<VoiceSettings>) => save((p) => ({ ...p, voice: { ...p.voice, ...patch } }));
  return (
    <div className="vo-layout">
      <Card>
        <h2 className="card-title">VOICEOVER</h2>
        <Field group label="Voice"><Chips label="Voice" options={VOICES} value={v.voice} onChange={(voice) => set({ voice })} /></Field>
        <Field group label="Tone"><Chips label="Tone" options={TONES} value={v.tone} onChange={(tone) => set({ tone })} /></Field>
        <Field group label="Speed"><Chips label="Speed" options={SPEEDS} value={v.speed} onChange={(speed) => set({ speed })} /></Field>
        <div className="stats">
          <div><b>{vo.words}</b><span>слов</span></div>
          <div><b>≈{fmtSec(vo.estSeconds)} с</b><span>чтение</span></div>
          <div><b>{fmtSec(vo.totalSeconds)} с</b><span>ролик</span></div>
        </div>
        <p className={`note ${vo.fits ? 'note-ok' : 'note-warn'}`}>{vo.fits ? 'Текст укладывается в длительность ролика.' : 'Текст длиннее ролика: сократите реплики в раскадровке или выберите темп Fast.'}</p>
        <Button disabled title="Генерация аудио через TTS API появится в следующей версии">🔊 Озвучить (TTS) · Coming soon</Button>
      </Card>
      <Card>
        <div className="row between wrap">
          <h3>Полный текст диктора</h3>
          <div className="row wrap">
            <CopyButton text={vo.text} label="COPY VOICEOVER" variant="primary" size="md" />
            <CopyButton text={`${vo.direction}\n\n${timed}`} label="С таймкодами" size="md" />
          </div>
        </div>
        <p className="direction">🎬 {vo.direction}</p>
        <pre className="vo-text">{vo.text}</pre>
        <h4>По сценам</h4>
        <ol className="vo-scenes">
          {project.scenes.map((s, i) => <li key={s.id}><span className="scene-time">{fmtSec(times[i].start)}–{fmtSec(times[i].end)} с</span> {s.voiceover}</li>)}
        </ol>
        <p className="muted">Текст реплик редактируется в раскадровке (✏️ РЕДАКТИРОВАТЬ).</p>
      </Card>
    </div>
  );
}

export function SocialStep({ project, save, ctx, toast, go }: StepProps) {
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [tab, setTab] = useState<'A' | 'B' | 'C'>('A');
  const sp = project.social;

  const generate = async () => {
    if (!ctx) return;
    setBusy(true);
    try {
      const r = await api.social(ctx);
      reportMode(r, toast);
      save((p) => ({ ...p, social: r.data, generatedBy: r.mode }));
      toast('Social package готов — проект в статусе Ready');
    } catch (e) {
      toast(`Ошибка: ${(e as Error).message}`, 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!sp) {
    return (
      <div className="empty">
        <div className="empty-icon">📣</div>
        <h3>SOCIAL PACKAGE</h3>
        <p className="muted">Caption, hook, CTA, 10–15 хэштегов, SEO-ключи и 3 варианта текста публикации.</p>
        <Button variant="fire" size="lg" loading={busy} onClick={generate}>✨ Создать social package</Button>
      </div>
    );
  }
  const variation = sp.variations.find((v) => v.id === tab)!;
  return (
    <div className="social">
      <div className="panel-head">
        <h2>SOCIAL PACKAGE</h2>
        <Button loading={busy} onClick={() => setConfirm(true)}>↻ Перегенерировать</Button>
      </div>
      <div className="social-grid">
        <Card className="span-2">
          <div className="row between"><h3>Caption</h3><CopyButton text={sp.caption} label="COPY CAPTION" /></div>
          <pre className="caption">{sp.caption}</pre>
        </Card>
        <Card>
          <div className="row between"><h3>Hook</h3><CopyButton text={sp.hook} /></div>
          <p className="big">{sp.hook}</p>
          <div className="row between"><h3>CTA</h3><CopyButton text={sp.cta} /></div>
          <p className="big">{sp.cta}</p>
        </Card>
        <Card>
          <div className="row between"><h3>Hashtags <small className="muted">{sp.hashtags.length}</small></h3><CopyButton text={sp.hashtags.join(' ')} /></div>
          <div className="tags">{sp.hashtags.map((h) => <span key={h} className="tag">{h}</span>)}</div>
        </Card>
        <Card>
          <div className="row between"><h3>Keywords</h3><CopyButton text={sp.keywords.join(', ')} /></div>
          <div className="tags">{sp.keywords.map((h) => <span key={h} className="tag tag-alt">{h}</span>)}</div>
        </Card>
        <Card className="span-2">
          <div className="row between wrap">
            <h3>3 VARIATIONS</h3>
            <div className="tabs" role="tablist">
              {sp.variations.map((v) => <button key={v.id} role="tab" aria-selected={tab === v.id} className={`tab ${tab === v.id ? 'tab-on' : ''}`} onClick={() => setTab(v.id)}>Вариант {v.id} — {v.label}</button>)}
            </div>
          </div>
          <pre className="caption">{variation.caption}</pre>
          <CopyButton text={variation.caption} label={`COPY ВАРИАНТ ${variation.id}`} variant="soft" />
        </Card>
      </div>
      <div className="cta-row"><Button variant="primary" size="lg" onClick={() => go('export')}>К экспорту →</Button></div>
      {confirm && <ConfirmModal title="Перегенерировать social package?" text="Текущие тексты будут заменены." confirmLabel="Перегенерировать" onConfirm={generate} onClose={() => setConfirm(false)} />}
    </div>
  );
}

export function ExportStep({ project, toast, go }: StepProps) {
  const base = slugify(project.product.name);
  const json = JSON.stringify(projectToJSON(project), null, 2);
  const checks: [string, boolean][] = [
    ['Анализ товара', Boolean(project.analysis)],
    ['Выбрана концепция', Boolean(project.selectedAngleId)],
    [`Сценарий (${scenesLabel(project.scenes.length)})`, project.scenes.length > 0],
    ['Image & video prompts', project.scenes.length > 0],
    ['Voiceover', project.scenes.some((s) => s.voiceover)],
    ['Social package', Boolean(project.social)],
  ];
  return (
    <div className="export">
      <Card>
        <h2 className="card-title">EXPORT</h2>
        <ul className="checklist">{checks.map(([l, ok]) => <li key={l} className={ok ? 'ok' : 'miss'}>{ok ? '✓' : '○'} {l}</li>)}</ul>
        {!project.social && <p className="note note-warn">Social package ещё не создан — caption и хэштеги будут пустыми. <button className="link" onClick={() => go('social')}>Создать</button></p>}
        <div className="export-actions">
          <CopyButton text={projectToText(project)} label="COPY ALL" variant="primary" size="lg" />
          <Button size="lg" onClick={() => { download(`${base}.txt`, projectToText(project), 'text/plain'); toast('Файл TXT сохранён'); }}>⬇ EXPORT TXT</Button>
          <Button size="lg" onClick={() => { download(`${base}.json`, json, 'application/json'); toast('Файл JSON сохранён'); }}>⬇ EXPORT JSON</Button>
          <Button size="lg" onClick={() => { download(`${base}.md`, projectToMarkdown(project), 'text/markdown'); toast('Файл Markdown сохранён'); }}>⬇ EXPORT MARKDOWN</Button>
        </div>
      </Card>
      <Card>
        <div className="row between"><h3>JSON preview</h3><CopyButton text={json} label="COPY JSON" /></div>
        <p className="muted">Структура готова для передачи во внешние AI image/video API: product, audience, concept, hook, scenes, voiceover, image_prompts, video_prompts, caption, hashtags, cta.</p>
        <pre className="json">{json.length > 6000 ? `${json.slice(0, 6000)}\n…` : json}</pre>
      </Card>
    </div>
  );
}
