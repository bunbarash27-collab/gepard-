import type { CharacterState, Entity, ObjectState, Relationship, VehicleState, WorldState } from './types';

const isChar = (e: Entity): e is CharacterState => e.kind === 'character';

/** Where an entity physically is: its location, or the location of the vehicle it sits in. */
export function locationOf(state: WorldState, e: Entity): string | null {
  if (e.locationId === null) return state.currentLocation; // travels with the scene's place
  const holder = state.entities[e.locationId];
  if (holder && holder.kind === 'vehicle') return locationOf(state, holder);
  return e.locationId;
}

/** Present entities physically at the current location (characters, objects, vehicles, products). */
export function presentHere(state: WorldState): Entity[] {
  return Object.values(state.entities).filter((e) => e.kind !== 'location' && e.present && locationOf(state, e) === state.currentLocation);
}

export const heldBy = (state: WorldState, character: string): ObjectState[] =>
  Object.values(state.entities).filter((e): e is ObjectState => e.kind === 'object' && e.present && e.heldBy === character);

/**
 * Full relationship graph: structural relations derived from state (at, inside, holding) plus explicit
 * relations set by events. Only relations between present entities are active.
 */
export function relationshipsOf(state: WorldState): Relationship[] {
  const out: Relationship[] = [];
  for (const e of Object.values(state.entities)) {
    if (!e.present || e.kind === 'location') continue;
    if (isChar(e)) {
      const loc = locationOf(state, e);
      if (loc) out.push({ subject: e.id, relation: 'at', object: loc, strength: 1, status: 'active' });
      if (e.position.inside) out.push({ subject: e.id, relation: 'inside', object: e.position.inside, strength: 1, status: 'active' });
    }
    if (e.kind === 'object' && e.heldBy) out.push({ subject: e.heldBy, relation: 'holding', object: e.id, strength: 1, status: 'active' });
    if ((e.kind === 'object' || e.kind === 'product') && e.locationId && state.entities[e.locationId]?.kind === 'vehicle') {
      out.push({ subject: e.id, relation: 'inside', object: e.locationId, strength: 1, status: 'active' });
    }
  }
  for (const r of state.relationships) {
    if (r.status === 'active' && state.entities[r.subject]?.present && state.entities[r.object]?.present) out.push(r);
  }
  return out;
}

export const sameRelation = (a: Pick<Relationship, 'subject' | 'relation' | 'object'>, b: Pick<Relationship, 'subject' | 'relation' | 'object'>) =>
  a.subject === b.subject && a.relation === b.relation && a.object === b.object;

export function addRelation(state: WorldState, r: Relationship): void {
  state.relationships = state.relationships.filter((x) => !sameRelation(x, r));
  state.relationships.push({ ...r, status: 'active' });
}

export function endRelation(state: WorldState, r: Pick<Relationship, 'subject' | 'relation' | 'object'>): void {
  state.relationships = state.relationships.map((x) => (sameRelation(x, r) ? { ...x, status: 'ended' } : x));
}

export const doorsAllClosed = (v: VehicleState) => Object.values(v.doors).every((d) => d === 'closed');
