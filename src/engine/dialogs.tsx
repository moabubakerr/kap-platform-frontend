/**
 * Shared v35 dialogs: form (optionally a multi-step wizard), confirm, and
 * show-once secret. Port of the prototype's iamF / iamCf / iamSecret.
 *
 *   const d = useDialogs();
 *   d.form('Create group', [{ k: 'n', type: 'text', label: 'Name' }], 'Create', (v) => v.n ? '' : 'Enter a name.');
 *   d.wizard({ title, steps, finishL, fields: (step, v, set) => [...], validate: (step, v) => '', finish: (v) => '' });
 *   d.confirm('Delete group', 'This cannot be undone.', [], 'Delete', () => ...);
 *   d.secret('Credential for etl-nightly', 'kap_live_…');
 *
 * A save/finish function returns an error message ('' = success, dialog closes).
 */
import * as React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Check, Copy, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Diagram } from './Diagram';
import type { DiagramSpec } from './types';

export type FormValues = Record<string, any>;

export type FormField =
  | { type: 'text' | 'num'; k: string; label: string; val?: string; ph?: string; hint?: string; ro?: boolean }
  | { type: 'select'; k: string; label: string; val?: string; opts: string[]; hint?: string }
  | { type: 'chips'; k: string; label: string; val?: string[]; opts: string[]; hint?: string }
  | { type: 'textarea'; k: string; label: string; val?: string; ph?: string; hint?: string; rows?: number }
  | { type: 'note'; label?: string; text: string; tone?: 'ok' | 'bad' | 'warn' | 'info' }
  | { type: 'button'; label: string; click: () => void }
  | { type: 'kv'; label?: string; rows: [string, unknown][] }
  | { type: 'dgm'; label?: string; dgm: DiagramSpec };

export interface WizardSpec {
  title: string;
  steps: string[];
  finishL: string;
  initial?: FormValues;
  fields: (step: number, v: FormValues, set: (k: string, val: any) => void) => FormField[];
  validate: (step: number, v: FormValues) => string;
  finish: (v: FormValues) => string;
}

type FormState = { title: string; fields: FormField[]; saveL: string; save: (v: FormValues) => string; v: FormValues; err: string } | { wiz: WizardSpec; v: FormValues; step: number; err: string };
type ConfirmState = { title: string; body: string; items: { a: string; b?: string; c?: string }[]; cta: string; fn: () => void };
type SecretState = { title: string; tok: string; sub?: string };

interface Dialogs {
  form: (title: string, fields: FormField[], saveL: string, save: (v: FormValues) => string) => void;
  wizard: (spec: WizardSpec) => void;
  confirm: (title: string, body: string, items: ConfirmState['items'], cta: string, fn: () => void) => void;
  secret: (title: string, tok: string, sub?: string) => void;
  /** success banner (the prototype's toast) */
  toast: (msg: string) => void;
}

const Ctx = React.createContext<Dialogs | null>(null);

