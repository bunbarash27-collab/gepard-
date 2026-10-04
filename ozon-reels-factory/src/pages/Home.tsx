import { useState } from 'react';
import { emptyProduct, newProject } from '../../shared/project';
import type { AIStatus } from '../../shared/types';
import { ProductForm } from '../components/ProductForm';
import { Badge, Button, Progress, useToast } from '../components/ui';
import { runAnalysis } from '../lib/flow';
import { href, navigate } from '../lib/router';
import type { ProjectsApi } from '../lib/store';
import { STATUS_LABEL } from '../../shared/options';
import { scenesLabel } from '../../shared/util';

const DRAFT_KEY = 'orf.draft.v1';

export function HomePage({ store, status }: { store: ProjectsApi; status: AIStatus | null }) {
  const toast = useToast();
  const [product, setProduct] = useState(() => {
    try {
      return { ...emptyProduct(), ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '{}') };
    } catch {
      return emptyProduct();
    }
  });
  const [step, setStep] = useState(-1);
  const demo = store.projects.find((p) => p.id === 'demo');

  const update = (p: typeof product) => {
    setProduct(p);
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(p));
    } catch {
      // draft persistence is best-effort
    }
  };

  const create = async () => {
    if (!product.name.trim()) return toast('Укажите название товара — это минимум для анализа', 'warn');
    const draft = newProject(product);
    store.upsert(draft);
    try {
      const done = await runAnalysis(draft, product, toast, setStep);
      store.upsert(done);
      sessionStorage.removeItem(DRAFT_KEY);
      setProduct(emptyProduct());
      navigate(href.project(done.id, 'analysis'));
    } catch (e) {
      toast(`Не удалось выполнить анализ: ${(e as Error).message}. Черновик сохранён в «Мои проекты».`, 'error');
    } finally {
      setStep(-1);
    }
  };

  return (
    <div className="page home">
      <section className="hero">
        <div className="hero-glow" />
        <Badge tone="pink">AI-инструмент для продавцов Ozon</Badge>
        <h1>OZON AI REELS FACTORY</h1>
        <p className="hero-sub">Преврати карточку товара в продающий короткий ролик за несколько минут</p>
        <div className="hero-flow">
          {['Товар', 'Анализ', '5 концепций', 'Сценарий', 'Кадры', 'Промпты', 'Voiceover', 'Caption'].map((s, i) => (
            <span key={s}>{i > 0 && <i>→</i>}{s}</span>
          ))}
        </div>
      </section>

      {status && !status.connected && <div className="banner banner-demo">ⓘ {status.message}</div>}

      <section className="panel">
        <div className="panel-head">
          <h2>Новый проект</h2>
          <span className="muted">Шаг 1 из 9 · Product</span>
        </div>
        <ProductForm value={product} onChange={update} />
        <div className="cta-row">
          <Button variant="fire" size="lg" onClick={create} loading={step >= 0}>🔥 СОЗДАТЬ РЕКЛАМНУЮ КАМПАНИЮ</Button>
          <span className="muted">AI проанализирует товар и предложит 5 рекламных концепций</span>
        </div>
      </section>

      {demo && (
        <section className="demo-card">
          <img src={demo.product.imageDataUrl} alt="" />
          <div>
            <Badge tone="amber">DEMO PROJECT</Badge>
            <h3>{demo.product.name}</h3>
            <p className="muted">Готовый пример всего workflow: анализ, 5 концепций, сценарий: {scenesLabel(demo.scenes.length)}, раскадровка, промпты, voiceover и social package.</p>
            <div className="row">
              <a className="btn btn-primary btn-md" href={href.project('demo', 'script')}>Открыть демо-проект</a>
              <Badge tone="green">{STATUS_LABEL[demo.status]}</Badge>
            </div>
          </div>
        </section>
      )}

      {step >= 0 && <Progress steps={['Анализ товара', 'Создание 5 рекламных концепций', 'Готово']} current={step} />}
    </div>
  );
}
