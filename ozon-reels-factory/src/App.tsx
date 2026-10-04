import { useCallback, useEffect, useState } from 'react';
import type { AIStatus } from '../shared/types';
import { Sidebar } from './components/Sidebar';
import { useToast } from './components/ui';
import { api } from './lib/api';
import { href, navigate, useRoute } from './lib/router';
import { consumeFirstRun, useProjects } from './lib/store';
import { HomePage } from './pages/Home';
import { ProjectsPage } from './pages/Projects';
import { Workspace } from './pages/Workspace';

export default function App() {
  const route = useRoute();
  const toast = useToast();
  const onStoreError = useCallback((m: string) => toast(m, 'error'), [toast]);
  const store = useProjects(onStoreError);
  const [status, setStatus] = useState<AIStatus | null>(null);

  useEffect(() => {
    api.status().then(setStatus).catch(() => setStatus({ mode: 'demo', connected: false, message: 'Сервер недоступен. Используется демонстрационный режим.' }));
    if (consumeFirstRun() && !window.location.hash.replace(/^#\/?/, '')) navigate(href.project('demo', 'script'));
  }, []);

  const current = route.name === 'project' ? store.projects.find((p) => p.id === route.id) : undefined;

  return (
    <div className="app">
      <Sidebar route={route} status={status} projects={store.projects} />
      <main className="main">
        {route.name === 'home' && <HomePage store={store} status={status} />}
        {route.name === 'projects' && <ProjectsPage store={store} />}
        {route.name === 'project' && (current
          ? <Workspace key={current.id} project={current} step={route.step} store={store} status={status} />
          : <div className="page"><div className="empty"><div className="empty-icon">🔍</div><h3>Проект не найден</h3><p className="muted">Возможно, он был удалён.</p><a className="btn btn-primary btn-md" href={href.projects()}>Мои проекты</a></div></div>)}
      </main>
    </div>
  );
}
