import { useState } from 'react';
import { ANGLE_META } from '../../../shared/options';
import { ProductForm } from '../../components/ProductForm';
import { Badge, Button, Card, Empty, Progress } from '../../components/ui';
import { runAnalysis } from '../../lib/flow';
import type { StepProps } from '../Workspace';

export function ProductStep({ project, save, toast, go }: StepProps) {
  const [product, setProduct] = useState(project.product);
  const [step, setStep] = useState(-1);
  const dirty = JSON.stringify(product) !== JSON.stringify(project.product);

  const analyze = async () => {
    if (!product.name.trim()) return toast('Укажите название товара', 'warn');
    try {
      const done = await runAnalysis(project, product, toast, setStep);
      save(() => done);
      go('analysis');
    } catch (e) {
      toast(`Ошибка анализа: ${(e as Error).message}`, 'error');
    } finally {
      setStep(-1);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Product</h2>
        <span className="muted">Данные товара — основа анализа, сценария и Product Lock</span>
      </div>
      <ProductForm value={product} onChange={setProduct} compact />
      <div className="cta-row">
        <Button variant="fire" size="lg" onClick={analyze} loading={step >= 0}>{project.analysis ? '🔥 Обновить анализ и концепции' : '🔥 СОЗДАТЬ РЕКЛАМНУЮ КАМПАНИЮ'}</Button>
        <Button disabled={!dirty} onClick={() => { save((p) => ({ ...p, product })); toast('Данные товара сохранены'); }}>Сохранить без анализа</Button>
        {project.scenes.length > 0 && <span className="muted">Сценарий сохранится; концепции будут пересозданы.</span>}
      </div>
      {step >= 0 && <Progress steps={['Анализ товара', 'Создание 5 рекламных концепций', 'Готово']} current={step} />}
    </div>
  );
}

export function AnalysisStep({ project, go }: StepProps) {
  const a = project.analysis;
  if (!a) return <Empty icon="🔎" title="Анализа пока нет" text="Заполните данные товара и запустите анализ." action={<Button variant="primary" onClick={() => go('product')}>К товару</Button>} />;
  const rows: [string, string][] = [
    ['Название', a.name], ['Категория', a.category], ['Целевая аудитория', a.audience], ['Основная проблема покупателя', a.pain],
    ['Главное желание покупателя', a.desire], ['Главное преимущество товара', a.mainBenefit], ['Ключевой selling point', a.sellingPoint],
  ];
  return (
    <div className="analysis">
      <Card className="span-2">
        <h2 className="card-title">PRODUCT ANALYSIS</h2>
        <dl className="kv">
          {rows.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
          <div><dt>Основные возражения</dt><dd><ul>{a.objections.map((o) => <li key={o}>{o}</li>)}</ul></dd></div>
          <div><dt>Причины купить сейчас</dt><dd><ul>{a.reasonsNow.map((o) => <li key={o}>{o}</li>)}</ul></dd></div>
        </dl>
      </Card>
      <Card className="risk-card">
        <h2 className="card-title">⚠️ РЕКЛАМНЫЕ ОГРАНИЧЕНИЯ</h2>
        {a.risks.length > 0 ? (
          <>
            <p className="muted">Найдены рискованные обещания в данных товара. Они не используются в сценарии:</p>
            <ul className="risks">
              {a.risks.map((r, i) => (
                <li key={i}>
                  <div><Badge tone="red">«{r.phrase}»</Badge> <small className="muted">{r.source}</small></div>
                  <div>{r.reason}</div>
                  {r.safeAlternative && <div className="muted">Безопаснее: «{r.safeAlternative}»</div>}
                </li>
              ))}
            </ul>
          </>
        ) : <p className="note note-ok">Рискованных формулировок в данных товара не найдено.</p>}
        <h4>Правила для рекламы этого товара</h4>
        <ul className="rules">{a.rules.map((r) => <li key={r}>{r}</li>)}</ul>
      </Card>
      <div className="cta-row span-3">
        <Button variant="primary" size="lg" onClick={() => go('angles')}>Смотреть 5 рекламных концепций →</Button>
      </div>
    </div>
  );
}

export function AnglesStep({ project, save, go, toast }: StepProps) {
  const angles = project.angles ?? [];
  return (
    <div>
      <div className="panel-head">
        <h2>FIVE AD ANGLES</h2>
        <span className="muted">Выберите концепцию — для неё будет создан сценарий ролика</span>
      </div>
      <div className="angles">
        {angles.map((a, i) => {
          const selected = a.id === project.selectedAngleId;
          return (
            <article key={a.id} className={`angle-card ${selected ? 'angle-on' : ''}`} data-testid={`angle-${a.type}`}>
              <div className="angle-top">
                <span className="angle-num">{i + 1}</span>
                <Badge tone="pink">{ANGLE_META[a.type].icon} {ANGLE_META[a.type].label}</Badge>
                {selected && <Badge tone="green">Выбрано</Badge>}
              </div>
              <h3>{a.title}</h3>
              <div className="angle-hook">«{a.hook}»</div>
              <dl className="kv small">
                <div><dt>Основная идея</dt><dd>{a.idea}</dd></div>
                <div><dt>Эмоция</dt><dd>{a.emotion}</dd></div>
                <div><dt>Почему может работать</dt><dd>{a.whyItWorks}</dd></div>
                <div><dt>Аудитория</dt><dd>{a.audience}</dd></div>
              </dl>
              <Button
                variant={selected ? 'soft' : 'primary'}
                onClick={() => {
                  save((p) => ({ ...p, selectedAngleId: a.id }));
                  if (project.scenes.length && project.scriptAngleId !== a.id) toast('Концепция выбрана. Сгенерируйте сценарий заново, чтобы применить её.', 'info');
                  go('script');
                }}
              >
                {selected ? 'Открыть сценарий →' : 'СОЗДАТЬ РОЛИК'}
              </Button>
            </article>
          );
        })}
      </div>
    </div>
  );
}
