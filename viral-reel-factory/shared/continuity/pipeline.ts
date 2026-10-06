// MASTER WORLD STATE → SCENE CONTRACT → SCENE → STATE TRANSITION → VALIDATION → AUTO REPAIR → UPDATED STATE → PROMPTS.
// Runs over a whole reel; every scene starts exactly from the previous scene's END STATE.
import type { Scene } from '../types';
import { logEntry } from './eventLog';
import { clone } from './locks';
import { continuityFromState } from './plan';
import { buildPromptContext, hasLanguage } from './promptContext';
import { applyFixes, checkScene, finish, MAX_REPAIR_ATTEMPTS, type CheckResult, type Repairer } from './repair';
import { buildContract } from './sceneContract';
import type { EventLogEntry, Issue, SceneCheck, SceneContract, SceneDraft, StoryWorld, TimelineEntry, WorldState } from './types';
import { blocking, listable, validateScene } from './validator';

export interface PipelineResult {
  world: StoryWorld;
  scenes: Scene[];
}

interface Step {
  scene: Scene;
  before: WorldState;
  result: CheckResult;
  contract: SceneContract;
}

const round = (n: number) => Math.round(n * 10) / 10;
const emptyDraft = (): SceneDraft => ({ events: [], claims: {} });
const isFlash = (s: Scene) => Boolean(s.draft?.flashForward);

/** Writes the check, the synced CONTINUITY_STATE layers and the prompt context into the scene. */
function finalizeScene(scene: Scene, r: CheckResult, contract: SceneContract): Scene {
  const v = r.validation;
  const en = continuityFromState(v.end, 'en', listable);
  const ru = continuityFromState(v.end, 'ru', listable);
  const prompt: SceneCheck['prompt'] = { en: buildPromptContext(v.opening, v.end, v.changes, 'en') };
  if (hasLanguage(v.opening, 'ru') && hasLanguage(v.end, 'ru')) prompt.ru = buildPromptContext(v.opening, v.end, v.changes, 'ru');
  const check: SceneCheck = { status: r.status, attempts: r.attempts, issues: v.issues, repaired: r.repaired, scores: v.scores, contract, changes: v.changes, eventIds: r.draft.events.map((e) => e.id), prompt };
  return {
    ...scene,
    continuity: en ?? scene.continuity,
    ...(scene.ru ? { ru: { ...scene.ru, continuity: ru ?? scene.ru.continuity } } : {}),
    check,
  };
}

/** Index of the scene a flash-forward previews: the first TURN after it, else the next chained scene. */
function previewTarget(scenes: Scene[], i: number): number {
  const later = scenes.map((_, j) => j).filter((j) => j > i && !isFlash(scenes[j]));
  return later.find((j) => scenes[j].beat === 'TURN') ?? later[0] ?? -1;
}

/** Flash-forwards are checked against the state they preview; then everything is assembled. */
function assemble(master: WorldState, mode: StoryWorld['mode'], steps: (Step | null)[], scenes: Scene[], last: WorldState, repair?: Repairer): PipelineResult {
  const refOf = (i: number) => {
    const j = previewTarget(scenes, i);
    return j >= 0 && steps[j] ? steps[j]!.result.validation.end : last;
  };
  scenes.forEach((s, i) => {
    if (!isFlash(s)) return;
    const ref = refOf(i);
    steps[i] = { scene: s, before: ref, result: checkScene(ref, s.draft!, { reference: ref, repair }), contract: buildContract(s.id, ref, [], s.purpose) };
  });
  const timeline: TimelineEntry[] = [];
  const log: EventLogEntry[] = [];
  const out = steps.map((step, i) => {
    const s = step!.scene;
    const v = step!.result.validation;
    if (isFlash(scenes[i])) {
      timeline.push({ sceneId: s.id, start: step!.before, opening: step!.before, end: step!.before });
    } else {
      for (const p of v.perEvent) log.push(logEntry(p.event, log.length + 1, s.id, p.event.timing === 'cut' ? s.start : round(s.start + (s.end - s.start) / 2), p.changes));
      timeline.push({ sceneId: s.id, start: step!.before, opening: v.opening, end: v.end });
    }
    return finalizeScene(s, step!.result, step!.contract);
  });
  return { world: { mode, master, current: last, timeline, log }, scenes: out };
}

/** Deterministic pipeline (Demo Mode and every re-check). */
export function runContinuity(master: WorldState, scenes: Scene[], mode: StoryWorld['mode'], repair?: Repairer): PipelineResult {
  const steps: (Step | null)[] = new Array(scenes.length).fill(null);
  let state = clone(master);
  scenes.forEach((s, i) => {
    if (isFlash(s)) return;
    const draft = s.draft ?? emptyDraft();
    const contract = buildContract(s.id, state, draft.events, s.purpose);
    const result = checkScene(state, draft, { repair });
    steps[i] = { scene: s, before: state, result, contract };
    state = result.validation.end;
  });
  return assemble(master, mode, steps, scenes, state, repair);
}

/** AI repair: rewrites the scene (narrative + draft) given the contract and the open issues. */
export type AsyncRepairer = (scene: Scene, draft: SceneDraft, issues: Issue[], before: WorldState, contract: SceneContract) => Promise<{ scene: Scene; draft: SceneDraft } | null>;

/**
 * Pipeline for model-written scenes: at most two repair attempts per scene, each by the model when it can
 * (so the narrative is fixed too), otherwise deterministic. Whatever is still open is "needs review".
 */
export async function runContinuityAsync(master: WorldState, scenes: Scene[], repairAsync: AsyncRepairer): Promise<PipelineResult> {
  const steps: (Step | null)[] = new Array(scenes.length).fill(null);
  let state = clone(master);
  for (let i = 0; i < scenes.length; i++) {
    let scene = scenes[i];
    if (isFlash(scene)) continue;
    let draft = scene.draft ?? emptyDraft();
    const contract = buildContract(scene.id, state, draft.events, scene.purpose);
    const first = validateScene(state, draft);
    let v = first;
    let attempts = 0;
    while (blocking(v.issues).length && attempts < MAX_REPAIR_ATTEMPTS) {
      attempts++;
      const ai = await repairAsync(scene, draft, v.issues, state, contract).catch(() => null);
      if (ai) {
        draft = ai.draft;
        scene = { ...ai.scene, id: scene.id, draft };
      } else {
        const d = applyFixes(draft, v.issues);
        if (!d) break;
        draft = d;
      }
      v = validateScene(state, draft);
    }
    // Low notes (an object missing from the list) are always fixed deterministically.
    if (v.issues.length && !blocking(v.issues).length) {
      const d = applyFixes(draft, v.issues);
      if (d) {
        draft = d;
        v = validateScene(state, draft);
      }
    }
    steps[i] = { scene, before: state, result: finish(first, v, draft, attempts), contract };
    state = v.end;
  }
  return assemble(master, 'ai', steps, scenes, state);
}