export function useDialogs(): Dialogs {
  const d = React.useContext(Ctx);
  if (!d) throw new Error('useDialogs outside <DialogsProvider>');
  return d;
}

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [form, setForm] = React.useState<FormState | null>(null);
  const [confirm, setConfirm] = React.useState<ConfirmState | null>(null);
  const [secret, setSecret] = React.useState<SecretState | null>(null);

  const api = React.useMemo<Dialogs>(
    () => ({
      form: (title, fields, saveL, save) =>
        setForm({ title, fields, saveL, save, err: '', v: Object.fromEntries(fields.filter((f): f is Extract<FormField, { k: string }> => 'k' in f).map((f) => [f.k, f.val ?? (f.type === 'chips' ? [] : '')])) }),
      wizard: (wiz) => setForm({ wiz, v: { ...(wiz.initial ?? {}) }, step: 0, err: '' }),
      confirm: (title, body, items, cta, fn) => setConfirm({ title, body, items, cta, fn }),
      secret: (title, tok, sub) => setSecret({ title, tok, sub }),
      toast: (msg) => toast.success(msg),
    }),
    [],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {form && <FormDialog state={form} set={setForm} />}
      {confirm && (
        <Shell title={confirm.title} width={500} onClose={() => setConfirm(null)} footer={
          <>
            <Button size="sm" variant="outline" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button size="sm" variant="danger" onClick={() => { const f = confirm.fn; setConfirm(null); f(); }}>{confirm.cta}</Button>
          </>
        }>
          <div className="text-[13.5px]">{confirm.body}</div>
          {confirm.items.length > 0 && (
            <div className="max-h-[220px] overflow-auto rounded-sm border border-line-subtle">
              {confirm.items.map((u, i) => (
                <div key={i} className="flex gap-2.5 border-b border-line-subtle px-2.5 py-1.5 text-[12.5px] last:border-b-0">
                  <span className="w-[150px] font-mono">{u.a}</span>
                  <span className="w-[120px] text-ink-muted">{u.b}</span>
                  <span className="text-ink-muted">{u.c}</span>
                </div>
              ))}
            </div>
          )}
        </Shell>
      )}
      {secret && (
        <Shell title={secret.title} width={520} onClose={() => setSecret(null)} footer={<Button size="sm" onClick={() => setSecret(null)}>Done</Button>}>
          <div className="flex items-start gap-2 rounded-sm bg-surface-sunken px-3 py-2.5 font-mono text-[13px] [overflow-wrap:anywhere]">
            <span className="flex-1">{secret.tok}</span>
            <button type="button" aria-label="Copy" onClick={() => { void navigator.clipboard?.writeText(secret.tok); toast.success('Copied'); }} className="text-ink-muted hover:text-brand">
              <Copy size={14} />
            </button>
          </div>
          <div className="text-warning-fg">Copy it now. It won’t be shown again.</div>
          {secret.sub && <div className="text-[12.5px] text-ink-muted">{secret.sub}</div>}
        </Shell>
      )}
    </Ctx.Provider>
  );
}

