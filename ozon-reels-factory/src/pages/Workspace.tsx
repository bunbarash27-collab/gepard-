import type { AIStatus, GenContext, Project } from '../../shared/types';
import { ANGLE_META, STATUS_LABEL } from '../../shared/options';
import { Badge, Button, useToast } from '../components/ui';
import { href, navigate, STEPS, type StepId } from '../lib/router';
import type { ProjectsApi } from '../lib/store';
import type { Notify } from '../lib/flow';
import { AnalysisStep, AnglesStep, ProductStep } from './steps/ProductSteps';
import { ScriptStep, StoryboardStep } from './steps/ScriptSteps';
import { ExportStep, PromptsStep, SocialStep, VoiceoverStep } from './steps/OutputSteps';

export interface StepProps {
  project: Project;
  save: (fn: (p: Project) => Project) => void;
  ctx: GenContext | null;
  toast: Notify;
  go: (step: StepId) => void;
}

export function stepState(p: Project): Record<StepId, { available: boolean; done: boolean; needs: StepId }> {
  const hasScenes = p.scenes.length > 0;
  return {
    product: { available: true, done: Boolean(p.analysis), needs: 'product' },
    analysis: { available: Boolean(p.analysis), done: Boolean(p.angles?.length), needs: 'product' },
    angles: { available: Boolean(p.angles?.length), done: Boolean(p.selectedAngleId), needs: 'product' },
    script: { available: Boolean(p.analysis && p.selectedAngleId), done: hasScenes, needs: 'angles' },
    storyboard: { available: hasScenes, done: hasScenes, needs: 'script' },
    prompts: { available: hasScenes, done: hasScenes, needs: 'script' },
    voiceover: { available: hasScenes, done: hasScenes, needs: 'script' },
    social: { available: hasScenes, done: Boolean(p.social), needs: 'script' },
    export: { available: hasScenes, done: p.status === 'ready', needs: 'script' },
  };
}

const STATUS_TONE = { draft: 'default', generated: 'blue', ready: 'green' } as const;

export function Workspace({ project, step, store, status }: { project: Project; step: StepId; store: ProjectsApi; status: AIStatus | null }) {
  const toast = useToast();
  const save = (fn: (p: Project) => Project) => store.update(project.id, fn);
  const go = (s: StepId) => navigate(href.project(project.id, s));
  const angle = project.angles?.find((a) => a.id === project.selectedAngleId);
  const ctx: GenContext | null = project.analysis && angle ? { product: project.product, analysis: project.analysis, angle, settings: project.settings } : null;
  const states = stepState(project);
  const idx = STEPS.findIndex((s) => s.id === step);
  const prev = STEPS[idx - 1];
  const next = STEPS[idx + 1];
  const props: StepProps = { project, save, ctx, toast, go };
  const locked = !states[step].available;

  return (
    <div className="page workspace">
      <header className="ws-head">
        <div className="ws-title">
          {project.product.imageDataUrl && <img src={project.product.imageDataUrl} alt="" />}
          <div>
            <h1>{project.product.name || 'Новый проект'}</h1>
            <div className="row wrap">
              <Badge tone={STATUS_TONE[project.status]}>{STATUS_LABEL[project.status]}</Badge>
              {project.isDemo && <Badge tone="amber">DEMO PROJECT</Badge>}
              {angle && <Badge tone="pink">{ANGLE_META[angle.type].icon} {ANGLE_META[angle.type].label}</Badge>}
              {project.generatedBy && <Badge tone={project.generatedBy === 'demo' ? 'default' : 'blue'} title="Чем сгенерирован последний результат">{project.generatedBy === 'demo' ? 'Demo mode' : `AI: ${project.generatedBy}`}</Badge>}
            </div>
          </div>
        </div>
      </header>

      <nav className="stepper" aria-label="Этапы проекта">
        {STEPS.map((s, i) => {
          const st = states[s.id];
          const cls = s.id === step ? 'step-current' : st.done ? 'step-done' : st.available ? 'step-open' : 'step-locked';
          return (
            <button key={s.id} className={`step ${cls}`} disabled={!st.available} onClick={() => go(s.id)} aria-current={s.id === step ? 'step' : undefined} title={st.available ? s.label : 'Сначала завершите предыдущие этапы'}>
              <span className="step-num">{st.done && s.id !== step ? '✓' : i + 1}</span>
              <span className="step-label"><small>STEP {i + 1}</small>{s.label}</span>
            </button>
          );
        })}
      </nav>

      {status && !status.connected && <div className="banner banner-demo">ⓘ {status.message}</div>}
      {project.isDemo && <div className="banner banner-info">★ Это демо-проект «Средство от храпа» с вымышленными характеристиками. Переключайте шаги сверху, чтобы увидеть весь workflow. <a href={href.home()}>Создать свой проект →</a></div>}

      <section className="ws-body">
        {locked ? (
          <div className="empty">
            <div className="empty-icon">🔒</div>
            <h3>Этап пока недоступен</h3>
            <p className="muted">Сначала завершите этап «{STEPS.find((s) => s.id === states[step].needs)?.label}».</p>
            <Button variant="primary" onClick={() => go(states[step].needs)}>Перейти</Button>
          </div>
        ) : (
          <>
            {step === 'product' && <ProductStep {...props} />}
            {step === 'analysis' && <AnalysisStep {...props} />}
            {step === 'angles' && <AnglesStep {...props} />}
            {step === 'script' && <ScriptStep {...props} />}
            {step === 'storyboard' && <StoryboardStep {...props} />}
            {step === 'prompts' && <PromptsStep {...props} />}
            {step === 'voiceover' && <VoiceoverStep {...props} />}
            {step === 'social' && <SocialStep {...props} />}
            {step === 'export' && <ExportStep {...props} />}
          </>
        )}
      </section>

      <footer className="ws-foot">
        {prev ? <Button variant="ghost" onClick={() => go(prev.id)}>← {prev.label}</Button> : <span />}
        {next && (
          <Button variant="primary" disabled={!states[next.id].available} onClick={() => go(next.id)} title={states[next.id].available ? '' : 'Завершите текущий этап'}>
            {next.label} →
          </Button>
        )}
      </footer>
    </div>
  );
}
