import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, ChevronLeft, ChevronRight, Database, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Page, WizardLayout } from '@/components/common/layout';
import { KeyValues } from '@/components/common/primitives';
import { JsonViewer } from '@/components/common/JsonViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ProjectPage, useBase } from '@/app/shell/AppShell';
import { useCrumbs } from '@/app/shell/crumbs';
import { PROVIDERS, WIZARD_LOCAL_TOOLS, WIZARD_STEPS } from '@/mocks/agents';
import { readOnly } from './shared';

const STEP_INFO: { title: string; desc: (s: State) => string }[] = [
  { title: 'Basics', desc: () => 'Name the agent and say what it is for. The name is used in API calls and cannot be changed later.' },
  { title: 'Model', desc: () => 'Pick the model provider the agent plans and writes with, and the limits each job runs under.' },
  { title: 'Knowledge', desc: () => 'Attach the collections the agent may read. Tools only see data in attached collections.' },
  { title: 'Tools', desc: (s) => `Choose what the agent may call while planning. Each call counts against the tool-call limit of ${s.limits.toolCalls}.` },
  { title: 'System instructions', desc: () => 'Instructions the agent receives before every job. Keep them short and specific.' },
  { title: 'Access', desc: () => 'Groups that can run or manage this agent. Users get access through their group membership.' },
  { title: 'Review + create', desc: () => 'Check the configuration. Nothing is created until you confirm.' },
];

const OXFORD = [
  { name: 'EconomicData', description: 'Public macro data series' },
  { name: 'EconomicAnalysis', description: 'Forecasts and narrative analysis' },
];

const GROUPS = [
  { name: 'catalog_readers', role: 'analyst', allows: 'Run jobs, read own jobs and traces', members: 'sceai_analyst, api:dashboards-svc' },
  { name: 'tenant_admins', role: 'administrator', allows: 'Run, edit, delete, manage access', members: 'sceai_admin' },
];

type State = {
  name: string;
  description: string;
  provider: string;
  limits: { timeout: number; retries: number; requests: number; toolCalls: number; priority: number; inFlight: number };
  collections: string[];
  local: string[];
  docs: boolean;
  oxford: string[];
  prompt: string;
  groups: string[];
};

const INITIAL: State = {
  name: 'sceai_indicators_tourism',
  description: 'Tourism indicators with Oxford Economics context',
  provider: 'agent_default',
  limits: { timeout: 180, retries: 1, requests: 20, toolCalls: 15, priority: 3, inFlight: 3 },
  collections: ['sceai_indicators'],
  local: WIZARD_LOCAL_TOOLS.map((t) => t.name),
  docs: true,
  oxford: ['EconomicData'],
  prompt:
    'You answer questions about SCEAI tourism indicators.\nAlways resolve indicators with find_indicator before reading values.\nQuote actual and target values with period and unit.\nOnly send public-domain questions to Oxford Economics. Never include\nlocal indicator codes, values or tenant information.',
  groups: ['catalog_readers', 'tenant_admins'],
};

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function CreateAgentPage() {
  return (
    <ProjectPage resource="agents">
      <Wizard />
    </ProjectPage>
  );
}

