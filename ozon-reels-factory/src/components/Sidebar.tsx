import { useState } from 'react';
import type { AIStatus, Project } from '../../shared/types';
import { href, type Route } from '../lib/router';
import { Modal } from './ui';

export function Sidebar({ route, status, projects }: { route: Route; status: AIStatus | null; projects: Project[] }) {
  const [help, setHelp] = useState(false);
  const recent = projects.filter((p) => !p.isDemo).slice(0, 4);
  const active = (name: string, id?: string) => (route.name === name && (!id || (route.name === 'project' && route.id === id)) ? 'nav-on' : '');
  return (
    <aside className="sidebar">
      <a className="logo" href={href.home()}>
        <span className="logo-mark">▶</span>
        <span className="logo-text">OZON AI<br /><b>REELS FACTORY</b></span>
      </a>
      <nav className="nav">
        <a className={`nav-item ${active('home')}`} href={href.home()}><span>＋</span> Новый проект</a>
        <a className={`nav-item ${active('projects')}`} href={href.projects()}><span>▤</span> Мои проекты <em>{projects.length}</em></a>
        <a className={`nav-item ${active('project', 'demo')}`} href={href.project('demo', 'script')}><span>★</span> Демо-проект</a>
      </nav>
      {recent.length > 0 && (
        <div className="nav-recent">
          <div className="nav-caption">Недавние</div>
          {recent.map((p) => (
            <a key={p.id} className={`nav-item nav-sub ${active('project', p.id)}`} href={href.project(p.id, p.scenes.length ? 'script' : 'product')} title={p.product.name}>
              {p.product.name || 'Без названия'}
            </a>
          ))}
        </div>
      )}
      <button className={`ai-status ${status?.connected ? 'ai-on' : 'ai-off'}`} onClick={() => setHelp(true)}>
        <span className="dot" />
        <span>
          <b>{status ? (status.connected ? 'AI подключен' : 'Demo mode') : 'Проверка AI…'}</b>
          <small>{status?.connected ? status.model : 'Как подключить AI'}</small>
        </span>
      </button>
      {help && (
        <Modal title="Подключение AI" onClose={() => setHelp(false)}>
          <p>{status?.message}</p>
          <p className="muted">Ключи хранятся только на сервере в переменных окружения и никогда не передаются в браузер. Без ключа приложение работает на демонстрационном движке шаблонов.</p>
          <pre className="code">{`# ozon-reels-factory/.env
OPENAI_API_KEY=sk-...        # или
GEMINI_API_KEY=...
AI_PROVIDER=openai           # openai | gemini (необязательно)
OPENAI_MODEL=gpt-4o-mini
GEMINI_MODEL=gemini-2.5-flash`}</pre>
          <p className="muted">После изменения .env перезапустите сервер.</p>
        </Modal>
      )}
    </aside>
  );
}
