/**
 * Create-agent wizard (prototype `agentWizard`, remapped from the `wizard`
 * screen to a dialog on the Agents list) and the "Add tool" picker. Pure
 * specs: the hook supplies the option lists and the save callback.
 */
import type { FormField, FormValues, WizardSpec } from '@/engine/dialogs';
import type { Agent, AgentCfg } from '@/v35/data/agentFactory';
import type { ToolInfo } from './logic';
import { GUARDS } from './build';

export interface AgentWizardOpts {
  /** active LLM deployments of the tenant */
  models: string[];
  colls: string[];
  ontoTypes: string[];
  tools: string[];
  /** existing agent ids */
  ids: string[];
}

export const ALWAYS_GUARDS = ['Prompt injection', 'Jailbreak'];
export const AGENT_WIZARD_STEPS = ['Identity', 'Instructions', 'Models', 'Knowledge', 'Tools', 'Limits & guardrails', 'Review'];
export const AGENT_WIZARD_INITIAL: FormValues = { model: 'Tenant default', fb: 'None', multi: 'None', colls: [], ent: 'Off', entTypes: [], tools: [], lim: '15', dur: '60 s', fail: 'Retry once, then answer with a stated limitation', guards: ['Grounding required'] };

export function agentWizardFields(o: AgentWizardOpts, step: number, v: FormValues): FormField[] {
  if (step === 0) return [{ k: 'id', label: 'Agent name', type: 'text', ph: 'e.g. supplier_contracts_agent', hint: 'Lower-case letters, digits and underscores.' }, { k: 'purpose', label: 'Purpose', type: 'text' }];
  if (step === 1) return [{ k: 'instr', label: 'System instructions', type: 'textarea', ph: 'What the agent does, how it answers and what it must not do', hint: 'Describe the expected answer here too, for example citations, language or format.' }];
  if (step === 2)
    return [
      { k: 'model', label: 'Primary model', type: 'select', opts: ['Tenant default'].concat(o.models) },
      { k: 'fb', label: 'Fallback model', type: 'select', opts: ['None'].concat(o.models) },
      { k: 'multi', label: 'Multi-model routing', type: 'select', opts: ['None', 'Short questions to the fallback model', 'Arabic questions to the primary model'] },
    ];
  if (step === 3)
    return ([
      { k: 'colls', label: 'Collections (optional)', type: 'chips', opts: o.colls, hint: "Every request runs with the caller's own access. An agent can work without collections." },
      { k: 'ent', label: 'Business Entities context', type: 'select', opts: ['Off', 'Entities only', 'Entities and relationships'], hint: 'Independent of collections. Entities come from structured data, documents and ingestion pipelines the caller can read.' },
    ] as FormField[]).concat(v.ent && v.ent !== 'Off' ? [{ k: 'entTypes', label: 'Allowed entity types', type: 'chips', opts: o.ontoTypes }] : []);
  if (step === 4) return [{ k: 'tools', label: 'AI Agent Tools', type: 'chips', opts: o.tools, hint: 'Tool credentials stay with the tool configuration. Read-only and action-taking tools are marked in the Tool Catalog.' }];
  if (step === 5)
    return [
      { k: 'lim', label: 'Max tool calls', type: 'select', opts: ['5', '10', '15', '20'] },
      { k: 'dur', label: 'Max duration', type: 'select', opts: ['30 s', '60 s', '120 s', '180 s'] },
      { k: 'fail', label: 'Failure handling', type: 'select', opts: ['Retry once, then answer with a stated limitation', 'Refuse with an explanation', 'Hand over to a fallback agent'] },
      { k: 'guards', label: 'Guardrails', type: 'chips', opts: GUARDS, hint: 'Prompt injection and jailbreak detection are always on.' },
    ];
  return [
    {
      type: 'kv',
      label: 'Draft v1',
      rows: [
        ['Agent', v.id],
        ['Purpose', v.purpose],
        ['Primary / fallback model', v.model + ' / ' + v.fb],
        ['Collections', (v.colls || []).join(', ') || 'None'],
        ['Business Entities', v.ent + (v.entTypes && v.entTypes.length ? ' · ' + v.entTypes.join(', ') : '')],
        ['Tools', (v.tools || []).map((t: string) => t.split(':').pop()).join(', ') || 'None'],
        ['Limits', v.lim + ' tool calls · ' + v.dur],
        ['Guardrails', guardsOf(v.guards).join(', ')],
      ],
    },
    { type: 'note', text: 'Next: test the draft, run its evaluation and publish it.' },
  ];
}