function Wizard() {
  const base = useBase();
  const nav = useNavigate();
  const [step, setStep] = React.useState(3);
  const [s, setS] = React.useState<State>(INITIAL);
  useCrumbs(['Create agent']);
  const set = <K extends keyof State>(k: K, v: State[K]) => setS((p) => ({ ...p, [k]: v }));
  const last = step === WIZARD_STEPS.length - 1;

  return (
    <Page className="max-w-[1240px] gap-4 pt-3">
      <div>
        <h1 className="h1">Create agent</h1>
        <p className="mt-1 text-ink-muted">Configure a new planner_and_executor agent for SCEAI. Nothing is created until you confirm on the last step.</p>
      </div>
      <WizardLayout
        steps={WIZARD_STEPS}
        current={step}
        onStep={setStep}
        title={
          <div>
            <div className="text-xs text-ink-muted">
              Step {step + 1} of {WIZARD_STEPS.length}
            </div>
            <div className="mt-0.5 text-lg font-semibold text-ink-strong">{STEP_INFO[step].title}</div>
            <div className="mt-1 text-[13.5px] text-ink-muted">{STEP_INFO[step].desc(s)}</div>
          </div>
        }
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" onClick={() => nav(`${base}/agents`)}>
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" disabled={step === 0} onClick={() => setStep(step - 1)}>
                <ChevronLeft size={15} />
                Back
              </Button>
              {last ? (
                <Button onClick={readOnly}>
                  <Check size={15} />
                  Create agent
                </Button>
              ) : (
                <Button onClick={() => setStep(step + 1)}>
                  Next: {WIZARD_STEPS[step + 1]}
                  <ChevronRight size={15} />
                </Button>
              )}
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-[22px]">
          {step === 0 && <Basics s={s} set={set} />}
          {step === 1 && <Model s={s} set={set} />}
          {step === 2 && <Knowledge s={s} set={set} />}
          {step === 3 && <Tools s={s} set={set} />}
          {step === 4 && <Instructions s={s} set={set} />}
          {step === 5 && <Access s={s} set={set} />}
          {step === 6 && <Review s={s} onEdit={setStep} />}
        </div>
      </WizardLayout>
    </Page>
  );
}

type StepProps = { s: State; set: <K extends keyof State>(k: K, v: State[K]) => void };

// ---------------------------------------------------------------------------

const inputCls = 'h-9 w-full rounded-card border border-line bg-surface px-3 text-[13px] text-ink-strong outline-none focus:border-brand focus:shadow-focus';

