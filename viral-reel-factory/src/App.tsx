import { useCallback, useEffect, useRef, useState } from 'react';
import { buildDemoReel } from '../shared/demo';
import { applyStronger } from '../shared/engine';
import { compileImagePrompt, compileVideoPrompt, withPrompts } from '../shared/prompts';
import type { AIResponse, AIStatus, Hook, Reel, StrongerResult } from '../shared/types';
import { uid } from '../shared/util';
import { AnalysisView } from './components/AnalysisView';
import { HooksView } from './components/HooksView';
import { IdeaForm, type Draft } from './components/IdeaForm';
import { Pipeline } from './components/Pipeline';
import { ScenesView } from './components/ScenesView';
import { StoryView } from './components/StoryView';
import { StrongerModal } from './components/StrongerModal';
import { useToast, Working } from './components/ui';
import { api } from './lib/api';
import { loadReel, saveReel } from './lib/storage';

export type Stage = 'analyze' | 'hooks' | 'story' | 'scenes' | 'image' | 'video' | 'stronger';

const STAGE_TEXT: Record<Stage, string> = {
  analyze: 'Analyzing the idea…',
  hooks: 'Writing 5 hooks…',
  story: 'Building the story…',
  scenes: 'Breaking the story into scenes…',
  image: 'Compiling image prompts…',
  video: 'Compiling video prompts…',
  stronger: 'Re-analyzing the reel…',
};

const scrollTo = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

export default function App() {
  const toast = useToast();
  const [reel, setReelState] = useState<Reel>(() => loadReel() ?? buildDemoReel());
  const [draft, setDraft] = useState<Draft>({ idea: reel.idea, settings: reel.settings });
  const [stage, setStage] = useState<Stage | null>(null);
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [pending, setPending] = useState<{ before: Reel; result: StrongerResult } | null>(null);
  const reelRef = useRef(reel);
  const busy = stage !== null;

  const setReel = useCallback((next: Reel | ((r: Reel) => Reel)) => {
    const value = typeof next === 'function' ? next(reelRef.current) : next;
    reelRef.current = value;
    setReelState(value);
    saveReel(value);
  }, []);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus({ mode: 'demo', connected: false, message: 'Server unreachable.' }));
  }, []);

  // Only provider failures are worth a toast; the regular Demo Mode notice is shown in the header.
  const noticed = <T,>(r: AIResponse<T>) => {
    if (r.notice && status?.connected) toast(r.notice, 'warn');
    return r.data;
  };

  const run = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setStage(null);
    }
  };

  const createReel = (ideaOverride?: string) => run(async () => {
    const idea = (ideaOverride ?? draft.idea).trim();
    const settings = draft.settings;
    if (ideaOverride) setDraft((d) => ({ ...d, idea }));
    setReel({ id: uid('reel'), idea, settings, boosts: [], version: 1, createdAt: Date.now() });
    setStage('analyze');
    scrollTo('analysis-slot');
    const analysis = noticed(await api.analyze(idea, settings));
    setReel((r) => ({ ...r, analysis }));
    setStage('hooks');
    const hooks = noticed(await api.hooks(idea, settings, analysis));
    setReel((r) => ({ ...r, hooks }));
  });

  const selectHook = (hook: Hook) => run(async () => {
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
    const withImages = bundle.scenes.map((s) => ({ ...s, imagePrompt: compileImagePrompt(s, settings) }));
    setStage('video');
    const scenes = withImages.map((s, i) => ({ ...s, videoPrompt: compileVideoPrompt(s, settings, withImages[i + 1]) }));
    setReel((r) => ({ ...r, continuity: bundle.continuity, scenes }));
    scrollTo('scenes');
  });

  const strengthen = () => run(async () => {
    const r = reelRef.current;
    const hook = r.hooks?.find((h) => h.id === r.selectedHookId);
    if (!hook || !r.story || !r.scenes) return;
    setStage('stronger');
    const res = noticed(await api.stronger({ idea: r.idea, settings: r.settings, hook, story: r.story, scenes: r.scenes, boosts: r.boosts }));
    if (!res.improvements.length) return void toast(res.message ?? 'Nothing left to improve.', 'info');
    setPending({ before: r, result: { ...res, scenes: withPrompts(res.scenes, r.settings) } });
  });

  const openDemo = () => {
    const demo = buildDemoReel();
    setReel(demo);
    setDraft({ idea: demo.idea, settings: demo.settings });
    scrollTo('analysis');
  };

  const hook = reel.hooks?.find((h) => h.id === reel.selectedHookId);
  const settingsChanged = Boolean(reel.analysis) && (draft.settings.duration !== reel.settings.duration || draft.settings.style !== reel.settings.style);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">▶</span><b>VIRAL REEL FACTORY</b>{reel.isDemo && <span className="badge badge-fire">Demo project</span>}</div>
        <Pipeline reel={reel} stage={stage} />
        <div className={`ai-pill ${status?.connected ? 'ai-on' : 'ai-off'}`} title={status?.message} data-testid="ai-status">
          <span className="dot" />{status ? (status.connected ? `AI: ${status.model}` : 'Demo Mode') : '…'}
        </div>
      </header>

      <main className="main">
        <IdeaForm draft={draft} onChange={setDraft} onCreate={() => createReel()} busy={busy} onDemo={openDemo} />
        {status && !status.connected && <p className="demo-note">{status.message} Connect OpenAI or Gemini in <code>.env</code> for model-written results.</p>}
        {settingsChanged && <p className="demo-note">Settings changed — press CREATE REEL to rebuild with {draft.settings.duration} sec / {draft.settings.style}.</p>}

        <div id="analysis-slot" />
        {stage === 'analyze' && <Working text={STAGE_TEXT.analyze} />}
        {reel.analysis && <AnalysisView a={reel.analysis} onUseImproved={(idea) => createReel(idea)} busy={busy} />}
        {stage === 'hooks' && <Working text={STAGE_TEXT.hooks} />}
        {reel.hooks && <HooksView hooks={reel.hooks} selectedId={reel.selectedHookId} onSelect={selectHook} busy={busy} />}

        <div id="story-slot" />
        {stage === 'story' && <Working text={STAGE_TEXT.story} />}
        {reel.story && <StoryView story={reel.story} duration={reel.settings.duration} />}
        {(stage === 'scenes' || stage === 'image' || stage === 'video') && <Working text={STAGE_TEXT[stage]} />}
        {reel.scenes && hook && <ScenesView reel={reel} onStronger={strengthen} busy={stage === 'stronger'} />}
        {reel.hooks && !reel.selectedHookId && !busy && <p className="hint">↑ Select a hook to build the story, scenes and prompts.</p>}
      </main>

      {pending && (
        <StrongerModal
          before={pending.before}
          result={pending.result}
          onClose={() => setPending(null)}
          onApply={() => {
            setReel(applyStronger(pending.before, pending.result));
            setPending(null);
            toast(`Stronger version applied — ${pending.result.improvements.length} improvements`, 'ok');
            scrollTo('scenes');
          }}
        />
      )}
    </div>
  );
}
