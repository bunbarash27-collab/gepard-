import { useCallback, useEffect, useState } from 'react';
import { buildDemoProject } from '../../shared/demo';
import { computeStatus } from '../../shared/project';
import type { Project } from '../../shared/types';
import { uid } from '../../shared/util';

const KEY = 'orf.projects.v1';
const SEEDED = 'orf.seeded.v1';

function load(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // corrupted storage → start fresh
  }
  return [];
}

/** True only on the very first launch in this browser (used to open the demo project). */
export function consumeFirstRun(): boolean {
  if (localStorage.getItem(SEEDED)) return false;
  localStorage.setItem(SEEDED, '1');
  return true;
}

export function useProjects(onError: (msg: string) => void) {
  const [projects, setProjects] = useState<Project[]>(() => {
    const list = load();
    return list.some((p) => p.id === 'demo') || localStorage.getItem(SEEDED) ? list : [buildDemoProject(), ...list];
  });

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(projects));
    } catch {
      onError('Не удалось сохранить проекты: хранилище браузера переполнено. Удалите старые проекты или фото.');
    }
  }, [projects, onError]);

  const upsert = useCallback((p: Project) => {
    setProjects((list) => {
      const next = { ...p, updatedAt: new Date().toISOString(), status: computeStatus(p) };
      return list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? next : x)) : [next, ...list];
    });
  }, []);

  const update = useCallback((id: string, fn: (p: Project) => Project) => {
    setProjects((list) => list.map((x) => {
      if (x.id !== id) return x;
      const next = fn(x);
      return { ...next, updatedAt: new Date().toISOString(), status: computeStatus(next) };
    }));
  }, []);

  const remove = useCallback((id: string) => setProjects((list) => list.filter((x) => x.id !== id)), []);

  const duplicate = useCallback((id: string) => {
    const copyId = uid('prj');
    setProjects((list) => {
      const src = list.find((x) => x.id === id);
      if (!src) return list;
      const now = new Date().toISOString();
      const copy: Project = { ...structuredClone(src), id: copyId, isDemo: false, createdAt: now, updatedAt: now, product: { ...src.product, name: `${src.product.name} (копия)` } };
      return [copy, ...list];
    });
    return copyId;
  }, []);

  const resetDemo = useCallback(() => {
    setProjects((list) => [buildDemoProject(), ...list.filter((x) => x.id !== 'demo')]);
  }, []);

  return { projects, upsert, update, remove, duplicate, resetDemo };
}

export type ProjectsApi = ReturnType<typeof useProjects>;
