/**
 * Dialogs for KAP agents on the live tenant: the create wizard (→ POST
 * /api/agents), one edit form per configuration part (→ PATCH), and the test
 * run form (→ platform submitJob). Pure specs; the hook supplies the save
 * callbacks. Bodies are built and validated in fromKap.ts.
 */
import type { FormField, FormValues, SaveResult, WizardSpec } from '@/engine/dialogs';
import { KAP_LIMITS, NAME_HINT, NAME_RE, NONE, parseLimit, toKapCreate, TYPE_L, type KapAgent, type KapEdit, type LiveOpts } from './fromKap';

const pick = (opts: string[], cur: string, label: string, k: string, hint?: string): FormField =>
  opts.length ? { k, label, type: 'select', opts: opts.includes(cur) || !cur ? opts : [cur].concat(opts), val: cur || opts[0], hint } : { k, label, type: 'text', val: cur, hint: (hint ? hint + ' ' : '') + 'No list from KAP: type the name.' };

const collsF = (o: LiveOpts, val: string[]): FormField[] =>
  o.collections.length
    ? [{ k: 'colls', label: 'Collections', type: 'chips', opts: [...new Set(o.collections.concat(val))], val: val.slice(), hint: 'At most two. Every request runs with the caller’s own access.' }]
    : [{ type: 'note', tone: 'warn', text: 'KAP returned no collections for this tenant.' }];

const toolsF = (o: LiveOpts, val: string[]): FormField[] => [
  { k: 'tools', label: 'Allowed tools', type: 'chips', opts: [...new Set(o.tools.concat(val))], val: val.slice(), hint: 'Tool names already allowed on this tenant’s agents.' },
  { k: 'toolsX', label: 'Other tools', type: 'text', ph: 'e.g. hybrid_search, EconomicData', hint: 'Comma-separated tool names from the tenant configuration (built-in or MCP tools). KAP rejects unknown names.' },
];

const schemaOpts = (o: LiveOpts, cur?: string | null) => [NONE].concat([...new Set(o.schemas.concat(cur ? [cur] : []))]);
const ioF = (o: LiveOpts, cfg: KapAgent['config'] | undefined): FormField[] => [
  { k: 'inSchema', label: 'Input schema', type: 'select', opts: schemaOpts(o, cfg?.input_schema_ref), val: cfg?.input_schema_ref || NONE, hint: 'With an input schema every job needs a payload that matches it.' },
  { k: 'outSchema', label: 'Output schema', type: 'select', opts: schemaOpts(o, cfg?.output_schema_ref), val: cfg?.output_schema_ref || NONE },
  { k: 'userPrompt', label: 'Prompt template', type: 'textarea', val: cfg?.user_prompt || '', rows: 4, hint: 'Added to each job’s request. Up to 4096 characters.' },
];

const limitsF = (k?: KapAgent): FormField[] =>
  KAP_LIMITS.map(([key, l, min, max]) => ({ k: key, label: l, type: 'num' as const, val: k && k[key] != null ? String(k[key]) : '', ph: 'KAP default', hint: min + '–' + max + ' · empty = KAP default' }));

// ---------------------------------------------------------------- create
export const LIVE_WIZARD_STEPS = ['Identity', 'Instructions', 'Model', 'Knowledge & tools', 'Input and output', 'Limits', 'Review'];

export function liveWizardFields(o: LiveOpts, step: number, v: FormValues): FormField[] {
  const wf = v.type !== TYPE_L.planner_and_executor;
  if (step === 0)
    return [
      { k: 'name', label: 'Agent name', type: 'text', ph: 'e.g. supplier_contracts_agent', hint: NAME_HINT + ' Must be unique in the tenant.' },
      { k: 'description', label: 'Purpose', type: 'text' },
      { k: 'type', label: 'Agent type', type: 'select', opts: [TYPE_L.workflow, TYPE_L.planner_and_executor], hint: 'Cannot be changed later. Workflow: structured input and output. Planner and executor: free-text request, uses tools.' },
    ];
  if (step === 1) return [{ k: 'prompt', label: 'System prompt', type: 'textarea', rows: 6, ph: 'What the agent does, how it answers and what it must not do', hint: 'KAP stores it but never returns it.' }];
  if (step === 2) return [pick(o.models, v.model || '', 'Model', 'model', 'Chat model providers of this tenant.')];
  if (step === 3) return collsF(o, v.colls || []).concat(toolsF(o, v.tools || []));
  if (step === 4)
    return wf ? ioF(o, { input_schema_ref: v.inSchema, output_schema_ref: v.outSchema, user_prompt: v.userPrompt }) : [{ type: 'note', text: 'Planner and executor agents take a free-text request: no input or output schema.' }];
  if (step === 5) return limitsF();
  const lim = KAP_LIMITS.filter(([k]) => String(v[k] ?? '').trim()).map(([k, l]) => l + ' ' + v[k]);
  return [
    {
      type: 'kv',
      label: 'New agent in KAP',
      rows: [
        ['Agent', v.name],
        ['Type', v.type],
        ['Purpose', v.description || '—'],
        ['Model', v.model],
        ['Collections', (v.colls || []).join(', ') || 'None'],
        ['Tools', [...new Set((v.tools || []).concat(String(v.toolsX || '').split(/[\s,]+/).filter(Boolean)))].join(', ') || 'None'],
      ].concat(wf ? [['Input / output schema', (v.inSchema || NONE) + ' / ' + (v.outSchema || NONE)]] : []).concat([['Limits', lim.join(' · ') || 'KAP defaults']]) as [string, unknown][],
    },
    { type: 'note', text: 'The agent is created in KAP and takes jobs at once. KAP keeps one configuration per agent: later edits apply directly.' },
  ];
}

