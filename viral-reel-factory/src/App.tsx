import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDemoReel } from '../shared/demo';
import { applyStronger, rebuildReel } from '../shared/engine';
import { LANGS, UI, type Stage } from '../shared/i18n';
import { compileImagePrompt, compileVideoPrompt, withPrompts } from '../shared/prompts';
import type { AIResponse, AIStatus, Hook, Lang, Reel, StrongerResult } from '../shared/types';
import { uid } from '../shared/util';
import { AnalysisView } from './components/AnalysisView';
import { HooksView } from './components/HooksView';
import { IdeaForm, type Draft } from './components/IdeaForm';
import { Pipeline } from './components/Pipeline';
import { ScenesView } from './components/ScenesView';
import { StoryView } from './components/StoryView';
import { StrongerModal } from './components/StrongerModal';
import { Chips, useToast, Working } from './components/ui';
import { api, ApiError } from './lib/api';
import { I18nProvider } from './lib/i18n';
import { loadLang, loadPromptLang, loadReel, saveLang, savePromptLang, saveReel } from './lib/storage';

const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
const LANG_OPTIONS: { id: Lang; label: string }[] = LANGS.map((id) => ({ id, label: id === 'ru' ? '🇷🇺 RU' : '🇬🇧 EN' }));

export default function App() {
  const toast = useToast();
  const [lang, setLangState] = useState<Lang>(loadLang);
  const [promptLang, setPromptLangState] = useState<Lang>(loadPromptLang);
  const [reel, setReelState] = useState<Reel>(() => loadReel() ?? buildDemoReel(lang, promptLang));
  const [draft, setDraft] = useState<Draft>({ idea: reel.idea, settings: reel.settings });
  const [stage, setStage] = useState<Stage | null>(null);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [pending, setPending] = useState<{ before: Reel; result: StrongerResult } | null>(null);
  const reelRef = useRef(reel);
  const aiUsed = useRef(false);
  const t = UI[lang];
  const busy = stage !== null;

  const setReel = useCallback((next: Reel | ((r: Reel) => Reel)) => {
    const value = typeof next === 'function' ? next(reelRef.current) : next;
    reelRef.current = value;
    setReelState(value);
    saveReel(value);
  }, []);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus({ mode: 'demo', connected: false, message: '' }));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Only provider failures are worth a toast; the regular Demo Mode notice is shown under the form.
  const noticed = <T,>(r: AIResponse<T>) => {
    if (r.mode !== 'demo') aiUsed.current = true;
    if (r.notice && status?.connected) toast(r.notice, 'warn');
    return r.data;
  };

  const run = async (fn: () => Promise<void>, failure = t.createFailed) => {
    try {
      await fn();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : failure, 'error');
    } finally {
      setStage(null);
    }
  };

  const settingsFor = (l: Lang = lang) => ({ ...draft.settings, language: l, promptLanguage: promptLang });

  const createReel = (ideaOverride?: string, language: Lang = lang, reselect?: Hook['type']) => {
    const idea = (ideaOverride ?? draft.idea).trim();
    if (!idea) return void toast(UI[language].enterIdea, 'warn');
    return run(async () => {
      const settings = settingsFor(language);
      if (ideaOverride) setDraft((d) => ({ ...d, idea }));
      aiUsed.current = false;
      setReel({ id: uid('reel'), idea, settings, boosts: [], version: 1, source: 'offline', createdAt: Date.now() });
      setStage('analyze');
      scrollTo('analysis-slot');
      const analysis = noticed(await api.analyze(idea, settings));
      setReel((r) => ({ ...r, analysis }));
      setStage('hooks');
      const hooks = noticed(await api.hooks(idea, settings, analysis));
      setReel((r) => ({ ...r, hooks, source: aiUsed.current ? 'ai' : 'offline' }));
      const again = reselect && hooks.find((h) => h.type === reselect);
      if (again) await buildFromHook(again);
    });
  };

  const buildFromHook = async (hook: Hook) => {
    const { idea, settings, analysis } = reelRef.current;
    if (!analysis) return;
    setReel((r) => ({ ...r, selectedHookId: hook.id, story: undefined, scenes: undefined, continuity: undefined, boosts: [], version: 1 }));
    setStage('story');
    scrollTo('story-slot');
    const story = noticed(await api.story(idea, settings, analysis, hook));
    setReel((r) => ({ ...r, story }));
    setStage('scenes');
    const bundle = noticed(await api.scenes(idea, settings, analysis, hook, story));
    setStage('image');
    const withImages = bundle.scenes.map((s) => ({ ...s, imagePrompt: compileImagePrompt(s, settings, 'en') }));
    setStage('video');
    const scenes = withPrompts(withImages.map((s, i) => ({ ...s, videoPrompt: compileVideoPrompt(s, settings, withImages[i + 1], 'en') })), settings);
    setReel((r) => ({ ...r, continuity: bundle.continuity, scenes, source: aiUsed.current ? 'ai' : r.source }));
    scrollTo('scenes');
  };

  const selectHook = (hook: Hook) => run(() => buildFromHook(hook));

  const strengthen = () => run(async () => {
    const r = reelRef.current;
    const hook = r.hooks?.find((h) => h.id === r.selectedHookId);
    if (!hook || !r.story || !r.scenes) return;
    setStage('stronger');
    const settings = { ...r.settings, promptLanguage: promptLang };
    const res = noticed(await api.stronger({ idea: r.idea, settings, hook, story: r.story, scenes: r.scenes, boosts: r.boosts }));
    if (!res.improvements.length) return void toast(res.message ?? UI[r.settings.language].stronger, 'info');
    setPending({ before: r, result: { ...res, scenes: withPrompts(res.scenes, r.settings) } });
  });

  const changeLang = (l: Lang) => {
    if (l === lang) return;
    setLangState(l);
    saveLang(l);
    setDraft((d) => ({ ...d, settings: { ...d.settings, language: l } }));
    const r = reelRef.current;
    // Offline reels are deterministic, so they are re-rendered locally; AI reels offer a regeneration instead.
    if (r.settings.language !== l && r.source === 'offline') setReel(rebuildReel(r, l));
  };

  const changePromptLang = (l: Lang) => {
    setPromptLangState(l);
    savePromptLang(l);
    const r = reelRef.current;
    if (l !== 'ru' || !r.scenes?.some((s) => !s.ru?.imagePrompt)) return;
    run(async () => {
      setStage('prompts');
      const res = await api.prompts(r.idea, { ...r.settings, promptLanguage: 'ru' }, r.scenes!);
      if (res.mode !== 'demo') aiUsed.current = true;
      const scenes = withPrompts(res.data, r.settings);
      setReel((cur) => ({ ...cur, scenes }));
      if (scenes.some((s) => !s.ru?.imagePrompt)) toast(res.notice ?? t.ruPromptsUnavailable, 'warn');
    }, t.ruPromptsUnavailable);
  };

  const openDemo = () => {
    const demo = buildDemoReel(lang, promptLang);
    setReel(demo);
    setDraft({ idea: demo.idea, settings: demo.settings });
    scrollTo('analysis');
  };

  const hook = reel.hooks?.find((h) => h.id === reel.selectedHookId);
  const settingsChanged = Boolean(reel.analysis) && (draft.settings.duration !== reel.settings.duration || draft.settings.style !== reel.settings.style);
  const otherLanguage = reel.settings.language !== lang && reel.source === 'ai';

  return (
    <I18nProvider lang={lang}>
      <div className="app">
        <header className="topbar">
          <div className="brand"><span className="brand-mark">▶</span><b>VIRAL REEL FACTORY</b>{reel.isDemo && <span className="badge badge-fire">{t.demoProject}</span>}</div>
          <Pipeline reel={reel} stage={stage} />
          <div className="topbar-right">
            <Chips small label={t.uiLanguage} options={LANG_OPTIONS} value={lang} onChange={changeLang} disabled={busy} />
            <div className={`ai-pill ${status?.connected ? 'ai-on' : 'ai-off'}`} title={status?.connected ? status.message : t.demoNote} data-testid="ai-status">
              <span className="dot" />{status ? (status.connected ? `AI: ${status.model}` : t.demoMode) : '…'}
            </div>
          </div>
        </header>

        <main className="main">
          <IdeaForm draft={draft} onChange={setDraft} onCreate={() => createReel()} busy={busy} onDemo={openDemo} />
          {status && !status.connected && <p className="demo-note" data-testid="demo-note">{t.demoNote} {t.demoHint[0]} <code>.env</code>{t.demoHint[1]}</p>}
          {settingsChanged && <p className="demo-note">{t.settingsChanged(draft.settings.duration, t.styles[draft.settings.style])}</p>}
          {otherLanguage && (
            <p className="demo-note" data-testid="other-language">
              {t.otherLanguage}{' '}
              <button className="link" onClick={() => createReel(reel.idea, lang, hook?.type)} disabled={busy}>{t.rebuild}</button>
            </p>
          )}

          <div id="analysis-slot" />
          {stage === 'analyze' && <Working text={t.working.analyze} />}
          {reel.analysis && <AnalysisView a={reel.analysis} onUseImproved={(idea) => createReel(idea)} busy={busy} />}
          {stage === 'hooks' && <Working text={t.working.hooks} />}
          {reel.hooks && <HooksView hooks={reel.hooks} selectedId={reel.selectedHookId} onSelect={selectHook} busy={busy} />}

          <div id="story-slot" />
          {stage === 'story' && <Working text={t.working.story} />}
          {reel.story && <StoryView story={reel.story} duration={reel.settings.duration} />}
          {(stage === 'scenes' || stage === 'image' || stage === 'video' || stage === 'prompts') && <Working text={t.working[stage]} />}
          {reel.scenes && hook && <ScenesView reel={reel} promptLang={promptLang} onPromptLang={changePromptLang} onStronger={strengthen} busy={stage === 'stronger'} />}
          {reel.hooks && !reel.selectedHookId && !busy && <p className="hint">{t.selectHint}</p>}
        </main>

        {pending && (
          <StrongerModal
            before={pending.before}
            result={pending.result}
            onClose={() => setPending(null)}
            onApply={() => {
              setReel(applyStronger(pending.before, pending.result));
              setPending(null);
              toast(t.applied(pending.result.improvements.length), 'ok');
              scrollTo('scenes');
            }}
          />
        )}
      </div>
    </I18nProvider>
  );
}
