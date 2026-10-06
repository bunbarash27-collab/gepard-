// CONTINUITY VALIDATOR: replays the scene's events on the BEFORE state (checking causality, physics and
// knowledge as it goes), then compares what the scene shows with the state those events lead to.
import { knows } from './knowledge';
import { canon, clone, getPath, isText, ruleFor, same, setPath } from './locks';
import { addRelation, doorsAllClosed, heldBy, locationOf, presentHere } from './relationships';
import { applyEvent, compact, WORLD } from './stateTransition';
import { CATEGORIES, type Category, type CharacterState, type Entity, type Issue, type SceneDraft, type Scores, type Severity, type StateChange, type StoryEvent, type WorldState } from './types';

export interface Validation {
  issues: Issue[];
  scores: Scores;
  opening: WorldState;
  end: WorldState;
  changes: StateChange[];
  perEvent: { event: StoryEvent; changes: StateChange[] }[];
}

const PENALTY: Record<Severity, number> = { low: 5, medium: 20, high: 40, critical: 100 };
const CAP: Record<Severity, number> = { low: 100, medium: 85, high: 60, critical: 30 };

export function scoreIssues(issues: Issue[]): Scores {
  const s = Object.fromEntries(CATEGORIES.map((c) => [c, 100])) as Scores;
  for (const i of issues) s[i.category] = Math.max(0, s[i.category] - PENALTY[i.severity]);
  const avg = CATEGORIES.reduce((a, c) => a + s[c], 0) / CATEGORIES.length;
  const cap = Math.min(100, ...issues.map((i) => CAP[i.severity]));
  s.overall = Math.round(Math.min(avg, cap));
  return s;
}

/** Things a scene is expected to list explicitly (the hero and vehicles are always implied). */
export const listable = (e: Entity) => e.kind === 'object' || e.kind === 'product' || (e.kind === 'character' && e.role !== 'hero');

const isDoor = (path: string) => path.startsWith('doors.');
const named = (state: WorldState, id: string) => state.entities[id]?.name;