function Shell({ title, width, onClose, footer, children }: { title: string; width: number; onClose: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-[rgba(31,26,28,.35)]" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-[91] flex max-h-[calc(100vh-64px)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg bg-surface shadow-xl outline-none" style={{ width }}>
          <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-4">
            <Dialog.Title className="text-[17px] font-semibold text-ink-strong">{title}</Dialog.Title>
            <button type="button" aria-label="Close" onClick={onClose} className="flex rounded p-1 text-ink-muted hover:text-ink-strong">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-3.5 overflow-auto px-5 py-4">{children}</div>
          <div className="flex justify-end gap-2 border-t border-line-subtle px-5 py-3.5">{footer}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const inputCls = 'h-9 w-full rounded-card border border-line bg-surface px-3 text-[13.5px] text-ink-body outline-none focus-visible:shadow-focus disabled:bg-surface-sunken disabled:text-ink-muted';
const TONE: Record<string, [string, string]> = { ok: ['var(--success-bg)', 'var(--success-fg)'], bad: ['var(--danger-bg)', 'var(--danger-fg)'], warn: ['var(--warning-bg)', 'var(--warning-fg)'], info: ['var(--info-bg)', 'var(--info)'] };

function FieldView({ f, v, set }: { f: FormField; v: FormValues; set: (k: string, val: any) => void }) {
  const hint = 'hint' in f && f.hint ? <div className="mt-1 text-xs text-ink-muted">{f.hint}</div> : null;
  switch (f.type) {
    case 'text':
    case 'num':
      return (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-strong">{f.label}</span>
          <input type={f.type === 'num' ? 'number' : 'text'} value={v[f.k] ?? ''} placeholder={f.ph} disabled={f.ro} onChange={(e) => set(f.k, e.target.value)} className={inputCls} />
          {hint}
        </label>
      );
    case 'textarea':
      return (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-strong">{f.label}</span>
          <textarea value={v[f.k] ?? ''} placeholder={f.ph} rows={f.rows ?? 5} onChange={(e) => set(f.k, e.target.value)} className="resize-y rounded-card border border-line bg-surface px-3 py-2 text-[13px] outline-none focus-visible:shadow-focus" />
          {hint}
        </label>
      );
    case 'select':
      return (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink-strong">{f.label}</span>
          <select value={v[f.k] ?? ''} onChange={(e) => set(f.k, e.target.value)} className={inputCls}>
            {f.opts.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {hint}
        </label>
      );
    case 'chips': {
      const val: string[] = v[f.k] ?? [];
      return (
        <div>
          <div className="mb-1.5 text-[13px] font-medium text-ink-strong">{f.label}</div>
          <div className="flex flex-wrap gap-1.5">
            {f.opts.map((o) => {
              const on = val.includes(o);
              return (
                <button key={o} type="button" onClick={() => set(f.k, on ? val.filter((x) => x !== o) : [...val, o])} className={cn('inline-flex h-[30px] select-none items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px]', on ? 'border-brand bg-brand-tint' : 'border-line bg-surface')}>
                  <span className={on ? 'text-brand' : 'text-ink-muted'}>{on ? <Check size={12} /> : <Plus size={12} />}</span>
                  {o}
                </button>
              );
            })}
          </div>
          {hint}
        </div>
      );
    }
    case 'note': {
      const [bg, fg] = TONE[f.tone ?? 'info'];
      return (
        <div className="rounded-sm px-3 py-2.5 text-[13px] leading-[1.45]" style={{ background: bg, color: fg }}>
          {f.label && <div className="mb-0.5 font-semibold">{f.label}</div>}
          {f.text}
        </div>
      );
    }
    case 'button':
      return (
        <Button size="sm" variant="outline" onClick={f.click}>
          {f.label}
        </Button>
      );
    case 'kv':
      return (
        <div className="rounded-sm border border-line-subtle">
          {f.label && <div className="border-b border-line-subtle bg-surface-sunken px-3 py-2 text-[13px] font-semibold">{f.label}</div>}
          {f.rows.map(([k, val], i) => (
            <div key={i} className="grid gap-3 border-t border-line-subtle px-3 py-1.5 text-[13px] first:border-t-0" style={{ gridTemplateColumns: '170px minmax(0,1fr)' }}>
              <span className="text-ink-muted">{k}</span>
              <span className="[overflow-wrap:anywhere]">{val == null || val === '' ? '—' : String(val)}</span>
            </div>
          ))}
        </div>
      );
    case 'dgm':
      return (
        <div>
          {f.label && <div className="mb-1.5 text-[13px] font-semibold">{f.label}</div>}
          <Diagram spec={f.dgm} />
        </div>
      );
  }
}

function FormDialog({ state, set }: { state: FormState; set: React.Dispatch<React.SetStateAction<FormState | null>> }) {
  const setV = (k: string, val: any) => set((s) => (s ? ({ ...s, err: '', v: { ...s.v, [k]: val } } as FormState) : s));
  const close = () => set(null);
  const isWiz = 'wiz' in state;
  const fields = isWiz ? state.wiz.fields(state.step, state.v, setV) : state.fields;
  const title = isWiz ? state.wiz.title : state.title;
  const simple = !isWiz && fields.length <= 4 && !fields.some((f) => f.type === 'chips');
  const width = simple ? 480 : isWiz ? (fields.some((f) => f.type === 'dgm') ? 920 : 700) : 600;
  const last = isWiz && state.step === state.wiz.steps.length - 1;
  const saveL = isWiz ? (last ? state.wiz.finishL : 'Next') : state.saveL;

  const save = () => {
    if (isWiz) {
      const e = state.wiz.validate(state.step, state.v);
      if (e) return set({ ...state, err: e });
      if (!last) return set({ ...state, step: state.step + 1, err: '' });
      const e2 = state.wiz.finish(state.v);
      return e2 ? set({ ...state, err: e2 }) : close();
    }
    const e = state.save(state.v);
    return e ? set({ ...state, err: e }) : close();
  };

  return (
    <Shell
      title={title}
      width={width}
      onClose={close}
      footer={
        <>
          <Button size="sm" variant="outline" onClick={close}>
            Cancel
          </Button>
          {isWiz && state.step > 0 && (
            <Button size="sm" variant="outline" onClick={() => set({ ...state, step: state.step - 1, err: '' })}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={save}>
            {saveL}
          </Button>
        </>
      }
    >
      {isWiz && (
        <div className="mb-0.5 flex flex-wrap gap-1.5">
          {state.wiz.steps.map((l, i) => (
            <span key={l} className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-[13px] px-2.5 text-xs', i === state.step ? 'bg-brand font-semibold text-white' : i < state.step ? 'bg-brand-tint font-medium text-brand' : 'bg-surface-sunken font-medium text-ink-muted')}>
              {i + 1} · {l}
            </span>
          ))}
        </div>
      )}
      {fields.map((f, i) => (
        <FieldView key={i} f={f} v={state.v} set={setV} />
      ))}
      {state.err && <div className="rounded-sm bg-danger-bg px-3 py-2.5 text-[13px] text-danger-fg">{state.err}</div>}
    </Shell>
  );
}
