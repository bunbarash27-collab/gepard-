// STATE TRANSITION: BEFORE STATE + ACTIONS → AFTER STATE + STATE CHANGES. Unchanged properties are inherited.
import { learn } from './knowledge';
import { clone, getPath, setPath } from './locks';
import { addRelation, endRelation } from './relationships';
import type { StateChange, StoryEvent, Value, WorldState } from './types';

/** Pseudo-entity for world-level properties (currentLocation). */
export const WORLD = 'world';

function readValue(state: WorldState, entity: string, path: string): Value {
  if (entity === WORLD) return (state as any)[path] ?? null;
  const e = state.entities[entity];
  return e ? (getPath(e, path) ?? null) : null;
}

/** Applies one event in place and returns what changed. */
export function applyEvent(state: WorldState, ev: StoryEvent): StateChange[] {
  const out: StateChange[] = [];
  for (const e of ev.introduces ?? []) {
    state.entities[e.id] = clone({ ...e, present: true });
    out.push({ entity: e.id, path: 'present', from: false, to: true });
  }
  for (const id of ev.removes ?? []) {
    const e = state.entities[id];
    if (!e || !e.present) continue;
    e.present = false;
    out.push({ entity: id, path: 'present', from: true, to: false });
  }
  for (const c of ev.changes) {
    const from = readValue(state, c.entity, c.path);
    if (c.entity === WORLD) (state as any)[c.path] = c.value;
    else if (state.entities[c.entity]) setPath(state.entities[c.entity], c.path, clone(c.value));
    else continue;
    out.push({ entity: c.entity, path: c.path, from, to: c.value });
  }
  for (const p of ev.perceives ?? []) {
    if (learn(state, p.character, p.entity)) out.push({ entity: p.character, path: 'knowledge', from: null, to: p.entity });
  }
  for (const r of ev.relations?.add ?? []) addRelation(state, r);
  for (const r of ev.relations?.end ?? []) endRelation(state, r);
  return out;
}

export interface Transition {
  opening: WorldState;
  after: WorldState;
  changes: StateChange[];
}

/** Cut events shape the opening frame; the rest happen during the scene. */
export function transition(before: WorldState, events: StoryEvent[]): Transition {
  const state = clone(before);
  const changes: StateChange[] = [];
  const ordered = [...events.filter((e) => e.timing === 'cut'), ...events.filter((e) => e.timing !== 'cut')];
  let opening = clone(state);
  let cutDone = !ordered.some((e) => e.timing === 'cut');
  for (const ev of ordered) {
    if (!cutDone && ev.timing !== 'cut') {
      opening = clone(state);
      cutDone = true;
    }
    changes.push(...applyEvent(state, ev));
  }
  if (!cutDone) opening = clone(state);
  return { opening, after: state, changes: compact(changes) };
}

/** Collapses repeated writes to the same property into one from → to change; drops no-ops. */
export function compact(changes: StateChange[]): StateChange[] {
  const map = new Map<string, StateChange>();
  for (const c of changes) {
    const k = c.path === 'knowledge' ? `${c.entity}|knowledge|${String(c.to)}` : `${c.entity}|${c.path}`;
    const prev = map.get(k);
    map.set(k, prev ? { ...prev, to: c.to } : c);
  }
  return [...map.values()].filter((c) => JSON.stringify(c.from) !== JSON.stringify(c.to));
}