/** Physical, causal and knowledge checks for one event, against the state just before it. */
function checkEvent(state: WorldState, ev: StoryEvent, issues: Issue[]): void {
  const introduced = new Set((ev.introduces ?? []).map((e) => e.id));
  const actor = state.entities[ev.actor];
  if (ev.actor !== WORLD && !actor && !introduced.has(ev.actor)) {
    issues.push({ code: 'unknown-actor', category: 'causality', severity: 'high', claimed: ev.actor, eventId: ev.id, fix: { type: 'drop-event', eventId: ev.id } });
    return;
  }
  if (actor?.kind === 'character' && actor.physicalCondition === 'dead' && !ev.explicit) {
    issues.push({ code: 'dead-acts', category: 'causality', severity: 'critical', entity: actor.id, entityName: actor.name, eventId: ev.id });
  }
  const target = ev.target ? state.entities[ev.target] : undefined;
  if (target && target.kind !== 'location' && !target.present && !introduced.has(target.id) && !ev.explicit) {
    issues.push({ code: 'absent-target', category: 'physics', severity: 'high', entity: target.id, entityName: target.name, claimed: target.name, eventId: ev.id, fix: { type: 'drop-event', eventId: ev.id } });
  }
  if (ev.reactsTo && actor?.kind === 'character') {
    const perceived = (ev.perceives ?? []).some((p) => p.character === actor.id && p.entity === ev.reactsTo);
    if (!perceived && !knows(state, actor.id, ev.reactsTo)) {
      issues.push({ code: 'knowledge', category: 'knowledge', severity: 'high', entity: actor.id, entityName: actor.name, claimed: named(state, ev.reactsTo) ?? ev.reactsTo, eventId: ev.id, fix: { type: 'drop-reaction-event', eventId: ev.id } });
    }
  }
  // Changes are checked in order on a scratch copy, so "open the door, then get out" is valid.
  const scratch = clone(state);
  for (const e of ev.introduces ?? []) scratch.entities[e.id] = clone({ ...e, present: true });
  for (const c of ev.changes) {
    if (c.entity === WORLD) {
      (scratch as any)[c.path] = c.value;
      continue;
    }
    const e = scratch.entities[c.entity];
    if (!e) continue;
    const cur = getPath(e, c.path);
    const { lock, category } = ruleFor(e.kind, c.path);
    const drop = { type: 'drop-change' as const, eventId: ev.id, entity: c.entity, path: c.path };
    if (lock === 'locked' && !ev.explicit && !same(cur, c.value)) {
      issues.push({ code: 'locked-change', category, severity: 'high', entity: e.id, entityName: e.name, path: c.path, expected: cur ?? null, claimed: c.value, eventId: ev.id, fix: drop });
      continue;
    }
    if (e.kind === 'vehicle' && isDoor(c.path) && same(cur, c.value)) {
      issues.push({ code: 'redundant-event', category: 'causality', severity: 'low', entity: e.id, entityName: e.name, path: c.path, expected: cur ?? null, eventId: ev.id, fix: drop });
      continue;
    }
    if (e.kind === 'vehicle' && c.path === 'damage' && !ev.explicit) {
      const next = new Set((Array.isArray(c.value) ? c.value : []).map(String));
      if (e.damage.some((d) => !next.has(d))) {
        issues.push({ code: 'damage-removed', category: 'objects', severity: 'high', entity: e.id, entityName: e.name, path: c.path, expected: e.damage, claimed: c.value, eventId: ev.id, fix: drop });
        continue;
      }
    }
    if (e.kind === 'character' && c.path === 'position.inside') {
      const from = e.position.inside ? scratch.entities[e.position.inside] : undefined;
      const to = typeof c.value === 'string' ? scratch.entities[c.value] : undefined;
      const through = (from?.kind === 'vehicle' && from) || (to?.kind === 'vehicle' && to);
      if (through && from !== to && doorsAllClosed(through)) {
        issues.push({ code: 'impossible-exit', category: 'physics', severity: 'high', entity: e.id, entityName: e.name, path: c.path, claimed: through.name, eventId: ev.id, fix: drop });
        continue;
      }
    }
    setPath(e, c.path, clone(c.value));
    if (e.kind === 'object' && c.path === 'heldBy' && typeof c.value === 'string' && heldBy(scratch, c.value).length > 2) {
      issues.push({ code: 'too-many-held', category: 'physics', severity: 'medium', entity: c.value, entityName: named(scratch, c.value), eventId: ev.id, fix: drop });
    }
  }
}