function FieldRow({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex max-w-[560px] flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-ink-strong">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

function Basics({ s, set }: StepProps) {
  const valid = /^[a-z][a-z0-9_]{2,62}$/.test(s.name);
  return (
    <>
      <FieldRow label="Name" hint={valid ? 'Lowercase letters, digits and underscores.' : <span className="text-danger-fg">Use 3–63 lowercase letters, digits or underscores, starting with a letter.</span>}>
        <input value={s.name} onChange={(e) => set('name', e.target.value)} className={cn(inputCls, 'font-mono text-[12.5px]')} />
      </FieldRow>
      <FieldRow label="Description">
        <input value={s.description} onChange={(e) => set('description', e.target.value)} className={inputCls} />
      </FieldRow>
      <div className="grid max-w-[560px] gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <FieldRow label="Type" hint="The agent plans its own tool calls, then writes the answer.">
          <div className={cn(inputCls, 'flex items-center bg-surface-sunken font-mono text-[12.5px] text-ink-body')}>planner_and_executor</div>
        </FieldRow>
        <FieldRow label="Project">
          <div className={cn(inputCls, 'flex items-center bg-surface-sunken text-ink-body')}>SCEAI</div>
        </FieldRow>
      </div>
    </>
  );
}

function Radio({ on }: { on: boolean }) {
  return (
    <span className={cn('mt-0.5 grid h-4 w-4 flex-none place-items-center rounded-full border-[1.5px]', on ? 'border-brand' : 'border-line-strong')}>
      {on && <span className="h-2 w-2 rounded-full bg-brand" />}
    </span>
  );
}

function Model({ s, set }: StepProps) {
  const chat = PROVIDERS.filter((p) => p.kind.startsWith('Chat'));
  const L = s.limits;
  const lim: [keyof State['limits'], string, string][] = [
    ['timeout', 'Timeout', 's'],
    ['retries', 'Max retries', ''],
    ['requests', 'Request limit', ''],
    ['toolCalls', 'Tool-call limit', ''],
    ['priority', 'Task priority', ''],
    ['inFlight', 'Max in-flight', ''],
  ];
  return (
    <>
      <div>
        <div className="mb-2.5 font-semibold text-ink-strong">Model provider</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
          {chat.map((p) => {
            const on = s.provider === p.name;
            const tools = p.kind.includes('tool calling');
            return (
              <button
                key={p.name}
                type="button"
                disabled={!tools}
                onClick={() => set('provider', p.name)}
                className={cn('flex items-start gap-2.5 rounded-sm border px-3 py-2.5 text-left', on ? 'border-brand bg-[#FCF7F8]' : 'border-line', !tools && 'cursor-not-allowed opacity-60')}
              >
                <Radio on={on} />
                <span>
                  <span className="block font-mono text-[12.5px] text-ink-strong">{p.name}</span>
                  <span className="block text-xs text-ink-muted">
                    {p.model} · {p.kind.toLowerCase()}
                  </span>
                  {!tools && <span className="block text-xs text-ink-muted">No tool calling · not available for planner agents</span>}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="mb-2.5 font-semibold text-ink-strong">Limits</div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
          {lim.map(([k, label, unit]) => (
            <label key={k} className="flex flex-col gap-1 rounded-sm border border-line-subtle px-2.5 py-2">
              <span className="text-[11.5px] text-ink-muted">{label}</span>
              <span className="flex items-baseline gap-1">
                <input
                  type="number"
                  min={0}
                  value={L[k]}
                  onChange={(e) => set('limits', { ...L, [k]: Math.max(0, Number(e.target.value) || 0) })}
                  className="w-full min-w-0 bg-transparent text-[15px] font-semibold text-ink-strong outline-none"
                />
                {unit && <span className="text-[13px] text-ink-muted">{unit}</span>}
              </span>
            </label>
          ))}
        </div>
        <div className="mt-2 text-xs text-ink-muted">Project defaults from Project settings: kap.agent max in-flight 3, task priority 3.</div>
      </div>
    </>
  );
}

function Knowledge({ s, set }: StepProps) {
  const base = useBase();
  const on = s.collections.includes('sceai_indicators');
  return (
    <>
      <button
        type="button"
        onClick={() => set('collections', toggle(s.collections, 'sceai_indicators'))}
        className={cn('flex max-w-[560px] items-start gap-3 rounded-sm border px-3 py-2.5 text-left', on ? 'border-brand-tint bg-[#FCF7F8]' : 'border-line')}
      >
        <Box on={on} />
        <span className="grid h-8 w-8 flex-none place-items-center rounded-sm bg-[#F6E8EC] text-[#8A1538]">
          <Database size={16} />
        </span>
        <span>
          <span className="block font-mono text-[12.5px] font-semibold text-ink-strong">sceai_indicators</span>
          <span className="block text-xs text-ink-muted">8,104 observations · 418 document chunks · embed_default</span>
        </span>
      </button>
      <div className="text-[13px] text-ink-muted">
        Only collections in the SCEAI project are listed. <Link to={`${base}/collections`}>Open Collections</Link>
      </div>
      {!on && (
        <div className="flex max-w-[640px] gap-2.5 rounded-sm border border-warning-border bg-warning-bg px-3.5 py-3 text-[13px] text-warning-fg">
          <TriangleAlert size={16} className="mt-px flex-none" />
          Without a collection the local indicator tools and hybrid_search have no data to read.
        </div>
      )}
    </>
  );
}

function Box({ on, teal }: { on: boolean; teal?: boolean }) {
  return on ? (
    <span className="mt-px grid h-4 w-4 flex-none place-items-center rounded-[3px] text-white" style={{ background: teal ? '#0F766E' : 'var(--brand)' }}>
      <Check size={11} strokeWidth={3} />
    </span>
  ) : (
    <span className="mt-px h-4 w-4 flex-none rounded-[3px] border-[1.5px] border-line-strong" />
  );
}

function ToolTile({ on, teal, name, desc, onClick, className }: { on: boolean; teal?: boolean; name: string; desc: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn('flex items-start gap-2.5 rounded-sm border px-3 py-2.5 text-left', className)}
      style={on ? (teal ? { borderColor: '#0F766E', background: 'var(--teal-tint)' } : { borderColor: 'var(--brand-tint)', background: '#FCF7F8' }) : { borderColor: 'var(--border-default)' }}
    >
      <Box on={on} teal={teal} />
      <span>
        <span className="block font-mono text-[12.5px] text-ink-strong">{name}</span>
        <span className="text-xs text-ink-muted">{desc}</span>
      </span>
    </button>
  );
}

const Dot = ({ c }: { c: string }) => <span className="h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: c }} />;

function Tools({ s, set }: StepProps) {
  const all = WIZARD_LOCAL_TOOLS.length;
  const n = s.local.length;
  return (
    <>
      <div>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <div className="flex flex-wrap items-center gap-2 whitespace-nowrap font-semibold text-ink-strong">
            <Dot c="#8A1538" />
            Local indicator tools{' '}
            <span className="text-[13px] font-normal text-ink-muted">
              {n} of {all} selected
            </span>
          </div>
          <button type="button" className="text-[13px] text-brand hover:underline" onClick={() => set('local', n === all ? [] : WIZARD_LOCAL_TOOLS.map((t) => t.name))}>
            {n === all ? 'Clear all' : 'Select all'}
          </button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' }}>
          {WIZARD_LOCAL_TOOLS.map((t) => (
            <ToolTile key={t.name} on={s.local.includes(t.name)} name={t.name} desc={t.description} onClick={() => set('local', toggle(s.local, t.name))} />
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2.5 flex items-center gap-2 font-semibold text-ink-strong">
          <Dot c="#C8B49A" />
          Document search
        </div>
        <ToolTile
          className="max-w-[520px]"
          on={s.docs}
          name="hybrid_search"
          desc="Semantic + keyword search over Word documents in attached collections (embed_default, 1024-d)"
          onClick={() => set('docs', !s.docs)}
        />
      </div>
      <div>
        <div className="mb-2.5 flex items-center gap-2 font-semibold text-ink-strong">
          <Dot c="#0F766E" />
          External MCP tools · <span className="font-mono font-medium">oxford_economics</span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' }}>
          {OXFORD.map((t) => (
            <ToolTile key={t.name} teal on={s.oxford.includes(t.name)} name={t.name} desc={t.description} onClick={() => set('oxford', toggle(s.oxford, t.name))} />
          ))}
        </div>
        {s.oxford.length > 0 && (
          <div className="mt-2.5 flex gap-2.5 rounded-sm border border-warning-border bg-warning-bg px-3.5 py-3 text-[13px] text-warning-fg">
            <TriangleAlert size={16} className="mt-px flex-none" />
            <div>
              <b>Calls leave the SCEAI project boundary.</b> Only public-domain questions are sent to Oxford Economics. The data-leak guard blocks local indicator codes, values and tenant
              identifiers, and every outbound question is recorded in the trace.
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Instructions({ s, set }: StepProps) {
  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-ink-strong">System instructions</span>
        <textarea
          value={s.prompt}
          onChange={(e) => set('prompt', e.target.value)}
          rows={9}
          className="resize-y rounded-sm border border-line bg-surface-sunken p-3 font-mono text-xs leading-[1.6] text-ink-body outline-none focus:border-brand focus:bg-surface focus:shadow-focus"
        />
        <span className="text-xs text-ink-muted">{s.prompt.length} characters · tool descriptions are added automatically</span>
      </label>
      <div className="rounded-sm bg-surface-sunken px-3.5 py-3 text-[13px] text-ink-muted">
        Tips: tell the agent which tool to call first, how to quote numbers (period and unit), and what it must never send to external tools.
      </div>
    </>
  );
}

function Access({ s, set }: StepProps) {
  return (
    <div className="flex flex-col gap-2">
      {GROUPS.map((g) => {
        const on = s.groups.includes(g.name);
        return (
          <button
            key={g.name}
            type="button"
            onClick={() => set('groups', toggle(s.groups, g.name))}
            className={cn('flex items-start gap-3 rounded-sm border px-3 py-2.5 text-left', on ? 'border-brand-tint bg-[#FCF7F8]' : 'border-line')}
          >
            <Box on={on} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[12.5px] font-semibold text-ink-strong">{g.name}</span>
                <Badge tone={g.role === 'analyst' ? 'info' : 'brand'}>{g.role}</Badge>
              </span>
              <span className="block text-xs text-ink-muted">
                {g.allows} · {g.members}
              </span>
            </span>
          </button>
        );
      })}
      <div className="flex items-start gap-3 rounded-sm border border-line-subtle px-3 py-2.5 opacity-70">
        <Box on />
        <span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-[12.5px] font-semibold text-ink-strong">ai_team</span>
            <Badge tone="brand">administrator</Badge>
          </span>
          <span className="block text-xs text-ink-muted">Platform-wide · inherited · m.alkuwari, r.haddad, j.thomas</span>
        </span>
      </div>
    </div>
  );
}

function Review({ s, onEdit }: { s: State; onEdit: (i: number) => void }) {
  const p = PROVIDERS.find((x) => x.name === s.provider);
  const tools = [...s.local, ...(s.docs ? ['hybrid_search'] : []), ...s.oxford];
  const json = {
    name: s.name,
    description: s.description,
    type: 'planner_and_executor',
    model_provider: s.provider,
    collections: s.collections,
    tools,
    system_prompt: s.prompt,
    limits: {
      timeout_seconds: s.limits.timeout,
      max_retries: s.limits.retries,
      request_limit: s.limits.requests,
      tool_call_limit: s.limits.toolCalls,
      task_priority: s.limits.priority,
      max_in_flight: s.limits.inFlight,
    },
    grants: s.groups,
  };
  const edit = (i: number) => (
    <button type="button" className="ml-2 text-xs text-brand hover:underline" onClick={() => onEdit(i)}>
      Edit
    </button>
  );
  return (
    <div className="grid items-start gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))' }}>
      <KeyValues
        cols="130px 1fr"
        rows={[
          ['Name', <span className="font-mono text-[12.5px]">{s.name}{edit(0)}</span>],
          ['Description', s.description || '—'],
          ['Model', <span><span className="font-mono text-[12.5px]">{s.provider}</span> · {p?.model}{edit(1)}</span>],
          ['Limits', `${s.limits.timeout} s · ${s.limits.toolCalls} tool calls · ${s.limits.requests} requests`],
          ['Collections', <span className="font-mono text-[12.5px]">{s.collections.join(', ') || '—'}{edit(2)}</span>],
          ['Tools', <span>{s.local.length} local{s.docs ? ' · hybrid_search' : ''}{s.oxford.length ? ` · ${s.oxford.join(' · ')}` : ''}{edit(3)}</span>],
          ['Instructions', <span>{s.prompt.split('\n').length} lines{edit(4)}</span>],
          ['Access', <span>{[...s.groups, 'ai_team (inherited)'].join(', ')}{edit(5)}</span>],
        ]}
      />
      <JsonViewer value={json} maxHeight={360} />
      {s.oxford.length > 0 && (
        <div className="flex gap-2.5 rounded-sm border border-warning-border bg-warning-bg px-3.5 py-3 text-[13px] text-warning-fg" style={{ gridColumn: '1 / -1' }}>
          <TriangleAlert size={16} className="mt-px flex-none" />
          This agent will call oxford_economics. Outbound questions are checked by the data-leak guard and recorded in each trace.
        </div>
      )}
    </div>
  );
}
