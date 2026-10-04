import { useState } from 'react';
import { ANGLE_META, STATUS_LABEL } from '../../shared/options';
import type { Project } from '../../shared/types';
import { Badge, Button, ConfirmModal, Empty, useToast } from '../components/ui';
import { fmtDate } from '../lib/files';
import { href, navigate } from '../lib/router';
import type { ProjectsApi } from '../lib/store';

const STATUS_TONE = { draft: 'default', generated: 'blue', ready: 'green' } as const;

export function ProjectsPage({ store }: { store: ProjectsApi }) {
  const toast = useToast();
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const hasDemo = store.projects.some((p) => p.id === 'demo');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>My Projects</h1>
          <p className="muted">Проекты хранятся локально в этом браузере.</p>
        </div>
        <div className="row">
          <Button variant="ghost" onClick={() => { store.resetDemo(); toast(hasDemo ? 'Демо-проект сброшен к исходному' : 'Демо-проект восстановлен'); }}>{hasDemo ? '↺ Сбросить демо' : '★ Восстановить демо'}</Button>
          <a className="btn btn-primary btn-md" href={href.home()}>＋ Новый проект</a>
        </div>
      </div>

      {store.projects.length === 0 ? (
        <Empty icon="🎬" title="Пока нет проектов" text="Создайте первый проект из карточки товара." action={<a className="btn btn-primary btn-md" href={href.home()}>Создать проект</a>} />
      ) : (
        <div className="projects-grid">
          {store.projects.map((p) => {
            const angle = p.angles?.find((a) => a.id === p.selectedAngleId);
            return (
              <article key={p.id} className="project-card" data-testid="project-card">
                <div className="project-thumb">
                  {p.product.imageDataUrl ? <img src={p.product.imageDataUrl} alt="" /> : <span>🎬</span>}
                  {p.isDemo && <Badge tone="amber">DEMO</Badge>}
                </div>
                <div className="project-body">
                  <h3 title={p.product.name}>{p.product.name || 'Без названия'}</h3>
                  <div className="project-meta">
                    <span>{fmtDate(p.createdAt)}</span>
                    <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]}</Badge>
                  </div>
                  <div className="project-angle">{angle ? `${ANGLE_META[angle.type].icon} ${ANGLE_META[angle.type].label} · ${angle.title}` : 'Концепция не выбрана'}</div>
                  <div className="row">
                    <Button size="sm" variant="primary" onClick={() => navigate(href.project(p.id, p.scenes.length ? 'script' : p.analysis ? 'analysis' : 'product'))}>Open</Button>
                    <Button size="sm" onClick={() => { store.duplicate(p.id); toast('Копия проекта создана'); }}>Duplicate</Button>
                    <Button size="sm" variant="danger" onClick={() => setToDelete(p)}>Delete</Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {toDelete && (
        <ConfirmModal
          title="Удалить проект?"
          text={`«${toDelete.product.name}» будет удалён без возможности восстановления.`}
          confirmLabel="Удалить"
          danger
          onConfirm={() => { store.remove(toDelete.id); toast('Проект удалён'); }}
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