function checkClaims(after: WorldState, draft: SceneDraft, issues: Issue[]): WorldState {
  const end = clone(after);
  const cl = draft.claims;
  if (cl.location && cl.location !== after.currentLocation) {
    issues.push({ code: 'location-jump', category: 'location', severity: 'high', entity: cl.location, expected: after.entities[after.currentLocation]?.name ?? after.currentLocation, claimed: after.entities[cl.location]?.name ?? cl.location, fix: { type: 'restore-location' } });
  }
  if (cl.present) {
    const claimed = new Set(cl.present);
    for (const id of claimed) {
      const e = after.entities[id];
      if (!e) issues.push({ code: 'hallucination', category: 'objects', severity: 'high', claimed: id, fix: { type: 'remove-present', entity: id } });
      else if (e.kind !== 'location' && (!e.present || locationOf(after, e) !== after.currentLocation)) {
        issues.push({ code: 'reappeared', category: e.kind === 'character' ? 'identity' : 'objects', severity: 'medium', entity: id, entityName: e.name, fix: { type: 'remove-present', entity: id } });
      }
    }
    for (const e of presentHere(after)) {
      if (listable(e) && !claimed.has(e.id)) issues.push({ code: 'dropped', category: 'objects', severity: 'low', entity: e.id, entityName: e.name, fix: { type: 'add-present', entity: e.id } });
    }
  }
  for (const u of cl.unknown ?? []) {
    issues.push({ code: 'hallucination', category: 'objects', severity: 'high', claimed: u.name, fix: { type: 'remove-unknown', name: u.name } });
  }
  for (const v of cl.values ?? []) {
    const e = end.entities[v.entity];
    if (!e) continue;
    const expected = getPath(after.entities[v.entity], v.path);
    if (expected !== undefined && same(expected, v.value)) continue;
    const { lock, category } = ruleFor(e.kind, v.path);
    const base = { entity: e.id, entityName: e.name, path: v.path, expected: expected ?? null, claimed: v.value, fix: { type: 'restore' as const, entity: e.id, path: v.path } };
    if (e.kind === 'character' && v.path === 'physicalCondition' && canon(expected) === 'dead') issues.push({ ...base, code: 'dead-acts', category: 'causality', severity: 'critical' });
    else if (lock === 'locked') issues.push({ ...base, code: 'locked-change', category, severity: 'high' });
    else if (lock === 'conditional') issues.push({ ...base, code: v.path === 'damage' ? 'damage-removed' : 'unexplained-change', category, severity: v.path === 'damage' ? 'high' : 'medium' });
    else setPath(e, v.path, isText(expected) && typeof v.value === 'string' ? { en: v.value } : clone(v.value));
  }
  for (const r of cl.reactions ?? []) {
    if (!knows(after, r.character, r.to)) {
      issues.push({ code: 'knowledge', category: 'knowledge', severity: 'high', entity: r.character, entityName: after.entities[r.character]?.name, claimed: after.entities[r.to]?.name ?? r.to, fix: { type: 'remove-reaction', character: r.character, to: r.to } });
    }
  }
  for (const r of cl.relations ?? []) {
    const s = after.entities[r.subject];
    const o = after.entities[r.object];
    const fix = { type: 'remove-relation' as const, subject: r.subject, relation: r.relation, object: r.object };
    const label = `${r.subject} ${r.relation} ${r.object}`;
    const here = (e: Entity | undefined) => e && (e.kind === 'location' || (e.present && locationOf(after, e) === after.currentLocation));
    let ok = here(s) && here(o);
    if (ok && r.relation === 'holding') ok = o!.kind === 'object' && o!.heldBy === r.subject;
    if (ok && r.relation === 'inside') ok = (s!.kind === 'character' && (s as CharacterState).position.inside === r.object) || s!.locationId === r.object;
    if (!ok) issues.push({ code: 'bad-relation', category: 'relationships', severity: 'medium', claimed: label, fix });
    else if (!['holding', 'inside', 'at'].includes(r.relation)) addRelation(end, r);
  }
  return end;
}

/**
 * Validates one scene. `reference` replaces the event chain for flash-forward shots, which preview a later
 * state instead of continuing the previous one.
 */
export function validateScene(before: WorldState, draft: SceneDraft, reference?: WorldState): Validation {
  const issues: Issue[] = [];
  const perEvent: Validation['perEvent'] = [];
  let state = clone(reference ?? before);
  let opening = clone(state);
  if (!reference) {
    const events = [...draft.events.filter((e) => e.timing === 'cut'), ...draft.events.filter((e) => e.timing !== 'cut')];
    for (const ev of events) {
      checkEvent(state, ev, issues);
      perEvent.push({ event: ev, changes: applyEvent(state, ev) });
      if (ev.timing === 'cut') opening = clone(state);
    }
    if (!events.some((e) => e.timing === 'cut')) opening = clone(before);
  }
  const end = checkClaims(state, draft, issues);
  const changes = reference ? [] : compact([...perEvent.flatMap((p) => p.changes), ...diffMutable(state, end)]);
  return { issues, scores: scoreIssues(issues), opening, end, changes, perEvent };
}

/** Mutable changes a scene claimed (pose, emotion, gaze) that no event wrote. */
function diffMutable(a: WorldState, b: WorldState): StateChange[] {
  const out: StateChange[] = [];
  for (const id of Object.keys(b.entities)) {
    const x = a.entities[id];
    const y = b.entities[id];
    if (!x || y.kind !== 'character' || x.kind !== 'character') continue;
    for (const path of ['emotion.primary', 'orientation.facing', 'orientation.gaze', 'pose.bodyPosition', 'expression', 'movement']) {
      const from = getPath(x, path);
      const to = getPath(y, path);
      if (!same(from, to)) out.push({ entity: id, path, from: from ?? null, to: to ?? null });
    }
  }
  return out;
}

export const blocking = (issues: Issue[]) => issues.filter((i) => i.severity !== 'low');
export const issueKey = (i: Issue) => [i.code, i.entity, i.path, i.eventId, canon(i.claimed)].join('|');
export type { Category };
