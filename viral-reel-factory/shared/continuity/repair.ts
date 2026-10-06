// AUTO REPAIR + REPAIR LOOP: GENERATE → VALIDATE → (FAIL → REPAIR → VALIDATE) ×2 at most → PASS or REVIEW.
// Conflict resolution keeps the world state and fixes the scene, unless an event explains the change.
import { clone } from './locks';
import { sameRelation } from './relationships';
import type { CheckStatus, Issue, SceneDraft, WorldState } from './types';
import { issueKey, validateScene, type Validation } from './validator';

export const MAX_REPAIR_ATTEMPTS = 2;

/** Applies every deterministic fix; returns null when no issue has one (nothing left to try). */
export function applyFixes(draft: SceneDraft, issues: Issue[]): SceneDraft | null {
  const fixes = issues.map((i) => i.fix).filter((f): f is NonNullable<Issue['fix']> => Boolean(f));
  if (!fixes.length) return null;
  const d = clone(draft);
  const cl = d.claims;
  for (const f of fixes) {
    switch (f.type) {
      case 'restore':
        cl.values = cl.values?.filter((v) => !(v.entity === f.entity && v.path === f.path));
        break;
      case 'restore-location':
        delete cl.location;
        break;
      case 'remove-unknown':
        cl.unknown = cl.unknown?.filter((u) => u.name !== f.name);
        break;
      case 'remove-present':
        cl.present = cl.present?.filter((id) => id !== f.entity);
        break;
      case 'add-present':
        if (cl.present && !cl.present.includes(f.entity)) cl.present.push(f.entity);
        break;
      case 'remove-reaction':
        cl.reactions = cl.reactions?.filter((r) => !(r.character === f.character && r.to === f.to));
        break;
      case 'remove-relation':
        cl.relations = cl.relations?.filter((r) => !sameRelation(r, f));
        break;
      case 'drop-change':
        d.events = d.events.map((e) => (e.id === f.eventId ? { ...e, changes: e.changes.filter((c) => !(c.entity === f.entity && c.path === f.path)) } : e));
        break;
      case 'drop-event':
        d.events = d.events.filter((e) => e.id !== f.eventId);
        break;
      case 'drop-reaction-event':
        d.events = d.events.map((e) => (e.id === f.eventId ? { ...e, reactsTo: undefined, changes: e.changes.filter((c) => !(c.entity === e.actor && /^(emotion|expression)/.test(c.path))) } : e));
        break;
    }
  }
  return d;
}

export type Repairer = (draft: SceneDraft, issues: Issue[], before: WorldState) => SceneDraft | null;
export const deterministicRepair: Repairer = (draft, issues) => applyFixes(draft, issues);

export interface CheckResult {
  status: CheckStatus;
  attempts: number;
  draft: SceneDraft;
  validation: Validation;
  /** Everything the first validation found and later attempts fixed. */
  repaired: Issue[];
}

export function finish(first: Validation, last: Validation, draft: SceneDraft, attempts: number): CheckResult {
  const open = new Set(last.issues.map(issueKey));
  const repaired = first.issues.filter((i) => !open.has(issueKey(i)));
  const status: CheckStatus = last.issues.some((i) => i.severity !== 'low') ? 'needs-review' : first.issues.length ? 'repaired' : 'passed';
  return { status, attempts, draft, validation: last, repaired };
}

/** Runs the bounded repair loop for one scene. */
export function checkScene(before: WorldState, draft: SceneDraft, opts: { reference?: WorldState; repair?: Repairer; maxAttempts?: number } = {}): CheckResult {
  const repair = opts.repair ?? deterministicRepair;
  const max = opts.maxAttempts ?? MAX_REPAIR_ATTEMPTS;
  const first = validateScene(before, draft, opts.reference);
  let v = first;
  let d = draft;
  let attempts = 0;
  while (v.issues.length && attempts < max) {
    const next = repair(d, v.issues, before);
    attempts++;
    if (!next) break;
    d = next;
    v = validateScene(before, d, opts.reference);
  }
  return finish(first, v, d, attempts);
}