export function validateAgentStep(o: Pick<AgentWizardOpts, 'ids'>, step: number, v: FormValues): string {
  if (step === 0) {
    if (!/^[a-z][a-z0-9_]{2,40}$/.test((v.id || '').trim())) return 'Agent name: lower-case letters, digits and underscores.';
    if (o.ids.includes(v.id.trim())) return 'An agent with this name exists.';
    if (!(v.purpose || '').trim()) return 'Describe the purpose.';
  }
  if (step === 1 && (v.instr || '').trim().length < 10) return 'Write the system instructions.';
  if (step === 3 && v.ent !== 'Off' && !(v.entTypes || []).length) return 'Select at least one entity type.';
  return '';
}

const guardsOf = (g: string[] | undefined) => ALWAYS_GUARDS.concat((g || []).filter((x) => !ALWAYS_GUARDS.includes(x)));

/** The new agent (draft v1) from the wizard values. */
export function agentRecord(v: FormValues, actor: string): Agent {
  const cfg: AgentCfg = {
    instr: v.instr.trim(),
    model: v.model === 'Tenant default' ? 'default:agent' : v.model,
    fb: v.fb,
    multi: v.multi,
    tools: +v.lim,
    dur: v.dur,
    tokens: '16k',
    retries: '1',
    fail: v.fail,
    guards: guardsOf(v.guards),
    tset: (v.tools || []).slice(),
    gov: { tier: 'Informational', esc: 'None' },
    ent: { mode: v.ent, hops: v.ent === 'Entities and relationships' ? '1 hop' : '—', types: v.ent === 'Off' ? [] : v.entTypes || [] },
  };
  return { id: v.id.trim(), purpose: v.purpose.trim(), vers: [{ v: 'v1', st: 'Draft', at: 'just now', by: actor, note: 'First version', cfg }], dis: null, st: 'Draft', evSets: [], thr: {}, m: [0, 0, '—', '—', 0], owner: actor };
}

export function agentWizard(o: AgentWizardOpts, finish: (v: FormValues) => string): WizardSpec {
  return { title: 'Create agent', steps: AGENT_WIZARD_STEPS, finishL: 'Create draft', initial: AGENT_WIZARD_INITIAL, fields: (step, v) => agentWizardFields(o, step, v), validate: (step, v) => validateAgentStep(o, step, v), finish };
}

/** "Add tool" picker: search, choose, inspect (prototype addToolF). */
export function addToolWizard(agentId: string, inv: ToolInfo[], add: (t: ToolInfo) => void): WizardSpec {
  const lab = (t: ToolInfo) => t.n + ' · ' + t.srcL + ' · ' + t.stF;
  const match = (t: ToolInfo, q: string) => !q || (t.n + ' ' + t.d + ' ' + t.srcL + ' ' + t.cap).toLowerCase().includes(q);
  return {
    title: 'Add tool · ' + agentId,
    steps: ['Add tool'],
    finishL: 'Add to draft',
    initial: { q: '', t: '' },
    fields: (_s, v) => {
      const q = (v.q || '').toLowerCase();
      const opts = inv.filter((t) => match(t, q));
      const cur = opts.find((t) => lab(t) === v.t) || opts[0];
      return ([
        { k: 'q', label: 'Search tools', type: 'text', ph: 'Name, capability or source' },
        { k: 't', label: 'Tool', type: 'select', opts: opts.length ? opts.map(lab) : ['No matching tools'] },
      ] as FormField[]).concat(
        cur
          ? ([{ type: 'kv', label: cur.n, rows: [['Purpose', cur.d], ['Source', cur.srcL], ['Capability', cur.cap], ['Effect', cur.fx], ['Status', cur.stF], ['Input contract', cur.io[0]], ['Output contract', cur.io[1]]] }] as FormField[]).concat(
              cur.stF !== 'Available' ? [{ type: 'note', tone: 'warn', text: cur.n + ' is ' + cur.stF.toLowerCase() + '; agents cannot call it until it is available.' }] : [],
            )
          : [],
      );
    },
    validate: () => '',
    finish: (v) => {
      const q = (v.q || '').trim().toLowerCase();
      const t = inv.find((x) => lab(x) === v.t && match(x, q)) || inv.find((x) => match(x, q));
      if (!t) return 'Choose a tool.';
      add(t);
      return '';
    },
  };
}
