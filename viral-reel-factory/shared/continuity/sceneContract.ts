// SCENE CONTRACT: built before a scene is generated from the current state and the planned events.
import { getPath } from './locks';
import { presentHere } from './relationships';
import { transition } from './stateTransition';
import type { ContractItem, Entity, SceneContract, StoryEvent, WorldState } from './types';

const LOCKED_PATHS: Partial<Record<Entity['kind'], string[]>> = {
  character: ['identity.faceDescription', 'identity.hair', 'identity.eyes', 'identity.approximateAge'],
  vehicle: ['make', 'model', 'color', 'body'],
  location: ['architecture'],
  product: ['shape', 'color', 'branding', 'logo', 'packaging'],
  object: ['appearance', 'color'],
};
const PRESERVE_PATHS: Partial<Record<Entity['kind'], string[]>> = {
  character: ['wardrobe.clothing', 'position.inside', 'physicalCondition'],
  vehicle: ['doors.driver', 'doors.passenger', 'engine', 'lights', 'damage'],
  object: ['heldBy', 'hand', 'spot', 'condition'],
  location: ['time', 'weather', 'lighting'],
};

function items(state: WorldState, entities: Entity[], table: typeof LOCKED_PATHS, skip: Set<string>): ContractItem[] {
  const out: ContractItem[] = [];
  for (const e of entities) {
    for (const path of table[e.kind] ?? []) {
      const value = getPath(e, path);
      if (value === undefined || value === '' || skip.has(`${e.id}|${path}`)) continue;
      if (typeof value === 'object' && value && !Array.isArray(value) && 'en' in value && !value.en) continue;
      out.push({ entity: e.id, path, value });
    }
  }
  return out;
}

export function buildContract(sceneId: string, before: WorldState, events: StoryEvent[], storyPurpose = ''): SceneContract {
  const t = transition(before, events);
  const changed = new Set(t.changes.map((c) => `${c.entity}|${c.path}`));
  const here = [...presentHere(before), before.entities[before.currentLocation]].filter(Boolean) as Entity[];
  return {
    sceneId,
    mustPreserve: items(before, here, PRESERVE_PATHS, changed),
    mustChange: t.changes,
    mustNotChange: items(before, here, LOCKED_PATHS, new Set()),
    newElements: events.flatMap((e) => (e.introduces ?? []).map((x) => x.id)),
    removedElements: events.flatMap((e) => e.removes ?? []),
    storyPurpose,
  };
}
