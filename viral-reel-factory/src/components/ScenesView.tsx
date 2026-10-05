import { reelToText } from '../../shared/export';
import { BEAT_LABELS } from '../../shared/i18n';
import { promptsFor } from '../../shared/prompts';
import type { Lang, Reel, Scene } from '../../shared/types';
import { pad2 } from '../../shared/util';
import { useT } from '../lib/i18n';
import { Badge, Button, Chips, CopyButton, Section } from './ui';

const PROMPT_LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: '🇬🇧 EN' },
  { id: 'ru', label: '🇷🇺 RU' },
];

function PromptBox({ title, copyLabel, note, text, lang }: { title: string; copyLabel: string; note: string; text: string; lang: Lang }) {
  return (
    <div className="prompt" data-prompt-lang={lang}>
      <div className="prompt-head">
        <span>{title}</span>
        <CopyButton text={text} label={copyLabel} />
      </div>
      <p className="prompt-note">{note}</p>
      <pre lang={lang}>{text}</pre>
    </div>
  );
}

function SceneCard({ s, n, promptLang }: { s: Scene; n: number; promptLang: Lang }) {
  const { t, lang } = useT();
  const f = t.sceneFields;
  const rows: [string, string][] = [[f.purpose, s.purpose], [f.visual, s.visual], [f.action, s.action], [f.camera, s.camera], [f.lighting, s.lighting], [f.sound, s.sound], [f.onScreenText, s.onScreenText], [f.voiceover, s.voiceover]];
  const p = promptsFor(s, promptLang);
  return (
    <article className="scene" data-testid="scene">
      <div className="scene-head">
        <h3>{t.sceneN(pad2(n))}</h3>
        <Badge tone={s.beat === 'TURN' || s.beat === 'COLD OPEN' ? 'fire' : 'default'}>{BEAT_LABELS[lang][s.beat]}</Badge>
        <span className="scene-time">{t.time}: {t.timeRange(s.start, s.end)}</span>
      </div>
      <dl className="scene-grid">
        {rows.map(([k, v]) => <div key={k} className="kv"><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
      <div className="prompts">
        <PromptBox title={t.imagePrompt} copyLabel={t.copyImage} note={t.promptNote[p.lang]} text={p.image} lang={p.lang} />
        <PromptBox title={t.videoPrompt} copyLabel={t.copyVideo} note={t.promptNote[p.lang]} text={p.video} lang={p.lang} />
      </div>
    </article>
  );
}

export function ScenesView({ reel, promptLang, onPromptLang, onStronger, busy }: { reel: Reel; promptLang: Lang; onPromptLang: (l: Lang) => void; onStronger: () => void; busy: boolean }) {
  const { t } = useT();
  const hook = reel.hooks?.find((h) => h.id === reel.selectedHookId);
  const scenes = reel.scenes ?? [];
  return (
    <Section
      id="scenes"
      step="04"
      title={t.reelTitle}
      aside={
        <div className="row wrap">
          {reel.version > 1 && <Badge tone="fire">{t.version(reel.version)}</Badge>}
          <CopyButton text={reelToText(reel, promptLang)} label={t.copyAll} variant="soft" size="md" />
          <Button variant="fire" onClick={onStronger} loading={busy}>{t.stronger}</Button>
        </div>
      }
    >
      <div className="result-top">
        <div className="kv"><dt>{t.reelConcept}</dt><dd>{reel.analysis?.concept}</dd></div>
        {hook && <div className="kv"><dt>{t.selectedHook}</dt><dd>{hook.hook}{hook.onScreenText && <span className="muted"> · {t.onScreen} «{hook.onScreenText}»</span>}</dd></div>}
        {reel.story && <div className="kv"><dt>{t.storyTitle}</dt><dd>{reel.story.summary}</dd></div>}
      </div>
      <div className="scenes-bar">
        <h3 className="scenes-title">{t.scenesTitle} <span className="muted small">{t.scenesMeta(scenes.length, reel.settings.duration, reel.settings.format, t.styles[reel.settings.style])}</span></h3>
        <div className="setting setting-inline"><span>{t.promptLanguage}</span><Chips small label={t.promptLanguage} options={PROMPT_LANGS} value={promptLang} onChange={onPromptLang} disabled={busy} /></div>
      </div>
      <div className="scenes">{scenes.map((s, i) => <SceneCard key={s.id} s={s} n={i + 1} promptLang={promptLang} />)}</div>
    </Section>
  );
}
