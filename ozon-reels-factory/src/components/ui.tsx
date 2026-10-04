import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { copyText } from '../lib/files';

// ───────── Toasts ─────────

type ToastKind = 'ok' | 'info' | 'warn' | 'error';
interface Toast { id: number; kind: ToastKind; text: string }
const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);
  const push = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' || kind === 'warn' ? 6000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ───────── Buttons ─────────

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'fire' | 'soft'; size?: 'sm' | 'md' | 'lg'; loading?: boolean };

export function Button({ variant = 'soft', size = 'md', loading, className = '', children, disabled, ...rest }: BtnProps) {
  return (
    <button className={`btn btn-${variant} btn-${size} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <span className="spinner" aria-hidden />}
      {children}
    </button>
  );
}

export function CopyButton({ text, label = 'Copy', size = 'sm', variant = 'ghost' }: { text: string; label?: string; size?: 'sm' | 'md' | 'lg'; variant?: BtnProps['variant'] }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      onClick={async () => {
        const ok = await copyText(text);
        toast(ok ? 'Скопировано в буфер обмена' : 'Не удалось скопировать', ok ? 'ok' : 'error');
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
    >
      {done ? '✓ Скопировано' : `⧉ ${label}`}
    </Button>
  );
}

// ───────── Modal ─────────

export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', on);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', on);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, text, confirmLabel = 'Подтвердить', danger, onConfirm, onClose }: { title: string; text: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Отмена</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="muted">{text}</p>
    </Modal>
  );
}

// ───────── Misc ─────────

export function Badge({ children, tone = 'default', title }: { children: ReactNode; tone?: 'default' | 'blue' | 'pink' | 'green' | 'amber' | 'red'; title?: string }) {
  return <span className={`badge badge-${tone}`} title={title}>{children}</span>;
}

export function Chips<T extends string | number>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.id)} role="radio" aria-checked={o.id === value} className={`chip ${o.id === value ? 'chip-on' : ''}`} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** `group` renders a div so that button groups (chips) are not swallowed by an implicit <label>. */
export function Field({ label, hint, children, group }: { label: string; hint?: string; children: ReactNode; group?: boolean }) {
  const body = (
    <>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </>
  );
  return group ? <div className="field" role="group" aria-label={label}>{body}</div> : <label className="field">{body}</label>;
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function PromptBox({ title, text }: { title: string; text: string }) {
  return (
    <div className="prompt">
      <div className="prompt-head">
        <span>{title}</span>
        <CopyButton text={text} label={`COPY ${title}`} />
      </div>
      <pre>{text}</pre>
    </div>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}

export function Progress({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="modal-backdrop">
      <div className="modal progress-modal" role="alertdialog" aria-label="Генерация">
        <div className="orb" />
        <h3>AI работает над проектом…</h3>
        <ul className="progress-steps">
          {steps.map((s, i) => (
            <li key={s} className={i < current ? 'done' : i === current ? 'active' : ''}>
              <span>{i < current ? '✓' : i === current ? <span className="spinner" /> : '○'}</span> {s}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
