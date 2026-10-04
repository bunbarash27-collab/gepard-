import { useRef, useState } from 'react';
import type { ProductInput } from '../../shared/types';
import { api } from '../lib/api';
import { resizeImage } from '../lib/files';
import { Button, Field, useToast } from './ui';

export function ProductForm({ value, onChange, compact }: { value: ProductInput; onChange: (p: ProductInput) => void; compact?: boolean }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [ozonMsg, setOzonMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof ProductInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });

  const parse = async () => {
    if (!value.ozonUrl.trim()) return toast('Вставьте ссылку на товар Ozon', 'warn');
    setParsing(true);
    try {
      const r = await api.parseOzon(value.ozonUrl);
      setOzonMsg({ ok: r.ok, text: r.message });
      if (r.ok && r.name) onChange({ ...value, name: r.name });
    } catch (e) {
      setOzonMsg({ ok: false, text: `${(e as Error).message}. Заполните данные товара вручную.` });
    } finally {
      setParsing(false);
    }
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Нужен файл изображения (JPG, PNG, WebP)', 'warn');
    try {
      onChange({ ...value, imageDataUrl: await resizeImage(file) });
      toast('Фото загружено — оно станет визуальным reference для Product Lock');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <div className="product-form">
      <div className={`source-grid ${compact ? 'compact' : ''}`}>
        <div className="source-tile">
          <div className="source-title">🔗 ВСТАВИТЬ ССЫЛКУ НА OZON</div>
          <div className="row">
            <input className="input" placeholder="https://www.ozon.ru/product/..." value={value.ozonUrl} onChange={set('ozonUrl')} onKeyDown={(e) => e.key === 'Enter' && parse()} aria-label="Ссылка на Ozon" />
            <Button onClick={parse} loading={parsing}>Получить</Button>
          </div>
          {ozonMsg && <div className={`note ${ozonMsg.ok ? 'note-ok' : 'note-warn'}`}>{ozonMsg.text}</div>}
          {!ozonMsg && <div className="field-hint">Автопарсинг Ozon работает в режиме best-effort. Если страница недоступна — заполните поля ниже.</div>}
        </div>
        <div className="or">или</div>
        <div
          className="source-tile drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
        >
          <div className="source-title">📷 ЗАГРУЗИТЬ ФОТО ТОВАРА</div>
          <div className="upload">
            {value.imageDataUrl ? <img src={value.imageDataUrl} alt="Фото товара" /> : <div className="upload-ph">JPG / PNG / WebP<br />перетащите сюда</div>}
            <div className="upload-actions">
              <Button onClick={() => fileRef.current?.click()}>{value.imageDataUrl ? 'Заменить фото' : 'Выбрать файл'}</Button>
              {value.imageDataUrl && <Button variant="ghost" onClick={() => onChange({ ...value, imageDataUrl: undefined })}>Удалить</Button>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
      </div>

      <div className="form-grid">
        <Field label="Название товара *"><input className="input" value={value.name} onChange={set('name')} placeholder="Например: Органайзер для кухни" /></Field>
        <Field label="Категория"><input className="input" value={value.category} onChange={set('category')} placeholder="Например: Товары для дома" /></Field>
        <Field label="Цена, ₽"><input className="input" value={value.price} onChange={set('price')} placeholder="1290" inputMode="decimal" /></Field>
        <Field label="Целевая аудитория" hint="Можно оставить пустым — AI предложит сам"><input className="input" value={value.audience} onChange={set('audience')} placeholder="Например: молодые мамы 25–35 лет" /></Field>
        <Field label="Главные характеристики" hint="Каждая с новой строки"><textarea className="input" rows={4} value={value.specs} onChange={set('specs')} placeholder={'Материал: ...\nРазмер: ...'} /></Field>
        <Field label="Преимущества" hint="Каждое с новой строки"><textarea className="input" rows={4} value={value.benefits} onChange={set('benefits')} placeholder={'Экономит время\nЛегко мыть'} /></Field>
        <Field label="Что нельзя обещать в рекламе"><textarea className="input" rows={3} value={value.restrictions} onChange={set('restrictions')} placeholder={'Не обещать лечебный эффект\nНе сравнивать с конкурентами'} /></Field>
        <Field label="Внешний вид товара (для Product Lock)" hint="Цвет, форма, упаковка, логотип — чтобы AI не менял товар"><textarea className="input" rows={3} value={value.appearance} onChange={set('appearance')} placeholder="Белая коробка с синим логотипом, матовый чёрный корпус…" /></Field>
      </div>
    </div>
  );
}
