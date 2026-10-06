import type { CharacterState, WorldState } from './types';

/**
 * Character knowledge: what each character has perceived. The world may contain things a character does
 * not know about yet (the dinosaur behind her); she may only react to what she knows.
 */
export function knows(state: WorldState, character: string, entity: string): boolean {
  const c = state.entities[character];
  if (!c || c.kind !== 'character') return false;
  return c.id === entity || c.knowledge.includes(entity);
}

export function learn(state: WorldState, character: string, entity: string): boolean {
  const c = state.entities[character] as CharacterState | undefined;
  if (!c || c.kind !== 'character' || c.knowledge.includes(entity)) return false;
  c.knowledge = [...c.knowledge, entity];
  return true;
}

/** Present entities a character does not know about yet. */
export function unknownTo(state: WorldState, character: string): string[] {
  return Object.values(state.entities)
    .filter((e) => e.kind !== 'location' && e.present && e.id !== character && !knows(state, character, e.id))
    .map((e) => e.id);
}
