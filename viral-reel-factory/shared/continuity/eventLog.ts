import type { EventLogEntry, StateChange, StoryEvent } from './types';

/** Event Log entry: every significant event, with the exact state changes it caused. */
export function logEntry(ev: StoryEvent, n: number, sceneId: string, timestamp: number, stateChanges: StateChange[]): EventLogEntry {
  return { id: ev.id, n, sceneId, timestamp, actor: ev.actor, action: ev.action, target: ev.target, result: ev.result, stateChanges };
}

/** The most recent events, for compact AI context. */
export const recentEvents = (log: EventLogEntry[], n = 6) => log.slice(-n);