export function validateLiveStep(o: { names: string[] }, step: number, v: FormValues): string {
  if (step === 0) {
    const n = String(v.name || '').trim();
    if (!NAME_RE.test(n)) return 'Agent name: ' + NAME_HINT;
    if (o.names.some((x) => x.toLowerCase() === n.toLowerCase())) return 'An agent with this name exists.';
  }
  if (step === 2 && !String(v.model || '').trim()) return 'Choose a model.';
  if (step === 3 && (v.colls || []).length > 2) return 'KAP allows at most two collections per agent.';
  if (step === 5) for (const [k, l, min, max] of KAP_LIMITS) {
    const r = parseLimit(v[k], l, min, max);
    if (r.err) return r.err;
  }
  if (step === 6) return toKapCreate(v).err || '';
  return '';
}

export function liveAgentWizard(o: LiveOpts, names: string[], finish: (v: FormValues) => SaveResult): WizardSpec {
  return {
    title: 'Create agent',
    steps: LIVE_WIZARD_STEPS,
    finishL: 'Create in KAP',
    initial: { type: TYPE_L.workflow, colls: [], tools: [], inSchema: NONE, outSchema: NONE, model: o.models[0] || '' },
    fields: (step, v) => liveWizardFields(o, step, v),
    validate: (step, v) => validateLiveStep({ names }, step, v),
    finish,
  };
}

// ---------------------------------------------------------------- edit
export const EDIT_TITLE: Record<KapEdit, string> = { name: 'Name', description: 'Purpose', system_prompt: 'System prompt', model_ref: 'Model', collections: 'Collections', allowed_tools: 'Allowed tools', limits: 'Execution limits', io: 'Input and output' };

/** Fields of one edit form, prefilled from the KAP agent. */
export function liveEditFields(k: KapAgent, what: KapEdit, o: LiveOpts): FormField[] {
  const note: FormField = { type: 'note', text: 'Saved to KAP at once and used by the next job. KAP keeps no earlier version.' };
  const f: FormField[] =
    what === 'name' ? [{ k: 'name', label: 'Agent name', type: 'text', val: k.name, hint: NAME_HINT + ' Job history stays with the agent.' }]
    : what === 'description' ? [{ k: 'description', label: 'Purpose', type: 'textarea', rows: 3, val: k.description || '' }]
    : what === 'system_prompt' ? [{ k: 'prompt', label: 'System prompt', type: 'textarea', rows: 8, val: '', hint: (k.system_prompt_is_set ? 'A prompt is set. ' : 'No prompt is set. ') + 'KAP never returns it: enter the full prompt; saving replaces it.' }]
    : what === 'model_ref' ? [pick(o.models, k.model_ref, 'Model', 'model', 'Chat model providers of this tenant.')]
    : what === 'collections' ? collsF(o, k.collections || [])
    : what === 'allowed_tools' ? toolsF(o, k.allowed_tools || [])
    : what === 'limits' ? limitsF(k)
    : ioF(o, k.config);
  return f.concat([note]);
}

// ---------------------------------------------------------------- test
export function liveTestFields(k: KapAgent, samples: string[]): FormField[] {
  const wf = k.type === 'workflow';
  return ([{ type: 'note', text: 'Runs a real job in KAP with the current configuration. Its trace opens in Monitoring.' }] as FormField[])
    .concat(samples.length ? [{ k: 'sample', label: 'Sample request', type: 'select', opts: ['Write my own'].concat(samples), val: 'Write my own' }] : [])
    .concat([{ k: 'q', label: wf ? 'Request (optional with a payload)' : 'Request', type: 'textarea', rows: 3, ph: 'Type a request to test' }])
    .concat(wf ? [{ k: 'payload', label: 'Payload (JSON)' + (k.config?.input_schema_ref ? ' · schema ' + k.config.input_schema_ref : ''), type: 'textarea', rows: 5, ph: '{"question": "…"}', hint: k.config?.input_schema_ref ? 'Required: must match the input schema.' : 'Optional.' }] : []);
}
