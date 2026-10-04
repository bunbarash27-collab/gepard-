import { useEffect, useState } from 'react';

export type StepId = 'product' | 'analysis' | 'angles' | 'script' | 'storyboard' | 'prompts' | 'voiceover' | 'social' | 'export';

export type Route =
  | { name: 'home' }
  | { name: 'projects' }
  | { name: 'project'; id: string; step: StepId };

export const STEPS: { id: StepId; label: string }[] = [
  { id: 'product', label: 'Product' },
  { id: 'analysis', label: 'Analyze' },
  { id: 'angles', label: '5 Ad Angles' },
  { id: 'script', label: 'Script' },
  { id: 'storyboard', label: 'Storyboard' },
  { id: 'prompts', label: 'Prompts' },
  { id: 'voiceover', label: 'Voiceover' },
  { id: 'social', label: 'Social Package' },
  { id: 'export', label: 'Export' },
];

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'projects') return { name: 'projects' };
  if (parts[0] === 'p' && parts[1]) {
    const step = (STEPS.find((s) => s.id === parts[2])?.id ?? 'product') as StepId;
    return { name: 'project', id: decodeURIComponent(parts[1]), step };
  }
  return { name: 'home' };
}

export const href = {
  home: () => '#/',
  projects: () => '#/projects',
  project: (id: string, step: StepId = 'product') => `#/p/${encodeURIComponent(id)}/${step}`,
};

export function navigate(to: string) {
  if (window.location.hash !== to) window.location.hash = to;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parse(window.location.hash));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
