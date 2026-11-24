/**
 * Business Data Hub (v35): Collections, Structured Data, Unstructured Data and
 * Business Entities as ScreenModels. Port of the prototype's dataHub
 * (design-ref-v35/app.js 3114–3481). Builders are pure: data, access and the
 * UI callbacks (navigate, dialogs, store updates) come in through `Hub`.
 */
import { act, cell, fr, kv } from '@/engine/build';
import type { FormField, FormValues } from '@/engine/dialogs';
import type { Action, DiagramEdge, DiagramSpec, DsStatus, Filters, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import { BUILTIN_ROLES, type IamData, type IamGrant, type IamPolicy } from '@/v35/iam';
import {
  AGENT_ENTITY_CONTEXT, blockingPolicies, dayAgo, policiesOf, TENANT_AGENTS, TENANT_NAME,
  type BusinessData, type DataTenant, type DhCollection, type DhDataset, type DhDocument, type DhSearch, type EntityInst, type IngestRef, type OntoType, type TenantData,
} from '@/v35/data/businessData';
import { UD_DEFAULT, type UdFilters } from './session';

// ------------------------------------------------------------------ context
export interface DataUi {
  /** navigate, relative to the tenant base (e.g. `collections/x/access`) */
  go: (path: string) => void;
  form: (title: string, fields: FormField[], saveL: string, save: (v: FormValues) => string) => void;
  confirm: (title: string, body: string, items: { a: string; b?: string; c?: string }[], cta: string, fn: () => void) => void;
  toast: (msg: string) => void;
  /** change this tenant's business data (draft), then show `toast` */
  setD: (fn: (d: TenantData, all: BusinessData) => void, toast: string) => void;
  /** change the IAM model (grants, groups, policies), then show `toast` */
  setIam: (fn: (n: IamData) => void, toast: string) => void;
  /** run after the current dialog has closed (chained dialogs) */
  later: (fn: () => void) => void;
}

export interface DataAccess {
  uid: string;
  /** data:manage on any collection */
  canData: boolean;
  /** grant:manage in the tenant */
  canGrant: boolean;
  /** collection:read or data:manage on a collection */
  canRead: (collection: string) => boolean;
  canAgent: (perm: string, agent: string) => boolean;
}

export interface Hub {
  t: DataTenant;
  all: BusinessData;
  D: TenantData;
  iam: IamData;
  acc: DataAccess;
  ui: DataUi;
  ing: IngestRef;
  /** user shown in "Effective access" */
  effU: string;
  setEffU: (uid: string) => void;
}

const enc = encodeURIComponent;
export const fmt = (n: number | string) => Number(n).toLocaleString('en-US');
const uniqSorted = (a: (string | null | undefined)[]) => [...new Set(a.filter((x): x is string => !!x))].sort();
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const tabsOf = (T: [string, string][]) => T.map(([value, label]) => ({ value, label }));

/** Derived lookups and access rules shared by every screen (the top of the prototype's dataHub). */
export function derive(h: Hub) {
  const { D, t: T, iam: IAM, acc } = h;
  const myGs = IAM.groups.filter((g) => g.t === T && g.st !== 'Disabled' && g.members.includes(acc.uid)).map((g) => g.n);
  const polOf = (k: string) => policiesOf(IAM.policies, D.documents, T, k);
  const polN = (k: string) => polOf(k).map((p) => p.n).join(', ');
  const ownOk = (k: string) => !blockingPolicies(IAM.policies, D.documents, T, k, myGs).length;
  const label = (c: string) => polN(`collection:${c}`);
  const collsOfDs = (id: string) => D.collections.filter((c) => c.ds.includes(id)).map((c) => c.id);
  const collsOfDoc = (id: string) => D.collections.filter((c) => c.docs.includes(id)).map((c) => c.id);
  const visDs = (id: string) => (acc.canData || collsOfDs(id).some(acc.canRead)) && ownOk(`dataset:${id}`);
  const visDoc = (id: string) => (acc.canData || collsOfDoc(id).some(acc.canRead)) && ownOk(`document:${id}`);
  const agentsOf = (c: string) => TENANT_AGENTS[T].filter((a) => (h.all.agColl[a] ?? []).includes(c));
  const instVis = (x: EntityInst) => x.src.some(([k, id]) => (k === 'dataset' ? visDs(id) : visDoc(id)));
  const instOf = (kind: 'dataset' | 'document', id: string) => D.inst.filter((x) => instVis(x) && x.src.some(([k, i]) => k === kind && i === id));
  // provenance from the Data Ingestion Hub: latest run that published the asset, its pipeline and data source
  const provOf = (id: string, docs: boolean) => {
    const r = h.ing.runs.find((x) => (docs ? x.outDocs : x.outDs).includes(id)) ?? null;
    const p = (r ? h.ing.pipelines.find((x) => x.id === r.pipe) : h.ing.pipelines.find((x) => x.dsName === id)) ?? null;
    const s = p && p.src !== 'manual' ? (h.ing.sources.find((x) => x.id === p.src) ?? null) : null;
    return { r, p, s };
  };
  const metaOf = (d: DhDocument) => {
    const P0 = provOf(d.id, true);
    const p = P0.p ?? (d.src.pipe ? h.ing.pipelines.find((x) => x.id === d.src.pipe) : undefined) ?? null;
    const r = P0.r ?? (d.src.run ? h.ing.runs.find((x) => x.id === d.src.run) : undefined) ?? null;
    return { p, r, src: p ? (p.src === 'manual' ? 'Manual upload' : p.src) : '—' };
  };
  const provRows = (id: string, docs: boolean, extra: Row[] = []): Row[] => {
    const { r, p, s } = provOf(id, docs);
    const item = r ? r.items.find((x) => x.n === id || x.n.replace(/\.\w+$/, '').toLowerCase() === id.replace(/^psa_|^pm_|_2026_10$/g, '')) : undefined;
    return [
      fr('Data source', p ? (p.src === 'manual' ? 'Manual upload' : p.src) : 'Not ingested through a pipeline', s ? `${s.type} · ${s.loc}` : p && p.src === 'manual' ? 'Uploaded files' : 'Maintained in KAP', s ? [act('Open', () => h.ui.go(`sources/${enc(s.id)}`))] : []),
      fr('Ingestion pipeline', p ? p.id : '—', p ? p.desc : '', p ? [act('Open', () => h.ui.go(`pipelines/${enc(p.id)}`))] : []),
      fr('Ingestion run', r ? r.id : '—', r ? `${r.start} · ${r.st}${r.batch ? ` · batch ${r.batch}` : ''}` : '', r ? [act('Open', () => h.ui.go(`runs/${enc(r.id)}/lineage`))] : []),
      fr('Original file or source record', item ? item.n : r && r.items[0] ? r.items.map((x) => x.n).slice(0, 3).join(', ') : '—', item ? item.path : ''),
      ...extra,
    ];
  };
  return { myGs, polOf, polN, ownOk, label, collsOfDs, collsOfDoc, visDs, visDoc, agentsOf, instVis, instOf, provOf, metaOf, provRows };
}

const procPill = (d: DhDocument): [DsStatus, string] => (d.ex === 'Failed' ? ['rejected', 'Extraction failed'] : d.idx === 'Indexed' ? ['approved', 'Indexed'] : d.idx === 'Re-indexing' ? ['submitted', 'Re-indexing'] : ['draft', d.idx]);
const pstP = (s: string): [DsStatus, string] => (({ Completed: ['approved', 'Completed'], Failed: ['rejected', 'Failed'], Processing: ['submitted', 'Processing'], Pending: ['draft', 'Pending'] }) as Record<string, [DsStatus, string]>)[s] ?? ['draft', s];
export const entP = (d: Pick<DhDocument, 'entSt' | 'entN'>): [DsStatus, string] =>
  d.entSt === 'Completed' ? ['approved', plural(d.entN, 'entity', 'entities')] : d.entSt === 'Failed' ? ['rejected', 'Failed'] : d.entSt === 'No entities found' ? ['draft', 'None found'] : ['draft', 'Not processed'];
const dsPill = (d: DhDataset): [DsStatus, string] => (d.st === 'Ingested' ? ['approved', 'Ingested'] : ['submitted', d.st]);

function denied(h: Hub, what: string, title: string): ScreenModel {
  return { head: { title }, sections: [], denied: `You don't have access to this ${what}. Ask a ${TENANT_NAME[h.t]} tenant administrator if you need access.` };
}

const openRow = (key: string, cells: Row['cells'], open: () => void, more: Action[] = []): Row => ({ key, cells, acts: [act('Open', open), ...more], onClick: open });

// ================================================================== COLLECTIONS
export function collectionsScreen(h: Hub): ScreenModel {
  const x = derive(h);
  const { D, acc, ui } = h;
  const rows = D.collections.filter((c) => acc.canRead(c.id));
  const create = () =>
    ui.form('Create collection', [{ k: 'id', label: 'Name', type: 'text', ph: 'e.g. supplier_contracts', hint: 'Lower-case letters, digits and underscores.' }, { k: 'desc', label: 'Description', type: 'text' }], 'Create', (v) => {
      const id = String(v.id ?? '').trim();
      if (!/^[a-z][a-z0-9_]{2,40}$/.test(id)) return 'Use 3–40 lower-case letters, digits and underscores.';
      if (D.collections.some((c) => c.id === id)) return 'A collection with this name exists.';
      ui.setD((d) => {
        d.collections.push({ id, purpose: 'Data scope', desc: String(v.desc ?? '').trim(), ds: [], docs: [], extraDocs: 0, sq: [], search: { mode: 'Hybrid (keyword + vector)', emb: 'embed-prod · qwen3-embedding', rr: '—', k: '6', min: '0.30', xl: 'Off' }, uses7: 0, last: 'Not used yet', impl: false });
      }, `${id} created. Add datasets or documents in Data Scope.`);
      return '';
    });
  return {
    head: { title: 'Collections', add: acc.canData ? act('Create collection', create, 'primary') : undefined },
    sections: [
      {
        empty: 'No collections you can open.',
        cols: ['Collection', 'Contents', 'Index status', 'Access policies', 'Agents'],
        rows: rows.map((c) => {
          const nd = c.docs.length + c.extraDocs;
          const docs = c.docs.map((id) => D.documents.find((d) => d.id === id)).filter((d): d is DhDocument => !!d);
          const bad = docs.filter((d) => d.ex === 'Failed').length;
          const ri = docs.filter((d) => d.idx === 'Re-indexing').length;
          const ags = x.agentsOf(c.id);
          return openRow(`c:${c.id}`, [
            cell(c.id, { m: true, sub: c.desc }),
            cell([c.ds.length ? plural(c.ds.length, 'dataset', 'datasets') : '', nd ? plural(nd, 'document', 'documents') : ''].filter(Boolean).join(' · ') || 'Empty'),
            cell('', { p: !c.ds.length && !nd ? ['draft', 'Empty'] : bad ? ['hold', `${bad} failed`] : ri ? ['submitted', 'Re-indexing'] : ['approved', 'Ready'] }),
            cell(x.label(c.id) || 'None'),
            cell(ags.length ? ags.join(', ') : '—'),
          ], () => ui.go(`collections/${enc(c.id)}`));
        }),
      },
    ],
  };
}

// ------------------------------------------------------------------ access summary (collections and structured datasets)
const rolesFor = (iam: IamData, t: string): Record<string, string[]> => ({ ...BUILTIN_ROLES, ...Object.fromEntries(iam.customRoles.filter((r) => r.t === t).map((r) => [r.n, r.perms])) });
const groupsOfIam = (iam: IamData, uid: string, t: string) => iam.groups.filter((g) => g.t === t && g.st !== 'Disabled' && g.members.includes(uid)).map((g) => g.n);
type PolVia = IamPolicy & { via?: string };

export function readGrants(h: Hub, resKey: string): IamGrant[] {
  const x = derive(h);
  const RPA = rolesFor(h.iam, h.t);
  const colls = resKey.startsWith('collection:') ? [resKey] : x.collsOfDs(resKey.slice(8)).map((c) => `collection:${c}`);
  return h.iam.grants.filter((g) => g.t === h.t && (RPA[g.r] ?? []).includes('collection:read') && (g.scope === 'tenant' || colls.includes(g.scope)));
}

/** Who can read a collection or dataset, through which grant, and which policies restrict it. */
export function effectiveRead(h: Hub, resKey: string, uid: string): { ok: boolean; why: string } {
  const { polsAll, gr } = accessBasis(h, resKey);
  const gs = groupsOfIam(h.iam, uid, h.t);
  const g0 = gr.filter((g) => gs.includes(g.g));
  if (!g0.length) return { ok: false, why: `No read grant · ${gs.length ? `member of ${gs.join(', ')}` : 'not in any group'}` };
  const blk = polsAll.filter((p) => !(p.cleared.includes('*') || p.cleared.some((y) => gs.includes(y))));
  if (blk.length) return { ok: false, why: `Read grant through ${g0[0].g} · not cleared by ${blk.map((p) => p.n).join(', ')}` };
  return { ok: true, why: `${g0[0].r} through ${g0[0].g}${polsAll.length ? ` · cleared by ${polsAll.map((p) => p.n).join(', ')}` : ' · no access policy applies'}` };
}

function accessBasis(h: Hub, resKey: string) {
  const x = derive(h);
  const isC = resKey.startsWith('collection:');
  const rid = resKey.slice(resKey.indexOf(':') + 1);
  const pols = x.polOf(resKey);
  const viaC = isC ? [] : x.collsOfDs(rid);
  const merged: PolVia[] = isC ? pols : [...pols, ...viaC.flatMap((cid) => x.polOf(`collection:${cid}`).map((p) => ({ ...p, via: cid })))];
  const polsAll = merged.filter((p, i, a) => a.findIndex((y) => y.n === p.n) === i);
  return { isC, rid, pols, viaC, polsAll, gr: readGrants(h, resKey) };
}

export function accessSections(h: Hub, resKey: string): Section[] {
  const { iam: IAM, t: T, ui, acc } = h;
  const { isC, rid, pols, viaC, polsAll, gr } = accessBasis(h, resKey);
  const RPA = rolesFor(IAM, T);
  const groupsT0 = IAM.groups.filter((g) => g.t === T);
  const cleared = (p: IamPolicy, gn: string) => p.cleared.includes('*') || p.cleared.includes(gn);
  const uOpts = IAM.users.filter((u) => groupsT0.some((g) => g.members.includes(u.id))).map((u) => u.id);
  const eu = effectiveRead(h, resKey, h.effU);
  const canGrantX = acc.canGrant;

  const grantF = () => {
    const roles = Object.keys(RPA).filter((r) => (RPA[r] ?? []).includes('collection:read') && !(RPA[r] ?? []).includes('tenant:configure'));
    const fields: FormField[] = [
      { k: 'g', label: 'Group', type: 'select', opts: [...groupsT0.map((g) => g.n), 'New group…'], val: groupsT0[0]?.n },
      { k: 'gn', label: 'New group name', type: 'text', ph: 'Only when creating a new group', hint: 'Add members afterwards in Groups.' },
      { k: 'r', label: 'Role', type: 'select', opts: roles, val: roles.includes('Analyst') ? 'Analyst' : roles[0], hint: 'Must include collection:read.' },
      { type: 'note', tone: 'info', label: 'Scope', text: isC ? 'This collection only.' : `Grants apply to collections. ${rid} is readable through ${viaC.join(', ') || 'no collection'}.` },
      ...(isC ? [] : [{ k: 'c', label: 'Collection', type: 'select', opts: viaC, val: viaC[0] } as FormField]),
    ];
    ui.form(`Grant read access · ${rid}`, fields, 'Grant', (v) => {
      const isNew = v.g === 'New group…';
      const gn = isNew ? String(v.gn ?? '').trim() : String(v.g ?? '');
      if (!gn) return 'Enter the new group name.';
      if (isNew && !/^[a-z][a-z0-9_]{2,40}$/.test(gn)) return 'Group name: lower-case letters, digits and underscores.';
      if (isNew && groupsT0.some((g) => g.n === gn)) return 'A group with this name exists.';
      if (!isC && !v.c) return 'The dataset is not in a collection.';
      const scope = isC ? resKey : `collection:${v.c}`;
      if (IAM.grants.some((g) => g.t === T && g.g === gn && g.r === v.r && g.scope === scope)) return `${gn} already has this access.`;
      const id = `G-${String(Date.now()).slice(-5)}`;
      ui.setIam((n) => {
        if (isNew) n.groups.push({ t: T, n: gn, d: `Created from ${rid} access`, members: [] });
        n.grants.push({ id, t: T, g: gn, r: v.r, scope });
      }, `${gn} can read ${scope.split(':')[1]}${polsAll.length ? ` if cleared by ${polsAll.map((p) => p.n).join(', ')}` : ''}.`);
      return '';
    });
  };
  const policyF = () => {
    const avail = IAM.policies.filter((p) => p.t === T && !p.res.includes(resKey)).map((p) => `${p.n} · ${p.kind}`);
    ui.form(`Apply an access policy · ${rid}`, [
      { k: 'p', label: 'Policy', type: 'select', opts: [...avail, 'New need-to-know policy…'], val: avail[0] ?? 'New need-to-know policy…' },
      { k: 'pn', label: 'New policy name', type: 'text', ph: 'e.g. Investment pipeline' },
      { k: 'cl', label: 'Cleared groups for a new policy', type: 'chips', opts: groupsT0.map((g) => g.n), val: [], hint: 'Clearance only restricts: cleared groups still need a read grant.' },
    ], 'Apply', (v) => {
      if (v.p === 'New need-to-know policy…') {
        const nm = String(v.pn ?? '').trim();
        const cl: string[] = v.cl ?? [];
        if (!nm) return 'Enter the policy name.';
        if (IAM.policies.some((p) => p.t === T && p.n === nm)) return 'A policy with this name exists.';
        if (!cl.length) return 'Select at least one cleared group.';
        ui.setIam((n) => { n.policies.push({ t: T, n: nm, kind: 'Need-to-know', res: [resKey], cleared: cl.slice() }); }, `Policy ${nm} now restricts ${rid}.`);
        return '';
      }
      const nm = String(v.p).split(' · ')[0];
      const p0 = IAM.policies.find((p) => p.t === T && p.n === nm);
      if (!p0) return 'Select a policy.';
      if (p0.kind === 'Classification' && pols.some((p) => p.kind === 'Classification')) return `${rid} already has a classification.`;
      ui.setIam((n) => { n.policies.find((p) => p.t === T && p.n === nm)?.res.push(resKey); }, `Policy ${nm} now restricts ${rid}.`);
      return '';
    });
  };
  const clearF = (p0: IamPolicy) =>
    ui.form(`Clearance · ${p0.n}`, [
      { k: 'cl', label: 'Cleared groups', type: 'chips', opts: ['Everyone with read access', ...groupsT0.map((g) => g.n)], val: p0.cleared.map((y) => (y === '*' ? 'Everyone with read access' : y)), hint: `Changes apply to every resource this policy restricts: ${p0.res.map((y) => y.split(':')[1]).join(', ')}. Clearance does not grant access.` },
    ], 'Save', (v) => {
      const sel: string[] = v.cl ?? [];
      if (!sel.length) return 'Select at least one cleared group.';
      const cl = sel.includes('Everyone with read access') ? ['*'] : sel.slice();
      if (JSON.stringify(cl) === JSON.stringify(p0.cleared)) return 'No change.';
      ui.setIam((n) => { const y = n.policies.find((p) => p.t === T && p.n === p0.n); if (y) y.cleared = cl; }, `Clearance for ${p0.n} updated.`);
      return '';
    });
  const manageF = () =>
    ui.form(`Manage access · ${rid}`, [
      { k: 'w', label: 'What do you want to change?', type: 'select', opts: ['Grant read access to a group', 'Apply an access policy', ...(polsAll.length ? ['Change clearance for a policy'] : [])], val: 'Grant read access to a group' },
      ...(polsAll.length ? [{ k: 'p', label: 'Policy (for clearance)', type: 'select', opts: polsAll.map((p) => p.n), val: polsAll[0].n } as FormField] : []),
    ], 'Continue', (v) => {
      ui.later(() => (v.w === 'Grant read access to a group' ? grantF() : v.w === 'Apply an access policy' ? policyF() : clearF(polsAll.find((p) => p.n === v.p) ?? polsAll[0])));
      return '';
    });

  return [
    {
      form: true,
      title: 'Access summary',
      sacts: canGrantX ? [act('Manage access', manageF)] : [],
      rows: [
        fr('Access rule', 'Read grant and clearance', `A group needs a role with collection:read${isC ? ' on this collection or the whole tenant' : ` on a collection that contains ${rid}`}. If an access policy applies, the group must also be cleared by it. Being cleared never grants access on its own.`),
        fr('Groups with read access', [...new Set(gr.map((g) => g.g))].join(', ') || 'None'),
        fr('Access policies', polsAll.map((p) => p.n + (p.via ? ` (from ${p.via})` : '')).join(', ') || 'None', polsAll.length ? `Cleared: ${polsAll.map((p) => (p.cleared.includes('*') ? 'everyone with read access' : p.cleared.join(', '))).join(' · and · ')}` : `Anyone with a read grant can read ${rid}`),
        fr('Effective access', `${eu.ok ? 'Can read' : 'No access'} · ${h.effU}`, eu.why, [
          act('Check another user', () => ui.form('Check effective access', [{ k: 'u', label: 'User', type: 'select', opts: uOpts, val: h.effU }], 'Check', (v) => { h.setEffU(String(v.u)); return ''; })),
        ]),
      ],
    },
    {
      title: 'Groups with read access',
      empty: `No group can read ${rid}.`,
      sacts: canGrantX ? [act('Grant read access', grantF)] : [],
      cols: ['Group', 'Role', 'Scope', 'Clearance', 'Effective'],
      mode: 'inline',
      rows: gr.map((g): Row => {
        const nc = polsAll.filter((p) => !cleared(p, g.g));
        const mem = groupsT0.find((y) => y.n === g.g)?.members ?? [];
        const acts: Action[] = !canGrantX
          ? []
          : [
              ...(g.scope === 'tenant'
                ? [act('Open group', () => ui.go(`groups/${enc(g.g)}/access`))]
                : [act('Revoke', () => ui.confirm(`Revoke ${g.r} on ${g.scope.split(':')[1]} from ${g.g}?`, `Members of ${g.g} lose read access unless another grant covers it.`, mem.map((m) => ({ a: m, b: g.g, c: '' })), 'Revoke', () => ui.setIam((n) => { n.grants = n.grants.filter((y) => y.id !== g.id); }, `${g.id} revoked.`)), 'ghost')]),
              ...nc.slice(0, 1).map((p) => act(`Clear for ${p.n}`, () => ui.setIam((n) => { const y = n.policies.find((q) => q.t === T && q.n === p.n); if (y && !y.cleared.includes(g.g)) y.cleared.push(g.g); }, `${g.g} cleared by ${p.n}.`))),
            ];
        return {
          key: `rg:${g.id}`,
          cells: [cell(g.g, { m: true, sub: plural(mem.length, 'member', 'members') }), cell(g.r), cell(g.scope === 'tenant' ? 'Whole tenant' : g.scope.replace(':', ' · ')), cell(polsAll.length ? (nc.length ? `Not cleared: ${nc.map((p) => p.n).join(', ')}` : 'Cleared') : 'No policy applies'), cell('', { p: nc.length ? ['rejected', 'Blocked'] : ['approved', 'Can read'] })],
          acts,
        };
      }),
    },
    {
      title: 'Access policies',
      empty: `No access policy restricts ${rid}.`,
      sacts: canGrantX ? [act('Apply policy', policyF)] : [],
      cols: ['Policy', 'Kind', 'Cleared groups', 'Also restricts'],
      mode: 'inline',
      rows: polsAll.map((p): Row => ({
        key: `rp:${p.n}`,
        cells: [cell(p.n, { sub: p.via ? `Inherited from collection ${p.via}` : '' }), cell(p.kind), cell(p.cleared.includes('*') ? 'Everyone with read access' : p.cleared.join(', ')), cell(p.res.filter((y) => y !== resKey).map((y) => y.split(':')[1]).join(', ') || '—')],
        acts: canGrantX
          ? [
              act('Change clearance', () => clearF(p)),
              ...(!p.via ? [act(`Remove from ${rid}`, () => ui.confirm(`Remove ${p.n} from ${rid}?`, `Anyone with a read grant can then read ${rid} unless another policy applies.`, [], 'Remove', () => ui.setIam((n) => { const y = n.policies.find((q) => q.t === T && q.n === p.n); if (y) y.res = y.res.filter((r) => r !== resKey); }, `${p.n} no longer restricts ${rid}.`)), 'ghost')] : []),
            ]
          : [],
      })),
    },
  ];
}

// ------------------------------------------------------------------ collection detail
export const COLLECTION_TABS: [string, string][] = [['overview', 'Overview'], ['scope', 'Data Scope'], ['retrieval', 'Retrieval & Query'], ['access', 'Access & Usage']];

export function collectionScreen(h: Hub, id: string, tab0: string | undefined): ScreenModel {
  const x = derive(h);
  const { D, acc, ui, t: T } = h;
  const c = D.collections.find((y) => y.id === id);
  if (!c || !acc.canRead(c.id)) return denied(h, 'collection', id);
  const tab = COLLECTION_TABS.some(([k]) => k === tab0) ? tab0! : 'overview';
  const base = `collections/${enc(c.id)}`;
  const head: PageHead = { title: c.id, tabs: tabsOf(COLLECTION_TABS), tab, setTab: (v) => ui.go(v === 'overview' ? base : `${base}/${v}`) };
  const upd = (fn: (y: DhCollection, d: TenantData) => void, toast: string) => ui.setD((d) => { const y = d.collections.find((q) => q.id === c.id); if (y) fn(y, d); }, toast);
  const dss = c.ds.map((i) => D.datasets.find((y) => y.id === i)).filter((y): y is DhDataset => !!y);
  const docs = c.docs.map((i) => D.documents.find((y) => y.id === i)).filter((y): y is DhDocument => !!y);
  const nd = c.docs.length + c.extraDocs;
  let sections: Section[] = [];

  if (tab === 'overview') {
    const fail = docs.filter((y) => y.ex === 'Failed');
    const ri = docs.filter((y) => y.idx === 'Re-indexing');
    const tys = [...new Set(D.inst.filter((e) => e.src.some(([k, i]) => (k === 'dataset' ? c.ds : c.docs).includes(i))).map((e) => e.type))];
    sections = [
      {
        form: true,
        rows: [
          fr('Description', c.desc || '—', '', acc.canData ? [act('Edit', () => ui.form('Description', [{ k: 'v', label: 'Description', type: 'text', val: c.desc }], 'Save', (v) => { upd((y) => { y.desc = String(v.v ?? '').trim(); }, 'Description saved.'); return ''; }))] : []),
          fr('Data types', [dss.length ? 'Structured' : '', nd ? 'Unstructured' : ''].filter(Boolean).join(' and ') || 'None yet', [...new Set(dss.map((d) => d.kind))].concat([...new Set(docs.map((d) => d.ty))]).join(', ')),
          fr('Assets', (dss.length ? `${plural(dss.length, 'dataset', 'datasets')} · ${fmt(dss.reduce((s, d) => s + d.rows, 0))} records` : '') + (dss.length && nd ? ' · ' : '') + (nd ? plural(nd, 'document', 'documents') : '') || 'Empty', 'Referenced from Structured Data and Unstructured Data'),
          fr(
            'Processing and index status',
            !dss.length && !nd ? 'Nothing to index' : fail.length ? `${fail.length} document failed extraction` : ri.length ? `Re-indexing ${ri.length} document` : 'Ready',
            dss.some((d) => d.st !== 'Ingested') ? 'Some datasets are still ingesting' : (dss.length ? 'Datasets ingested' : '') + (nd ? `${dss.length ? ' · ' : ''}${docs.filter((y) => y.idx === 'Indexed').length} of ${docs.length} listed documents indexed` : ''),
          ),
          fr('Entity types found', tys.length ? tys.join(', ') : 'None yet', 'From automatic extraction during ingestion', [act('View', () => ui.go('entities?tab=inst'))]),
          fr('Access', x.label(c.id) || 'No access policy', 'Who can read this collection and why', [act('Open Access & Usage', () => ui.go(`${base}/access`))]),
        ],
      },
    ];
  }

  if (tab === 'scope') {
    const addPick = (kind: 'ds' | 'docs') => {
      const pool = kind === 'ds' ? D.datasets.filter((d) => !c.ds.includes(d.id)).map((d) => d.id) : D.documents.filter((d) => !c.docs.includes(d.id)).map((d) => d.id);
      if (!pool.length) return ui.toast(`All ${kind === 'ds' ? 'datasets' : 'documents'} are already in this collection.`);
      ui.form(kind === 'ds' ? 'Add datasets' : 'Add documents', [{ k: 'v', label: kind === 'ds' ? 'Datasets from Structured Data' : 'Documents from Unstructured Data', type: 'chips', opts: pool, val: [], hint: 'Adds references. The data is not copied.' }], 'Add', (v) => {
        const sel: string[] = v.v ?? [];
        if (!sel.length) return 'Select at least one.';
        upd((y) => { y[kind] = y[kind].concat(sel); }, `${sel.length} added to ${c.id}.`);
        return '';
      });
    };
    const rm = (kind: 'ds' | 'docs', i: string) => () =>
      ui.confirm(`Remove ${i} from ${c.id}?`, `The reference is removed. The ${kind === 'ds' ? 'dataset' : 'document'} stays in ${kind === 'ds' ? 'Structured Data' : 'Unstructured Data'} and in other collections. Agents using this collection stop retrieving it.`, [], 'Remove', () => upd((y) => { y[kind] = y[kind].filter((q) => q !== i); }, `${i} removed from ${c.id}.`));
    sections = [
      {
        title: 'Datasets',
        empty: 'No datasets in this collection.',
        sacts: acc.canData ? [act('Add datasets…', () => addPick('ds'))] : [],
        cols: ['Dataset', 'Type', 'Records', 'Membership', 'Status'],
        rows: dss.map((d) => openRow(`sd:${d.id}`, [cell(d.id, { m: true, sub: d.desc }), cell(d.kind), cell(fmt(d.rows)), cell('Whole dataset · reference'), cell('', { p: dsPill(d) })], () => ui.go(`structured/${enc(d.id)}`), acc.canData ? [act('Remove', rm('ds', d.id))] : [])),
      },
      {
        title: 'Documents',
        empty: 'No documents in this collection.',
        sacts: acc.canData ? [act('Add documents…', () => addPick('docs'))] : [],
        cols: ['Document', 'Type', 'Language', 'Processing', 'Membership'],
        rows: [
          ...docs.map((d) => openRow(`sdo:${d.id}`, [cell(d.id, { m: true, sub: d.title }), cell(d.ty), cell(d.lang), cell('', { p: procPill(d) }), cell('Reference')], () => ui.go(`unstructured/${enc(d.id)}`), acc.canData ? [act('Remove', rm('docs', d.id))] : [])),
          ...(c.extraDocs ? [{ key: 'more', cells: [cell(`${c.extraDocs} more documents`, { sub: 'Same source and processing as the documents above' }), cell(''), cell(''), cell(''), cell('Reference')] } as Row] : []),
        ],
      },
    ];
  }

  if (tab === 'retrieval') {
    const S: Partial<DhSearch> = c.search ?? {};
    const sf = (lbl: string, key: keyof DhSearch, opts: string[], sub?: string) =>
      fr(lbl, S[key], sub, acc.canData ? [act('Edit', () => ui.form(lbl, [{ k: 'v', label: lbl, type: 'select', opts, val: S[key] ?? opts[0] }], 'Save', (v) => { upd((y) => { y.search = { ...EMPTY_SEARCH, ...(y.search ?? {}), [key]: String(v.v) }; }, `${lbl} saved.`); return ''; }))] : []);
    const sq = c.sq.length ? c.sq : dss.length ? ['Read-only structured query over the dataset'] : [];
    sections = [
      {
        form: true,
        title: 'Structured query',
        rows: dss.length
          ? [
              ...sq.map((q) => fr(q.split(' (')[0], q.includes('(') ? q.slice(q.indexOf('(') + 1, -1) : 'Available to assigned agents', q.startsWith('Read-only') ? 'Filters, aggregations and joins on declared keys' : 'Available to assigned agents')),
              fr('Datasets queried', dss.map((d) => d.id).join(', '), "Row-level results respect the caller's access"),
            ]
          : [fr('Structured query', 'Not available', 'This collection has no datasets')],
      },
      {
        form: true,
        title: 'Document search',
        rows: nd
          ? [
              sf('Search mode', 'mode', ['Hybrid (keyword + vector)', 'Vector only', 'Keyword only']),
              fr('Embedding model', S.emb, 'Set by the document processing profile in Data Ingestion Hub', [], { lock: 'Changing the embedding model requires re-indexing in Data Ingestion Hub' }),
              sf('Reranker', 'rr', ['—', 'bge-m3-match'], 'Re-orders results before they reach the agent'),
              sf('Results per query', 'k', ['4', '6', '8', '10']),
              sf('Minimum relevance', 'min', ['0.25', '0.30', '0.35', '0.40', '0.50']),
              sf('Cross-language search', 'xl', ['Off', 'On · Arabic ↔ English']),
            ]
          : [fr('Document search', 'Not available', 'This collection has no documents')],
      },
    ];
  }

  if (tab === 'access') {
    const ags = x.agentsOf(c.id);
    const cand = TENANT_AGENTS[T].filter((a) => !ags.includes(a) && acc.canAgent('agent:update', a));
    const setAg = (a: string, on: boolean) =>
      ui.setD((_d, all) => { all.agColl[a] = on ? [...(all.agColl[a] ?? []), c.id] : (all.agColl[a] ?? []).filter((q) => q !== c.id); }, on ? `${a} can now use ${c.id}.` : `${a} no longer uses ${c.id}.`);
    sections = [
      ...accessSections(h, `collection:${c.id}`),
      {
        title: 'Assigned agents',
        empty: 'No agent uses this collection.',
        sacts: cand.length ? [act('Assign to agent…', () => ui.form(`Assign ${c.id}`, [{ k: 'a', label: 'Agent', type: 'select', opts: cand, val: cand[0], hint: 'Only agents you are allowed to change are listed.' }], 'Assign', (v) => { setAg(String(v.a), true); return ''; }))] : [],
        cols: ['Agent', 'Uses', 'Other collections'],
        mode: 'inline',
        rows: ags.map((a): Row => ({
          key: `ag:${a}`,
          cells: [cell(a, { m: true }), cell([dss.length ? 'Structured query' : '', nd ? 'Document search' : ''].filter(Boolean).join(' · ')), cell((h.all.agColl[a] ?? []).filter((q) => q !== c.id).join(', ') || '—')],
          acts: [
            ...(T === 'sceai' && TENANT_AGENTS.sceai.includes(a) ? [act('Open agent', () => ui.go(`agents/${enc(a)}`))] : []),
            ...(acc.canAgent('agent:update', a) ? [act('Unassign', () => ui.confirm(`Remove ${c.id} from ${a}?`, `${a} will no longer search or query this collection.`, [], 'Remove', () => setAg(a, false)))] : []),
          ],
        })),
      },
      { title: 'Usage', cols: ['Measure', 'Value'], rows: [['Queries and searches · 7 days', fmt(c.uses7)], ['Last used', c.last], ['Assigned agents', String(ags.length)]].map(([k, v]) => ({ key: `u:${k}`, cells: [cell(k), cell(v)] })) },
      { form: true, rows: [fr('Agents and callers', 'Callers use their own access', "Assigning this collection to an agent does not give the agent's callers access. Each caller needs a read grant and the clearance shown above.")] },
    ];
  }
  return { head, sections };
}
const EMPTY_SEARCH: DhSearch = { mode: 'Hybrid (keyword + vector)', emb: 'embed-prod · qwen3-embedding', rr: '—', k: '6', min: '0.30', xl: 'Off' };

// ================================================================== STRUCTURED DATA
function instRows(h: Hub, list: EntityInst[], docId: string | null): Row[] {
  return list.map((e) => {
    const ev = e.ev.find((q) => !docId || q[0] === docId) ?? e.ev[0];
    return openRow(`in:${e.id}`, [
      cell(e.n, { sub: e.id }),
      cell(e.type),
      cell(`${Math.round(e.conf * 100)}%`),
      cell(e.rels.map(([rn, tid]) => `${rn} → ${h.D.inst.find((y) => y.id === tid)?.n ?? tid}`).join('; ') || '—'),
      cell(ev ? `${ev[1]} · ${ev[2]}` : '—'),
    ], () => h.ui.go(`entities?tab=inst&type=${enc(e.type)}`));
  });
}

export function datasetsScreen(h: Hub): ScreenModel {
  const x = derive(h);
  const { D, acc, ui } = h;
  const rows = D.datasets.filter((d) => x.visDs(d.id));
  return {
    head: { title: 'Structured Data' },
    sections: [
      {
        sacts: acc.canData ? [act('Open Ingestion Pipelines', () => ui.go('pipelines'))] : [],
        empty: 'No datasets you can open.',
        cols: ['Dataset', 'Type', 'Records', 'Fields', 'Source', 'Status', 'Collections', 'Updated'],
        rows: rows.map((d) => {
          const p = x.provOf(d.id, false).p;
          return openRow(`ds:${d.id}`, [
            cell(d.id, { m: true, sub: d.desc }),
            cell(d.kind),
            cell(fmt(d.rows)),
            cell(d.fields.length),
            cell(p ? `${p.src === 'manual' ? 'Manual upload' : p.src} · ${p.id}` : 'Maintained in KAP'),
            cell('', { p: dsPill(d) }),
            cell(x.collsOfDs(d.id).join(', ') || 'None'),
            cell(d.upd),
          ], () => ui.go(`structured/${enc(d.id)}`));
        }),
      },
    ],
  };
}

export const DATASET_TABS: [string, string][] = [['overview', 'Overview'], ['schema', 'Schema'], ['preview', 'Preview'], ['quality', 'Quality'], ['prov', 'Provenance'], ['usage', 'Access & Usage']];

export function datasetScreen(h: Hub, id: string, tab0: string | undefined): ScreenModel {
  const x = derive(h);
  const { D, acc, ui } = h;
  const d = D.datasets.find((y) => y.id === id);
  if (!d || !x.visDs(d.id)) return denied(h, 'dataset', id);
  const tab = DATASET_TABS.some(([k]) => k === tab0) ? tab0! : 'overview';
  const base = `structured/${enc(d.id)}`;
  const head: PageHead = { title: d.id, tabs: tabsOf(DATASET_TABS), tab, setTab: (v) => ui.go(v === 'overview' ? base : `${base}/${v}`) };
  const cs = x.collsOfDs(d.id);
  const tsF = d.fields.find((f) => f.ty === 'period' || f.ty === 'timestamp' || f.ty === 'date');
  const meas = d.fields.filter((f) => f.ty === 'decimal' || f.ty === 'integer' || f.ty === 'number');
  const keys = d.fields.filter((f) => (f.k || '').startsWith('Key')).map((f) => f.n);
  let sections: Section[] = [];

  if (tab === 'overview') {
    const ns = [...new Set(cs.map(x.label).filter(Boolean).join(', ').split(', ').filter(Boolean))];
    sections = [
      {
        form: true,
        rows: [
          fr('Description', d.desc),
          fr('Type', d.kind),
          fr('Records', fmt(d.rows)),
          fr('Fields', `${d.fields.length} fields`, keys.length ? `Keys: ${keys.join(', ')}` : ''),
          fr('Time dimension', tsF ? tsF.n : 'None', tsF ? `Measures: ${meas.map((f) => f.n).join(', ') || 'none'}` : ''),
          fr('Status', d.st, `Last update ${d.upd}`),
          fr('Access policies', x.polN(`dataset:${d.id}`) || 'None', ns.length ? `Collections add: ${ns.join(', ')}` : '', [], { lock: 'Managed in Roles & Permissions → Access Policies' }),
        ],
      },
    ];
  }
  if (tab === 'schema') sections = [{ cols: ['Field', 'Type', 'Description', 'Key or unit'], rows: d.fields.map((f) => ({ key: `fd:${f.n}`, cells: [cell(f.n, { m: true }), cell(f.ty), cell(f.d), cell(f.k || '—')] })) }];
  if (tab === 'preview') sections = [{ cols: d.fields.map((f) => f.n), empty: 'No preview rows.', rows: d.preview.map((r, i) => ({ key: `pv:${i}`, cells: r.map((v, j) => cell(v, { m: j === 0 })) })) }];
  if (tab === 'quality') sections = [{ cols: ['Check', 'Result', 'Detail', 'Checked'], rows: qualityRows(h, d).map(([k, p, det, w]) => ({ key: `q:${k}`, cells: [cell(k), cell('', { p }), cell(det), cell(w)] })) }];
  if (tab === 'prov')
    sections = [
      { form: true, title: 'Source and ingestion', rows: x.provRows(d.id, false, [fr('Last update', d.upd), fr('Version', d.files[0]?.[1] ?? '—', d.files[0]?.[0] ?? '')]) },
      { title: 'Source files and versions', empty: 'No source files.', cols: ['File', 'Version', 'Rows', 'Loaded'], rows: d.files.map((f) => ({ key: `fl:${f[0]}`, cells: [cell(f[0], { m: true }), cell(f[1]), cell(f[2]), cell(f[3])] })) },
    ];
  if (tab === 'usage') {
    const cand = D.collections.filter((c) => !c.ds.includes(d.id)).map((c) => c.id);
    sections = [
      ...accessSections(h, `dataset:${d.id}`),
      {
        title: 'Collections',
        note: cs.length ? '' : 'Not in any collection.',
        sacts: acc.canData && cand.length ? [act('Add to collection…', () => addToCollections(h, d.id, 'ds', cand))] : [],
        cols: ['Collection', 'Description', 'Agents'],
        rows: cs.filter(acc.canRead).map((cid) => openRow(`uc:${cid}`, [cell(cid, { m: true }), cell(D.collections.find((c) => c.id === cid)?.desc || '—'), cell(x.agentsOf(cid).join(', ') || '—')], () => ui.go(`collections/${enc(cid)}`))),
      },
      { title: 'Extracted entities', cols: ['Entity', 'Type', 'Confidence', 'Relationships', 'Evidence'], empty: 'No entities extracted from this dataset.', rows: instRows(h, x.instOf('dataset', d.id), null) },
    ];
  }
  return { head, sections };
}

/** Quality checks of a dataset: [check, result pill, detail, checked]. */
export function qualityRows(h: Hub, d: DhDataset): [string, [DsStatus, string], string, string][] {
  const lr = derive(h).provOf(d.id, false).r;
  const dup = lr?.dedup ?? '';
  const nul = ((d.id.length * 7) % 9) / 10;
  const comp = `${(100 - nul).toFixed(1)}%`;
  const keys = d.fields.filter((f) => (f.k || '').startsWith('Key')).map((f) => f.n);
  const when = lr ? lr.start : d.upd;
  const age = /(\d+) d ago/.exec(d.upd);
  return [
    ['Required fields present', ['approved', 'Passed'], `${comp} of values complete`, when],
    ['Types match the schema', ['approved', 'Passed'], `${d.fields.length} fields validated`, when],
    ['Duplicate keys', dup ? ['hold', 'Corrected'] : ['approved', 'None'], dup || (keys.length ? `Unique on ${keys.join(', ')}` : 'No key declared'), when],
    ['Freshness', age && +age[1] > 30 ? ['hold', 'Stale'] : ['approved', 'Current'], `Last update ${d.upd}`, 'just now'],
  ];
}

function addToCollections(h: Hub, id: string, kind: 'ds' | 'docs', cand: string[]) {
  h.ui.form(`Add ${id} to a collection`, [{ k: 'v', label: 'Collections', type: 'chips', opts: cand, val: [] }], 'Add', (v) => {
    const sel: string[] = v.v ?? [];
    if (!sel.length) return 'Select at least one collection.';
    h.ui.setD((d) => { sel.forEach((cid) => d.collections.find((c) => c.id === cid)?.[kind].push(id)); }, `${id} added to ${sel.join(', ')}.`);
    return '';
  });
}

// ================================================================== UNSTRUCTURED DATA
const UD_LBL: Record<string, string> = { ty: 'Document type', pst: 'Processing status', coll: 'Collection', src: 'Data source', pipe: 'Pipeline', lang: 'Language', cls: 'Classification', date: 'Ingestion date' };
const UD_KEYS = ['coll', 'ty', 'pst', 'src', 'pipe', 'lang', 'cls', 'date'] as const;
type UdKey = (typeof UD_KEYS)[number];

/** Documents the viewer may see, filtered and sorted as in the prototype. */
export function documentResults(h: Hub, F: UdFilters) {
  const x = derive(h);
  const all = h.D.documents.filter((d) => x.visDoc(d.id));
  const M = Object.fromEntries(all.map((d) => [d.id, x.metaOf(d)]));
  const OPT: Record<UdKey | 'sort', string[]> = {
    ty: ['All types', ...uniqSorted(all.map((d) => d.ty))],
    pst: ['All statuses', 'Pending', 'Processing', 'Completed', 'Failed'],
    coll: ['All collections', 'Not assigned', ...h.D.collections.map((c) => c.id).filter(h.acc.canRead)],
    src: ['All data sources', ...uniqSorted(all.map((d) => M[d.id].src).filter((s) => s !== '—'))],
    pipe: ['All pipelines', ...uniqSorted(all.map((d) => M[d.id].p?.id))],
    lang: ['All languages', ...uniqSorted(all.flatMap((d) => String(d.lang).split(', ')).filter((l) => l !== '—'))],
    cls: ['All classifications', ...uniqSorted(h.iam.policies.filter((p) => p.t === h.t && p.kind === 'Classification').map((p) => p.n)), 'Unclassified'],
    date: ['Any time', 'Last 7 days', 'Last 30 days', 'Last 90 days', 'Last 12 months', 'Custom range'],
    sort: ['Newest first', 'Oldest first', 'Name A–Z', 'Name Z–A', 'Most pages'],
  };
  const lo = F.date === 'Custom range' ? F.from : ({ 'Last 7 days': dayAgo(7), 'Last 30 days': dayAgo(30), 'Last 90 days': dayAgo(90), 'Last 12 months': dayAgo(365) } as Record<string, string>)[F.date] || '';
  const hi = F.date === 'Custom range' ? F.to : '';
  const q = F.q.trim().toLowerCase();
  const D0 = UD_DEFAULT;
  const rows = all.filter(
    (d) =>
      (!q || d.id.toLowerCase().includes(q) || (d.title || '').toLowerCase().includes(q)) &&
      (F.ty === D0.ty || d.ty === F.ty) &&
      (F.pst === D0.pst || d.pst === F.pst) &&
      (F.coll === D0.coll || (F.coll === 'Not assigned' ? !x.collsOfDoc(d.id).length : x.collsOfDoc(d.id).includes(F.coll))) &&
      (F.src === D0.src || M[d.id].src === F.src) &&
      (F.pipe === D0.pipe || M[d.id].p?.id === F.pipe) &&
      (F.lang === D0.lang || String(d.lang).split(', ').includes(F.lang)) &&
      (F.cls === D0.cls || (F.cls === 'Unclassified' ? !d.cls : d.cls === F.cls)) &&
      (!lo || d.at >= lo) &&
      (!hi || d.at <= hi),
  );
  const cmp: Record<string, (a: DhDocument, b: DhDocument) => number> = {
    'Newest first': (a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id),
    'Oldest first': (a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id),
    'Name A–Z': (a, b) => a.id.localeCompare(b.id),
    'Name Z–A': (a, b) => b.id.localeCompare(a.id),
    'Most pages': (a, b) => (b.pages || 0) - (a.pages || 0),
  };
  rows.sort(cmp[F.sort] ?? cmp['Newest first']);
  return { all, rows, M, OPT, ids: rows.map((d) => d.id) };
}

export function documentsScreen(h: Hub, F: UdFilters, setF: (f: UdFilters) => void): ScreenModel {
  const x = derive(h);
  const { acc, ui } = h;
  const { all, rows, M, OPT } = documentResults(h, F);
  const set = (k: keyof UdFilters, v: string | number) => setF({ ...F, [k]: v, page: k === 'page' ? Number(v) : 1 });
  const size = F.size || 25;
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const pg = Math.min(F.page, pages);
  const view = rows.slice((pg - 1) * size, pg * size);
  const q = F.q.trim();
  const active = UD_KEYS.filter((k) => F[k] !== UD_DEFAULT[k]);
  const chips = [
    ...(q ? [{ l: `Search: ${F.q}`, x: () => set('q', '') }] : []),
    ...active.map((k) => ({ l: `${UD_LBL[k]}: ${k === 'date' && F.date === 'Custom range' ? `${F.from || '…'} – ${F.to || '…'}` : F[k]}`, x: () => setF({ ...F, [k]: UD_DEFAULT[k], page: 1 }) })),
  ];
  const advN = (['src', 'pipe', 'lang', 'cls', 'date'] as const).filter((k) => F[k] !== UD_DEFAULT[k]).length;
  const sel = (k: UdKey | 'sort', label: string) => ({ label, value: F[k], options: OPT[k], onChange: (v: string) => set(k, v) });
  const filters: Filters = {
    q: F.q,
    qLabel: 'Search',
    qPlaceholder: 'Document name or ID',
    setQ: (v) => set('q', v),
    main: [sel('coll', 'Collection'), sel('ty', 'Document type'), sel('pst', 'Processing status'), sel('sort', 'Sort by')],
    adv: [
      sel('src', 'Data source'), sel('pipe', 'Pipeline'), sel('lang', 'Language'), sel('cls', 'Classification'), sel('date', 'Ingestion date'),
      ...(F.date === 'Custom range' ? [{ label: 'From', value: F.from, date: true, onChange: (v: string) => set('from', v) }, { label: 'To', value: F.to, date: true, onChange: (v: string) => set('to', v) }] : []),
    ],
    advLabel: `More filters${advN ? ` (${advN})` : ''}`,
    chips,
    clear: () => setF({ ...UD_DEFAULT, sort: F.sort, size: F.size }),
    count: `${fmt(rows.length)}${rows.length === 1 ? ' matching document' : ' matching documents'} of ${fmt(all.length)}`,
  };
  const hasUpload = h.ing.pipelines.some((p) => p.id === 'manual_uploads');
  return {
    head: { title: 'Unstructured Data' },
    filters,
    sections: [
      {
        sacts: acc.canData ? [...(hasUpload ? [act('Upload files', () => ui.go('pipelines/manual_uploads'))] : []), act('Open Ingestion Pipelines', () => ui.go('pipelines'))] : [],
        empty: chips.length ? `No documents match ${chips.map((c) => c.l).join(' · ')}. Remove a filter or clear all.` : 'No documents yet. Upload files or run an ingestion pipeline.',
        cols: ['Document', 'Type', 'Classification', 'Processing', 'Entities', 'Collections', 'Source', 'Ingested'],
        pager: {
          l: rows.length ? `${fmt((pg - 1) * size + 1)}–${fmt(Math.min(pg * size, rows.length))} of ${fmt(rows.length)}` : '0 documents',
          size,
          setSize: (n) => setF({ ...F, size: n, page: 1 }),
          pg: `Page ${pg} of ${pages}`,
          prev: () => pg > 1 && set('page', pg - 1),
          next: () => pg < pages && set('page', pg + 1),
          prevOff: pg <= 1,
          nextOff: pg >= pages,
        },
        rows: view.map((d) => {
          const cs = x.collsOfDoc(d.id);
          return openRow(`doc:${d.id}`, [
            cell(d.id, { m: true, sub: d.title }),
            cell(d.ty, { sub: d.lang === '—' ? '' : d.lang }),
            cell(d.cls || 'Unclassified'),
            cell('', { p: pstP(d.pst), tip: d.err || '' }),
            cell('', { p: entP(d) }),
            cell(cs.filter(acc.canRead).join(', ') || (cs.length ? 'In a collection you cannot open' : 'Not assigned')),
            cell(M[d.id].src, { sub: M[d.id].p ? M[d.id].p!.id : '' }),
            cell(d.at.replace(/-/g, '‑')),
          ], () => ui.go(`unstructured/${enc(d.id)}`));
        }),
      },
    ],
  };
}

export const DOCUMENT_TABS: [string, string][] = [['overview', 'Overview'], ['versions', 'Source files & versions'], ['proc', 'Processing'], ['content', 'Extracted content'], ['ents', 'Entities'], ['usage', 'Usage']];

/** Document detail. `results` = ids of the last Unstructured Data result list (Previous / Next). */
export function documentScreen(h: Hub, id: string, tab0: string | undefined, results: string[] | null): ScreenModel {
  const x = derive(h);
  const { D, acc, ui, iam: IAM, t: T } = h;
  const d = D.documents.find((y) => y.id === id);
  if (!d || !x.visDoc(d.id)) return denied(h, 'document', id);
  const tab = DOCUMENT_TABS.some(([k]) => k === tab0) ? tab0! : 'overview';
  const base = `unstructured/${enc(d.id)}`;
  const sub = tab === 'overview' ? '' : `/${tab}`;
  const ui0 = results ? results.indexOf(d.id) : -1;
  const docActs: Action[] =
    results && ui0 >= 0
      ? [
          act(`Back to results · ${ui0 + 1} of ${results.length}`, () => ui.go('unstructured')),
          ...(ui0 > 0 ? [act('Previous', () => ui.go(`unstructured/${enc(results[ui0 - 1])}${sub}`))] : []),
          ...(ui0 < results.length - 1 ? [act('Next', () => ui.go(`unstructured/${enc(results[ui0 + 1])}${sub}`))] : []),
        ]
      : [];
  const head: PageHead = { title: d.id, tabs: tabsOf(DOCUMENT_TABS), tab, setTab: (v) => ui.go(v === 'overview' ? base : `${base}/${v}`), acts: docActs };
  const cs = x.collsOfDoc(d.id);
  const M0 = x.metaOf(d);
  const canPol = acc.canGrant;
  const CLS = IAM.policies.filter((p) => p.t === T && p.kind === 'Classification').map((p) => p.n);
  const NTK = IAM.policies.filter((p) => p.t === T && p.kind === 'Need-to-know');
  const key = `document:${d.id}`;
  const myNtk = NTK.filter((p) => p.res.includes(key));
  const setCls = () =>
    ui.form(`Classification · ${d.id}`, [{ k: 'v', label: 'Classification', type: 'select', opts: CLS, val: d.cls || CLS[0], hint: 'Applies to this document in every collection that references it.' }], 'Save', (v) => {
      if (v.v === d.cls) return 'No change.';
      ui.setD((y) => { const q = y.documents.find((z) => z.id === d.id); if (q) q.cls = String(v.v); }, `${d.id} classified ${v.v}.`);
      return '';
    });
  const setNtk = () =>
    ui.form(`Need-to-know · ${d.id}`, [{ k: 'v', label: 'Need-to-know policies', type: 'chips', opts: NTK.map((p) => p.n), val: myNtk.map((p) => p.n) }], 'Save', (v) => {
      const sel: string[] = v.v ?? [];
      const add = sel.filter((n) => !myNtk.some((p) => p.n === n));
      const rem = myNtk.filter((p) => !sel.includes(p.n)).map((p) => p.n);
      if (!add.length && !rem.length) return 'No change.';
      ui.setIam((n) => {
        n.policies.filter((p) => p.t === T && p.kind === 'Need-to-know').forEach((p) => {
          if (add.includes(p.n) && !p.res.includes(key)) p.res.push(key);
          if (rem.includes(p.n)) p.res = p.res.filter((y) => y !== key);
        });
      }, `Need-to-know policies for ${d.id} saved.`);
      return '';
    });
  let sections: Section[] = [];

  if (tab === 'overview')
    sections = [
      {
        form: true,
        rows: [
          fr('Title', d.title),
          fr('Type', d.ty),
          fr('Language', d.lang),
          fr('Pages or messages', d.pages || '—'),
          fr('Latest version', d.vers[0][0], d.vers[0][1] + (d.vers[0][2] ? ` · ${d.vers[0][2]}` : '')),
          fr('Ingested', d.at, M0.p ? `${M0.src} · ${M0.p.id}` : ''),
          fr('Processing', d.pst, d.err || ''),
          fr('Classification', d.cls || 'Unclassified', cs.length ? '' : 'Not in any collection', canPol && CLS.length ? [act('Change', setCls)] : []),
          fr('Need-to-know', myNtk.map((p) => p.n).join(', ') || 'None', '', canPol && NTK.length ? [act('Edit', setNtk)] : []),
          fr('Collection restrictions', [...new Set(cs.flatMap((c) => x.polOf(`collection:${c}`).map((p) => p.n)))].join(', ') || 'None', cs.length ? `Apply when the document is used through ${cs.join(', ')}` : ''),
          fr('Entity extraction', entP(d)[1], d.entSt === 'Failed' ? 'Extraction failed in the last run' : ''),
        ],
      },
    ];
  if (tab === 'versions') sections = [{ cols: ['Version', 'Received', 'Note'], rows: d.vers.map((v) => ({ key: `v:${v[0]}`, cells: [cell(v[0], { m: true }), cell(v[1]), cell(v[2] || '—')] })) }];
  if (tab === 'proc') {
    const { p, r } = M0;
    sections = [
      {
        form: true,
        sacts: acc.canData && p ? [act('Open pipeline', () => ui.go(`pipelines/${enc(p.id)}/config`))] : [],
        rows: [
          fr('Status', d.pst, d.err || ''),
          fr('Text extraction', d.ex, d.err || ''),
          fr('Chunking', d.chunks ? `${d.chunks} chunks` : '—', p?.chunk ? p.chunk : 'By heading, about 800 tokens with 100-token overlap'),
          fr('Embedding model', 'embed-prod · qwen3-embedding', '1024 dimensions'),
          fr('Index', d.idx, ''),
          fr('Entity extraction', d.entSt, d.entSt === 'Completed' ? `${d.entN} entities` : ''),
          fr('Processing pipeline', p ? p.id : '—', p ? p.uSteps.join(' → ') : '', p ? [act('Open', () => ui.go(`pipelines/${enc(p.id)}/config`))] : []),
          fr('Last run', r ? `${r.id} · ${r.start} · ${r.st}` : '—', '', r ? [act('Open', () => ui.go(`runs/${enc(r.id)}/items`))] : []),
        ],
      },
    ];
  }
  if (tab === 'content')
    sections =
      d.ex === 'Failed'
        ? [{ form: true, rows: [fr('Extracted content', 'Not available', d.err)] }]
        : [
            { form: true, title: 'Extracted text', rows: [fr('Beginning of document', d.text, d.pages ? `${d.pages} pages` : '')] },
            { title: 'Chunks', cols: ['Chunk', 'Tokens', 'Excerpt'], rows: [1, 2, 3].filter((i) => i <= d.chunks).map((i) => ({ key: `ch:${i}`, cells: [cell(`#${i}`, { m: true }), cell(String(780 - i * 37)), cell(`${d.text.slice(0, 90 - i * 10)}…`)] })) },
          ];
  if (tab === 'ents') {
    let list = x.instOf('document', d.id);
    let ex = false;
    if (!list.length && d.entSt === 'Completed') {
      const tys = M0.p?.entTypes ?? [];
      list = D.inst.filter((e) => x.instVis(e) && tys.includes(e.type)).slice(0, Math.min(3, d.entN));
      ex = true;
    }
    sections = [
      {
        form: true,
        rows: [
          fr('Extraction', d.entSt, d.entSt === 'Completed' ? `${d.entN} entities · ${M0.p ? `types: ${(M0.p.entTypes ?? []).join(', ') || '—'}` : ''}` : d.entSt === 'Not processed' ? 'The pipeline that ingested this document does not extract entities' : ''),
          fr('Last extraction run', M0.r ? `${M0.r.id} · ${M0.r.start}` : '—', '', M0.r ? [act('Open', () => ui.go(`runs/${enc(M0.r!.id)}/stages`))] : []),
        ],
      },
      { title: ex ? 'Examples' : 'Extracted entities', cols: ['Entity', 'Type', 'Confidence', 'Relationships', 'Evidence'], empty: d.entSt === 'Completed' ? 'No entities you can view.' : 'No entities extracted.', rows: instRows(h, list, ex ? null : d.id) },
    ];
  }
  if (tab === 'usage') {
    const cand = D.collections.filter((c) => !c.docs.includes(d.id)).map((c) => c.id);
    sections = [
      {
        title: 'Collections',
        note: cs.length ? '' : 'Not in any collection.',
        sacts: acc.canData && cand.length ? [act('Add to collection…', () => addToCollections(h, d.id, 'docs', cand))] : [],
        cols: ['Collection', 'Description', 'Agents'],
        rows: cs.filter(acc.canRead).map((cid) => openRow(`uc:${cid}`, [cell(cid, { m: true }), cell(D.collections.find((c) => c.id === cid)?.desc || '—'), cell(x.agentsOf(cid).join(', ') || '—')], () => ui.go(`collections/${enc(cid)}`))),
      },
      { form: true, title: 'Source and ingestion', rows: x.provRows(d.id, true, [fr('Latest version', d.vers[0][0], d.vers[0][1])]) },
    ];
  }
  return { head, sections };
}

// ================================================================== BUSINESS ENTITIES · tenant ontology
export const ENTITY_TABS: [string, string][] = [['types', 'Entity Types'], ['rels', 'Relationship Types'], ['map', 'Ontology Map'], ['inst', 'Extracted Entities'], ['agents', 'Agent Usage']];
const DT = ['Text', 'Number', 'Date', 'Category', 'Boolean', 'Reference'];

export interface EntitiesView {
  tab?: string;
  setTab: (t: string) => void;
  /** Extracted Entities filter ('All types' or an entity type) */
  type?: string;
  setType: (t: string) => void;
  /** selected entity type on the Ontology Map */
  sel?: string | null;
  setSel: (t: string | null) => void;
}

/** Deterministic force layout of the ontology map: connected types sit close, unrelated ones spread out. */
export function ontologyLayout(types: OntoType[], rels: { src: string; tgt: string }[]): { x: number; y: number }[] {
  const tyN = types.map((t) => t.n);
  const n = types.length;
  const P = types.map((_t, i) => {
    const a0 = -Math.PI / 2 + (i * 2 * Math.PI) / Math.max(n, 1);
    return [Math.cos(a0) * 200, Math.sin(a0) * 140];
  });
  const E = rels.filter((r) => r.src !== r.tgt).map((r) => [tyN.indexOf(r.src), tyN.indexOf(r.tgt)]).filter(([i, j]) => i >= 0 && j >= 0);
  for (let it = 0, tmp = 60; it < 400; it++, tmp *= 0.985) {
    const D0 = P.map(() => [0, 0]);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (i !== j) {
          const dx = (P[i][0] - P[j][0]) / 1.6, dy = P[i][1] - P[j][1];
          const d = Math.max(1, Math.hypot(dx, dy));
          const f = 26000 / (d * d);
          D0[i][0] += (dx / d) * f * 1.6;
          D0[i][1] += (dy / d) * f;
        }
    E.forEach(([i, j]) => {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1];
      const d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - 230) * 0.06;
      D0[i][0] -= (dx / d) * f; D0[i][1] -= (dy / d) * f;
      D0[j][0] += (dx / d) * f; D0[j][1] += (dy / d) * f;
    });
    P.forEach((p, i) => {
      const l = Math.max(1, Math.hypot(D0[i][0], D0[i][1]));
      p[0] += (D0[i][0] / l) * Math.min(l, tmp);
      p[1] += (D0[i][1] / l) * Math.min(l, tmp);
    });
  }
  if (!n) return [];
  const mnx = Math.min(...P.map((p) => p[0])) - 85, mny = Math.min(...P.map((p) => p[1])) - 26;
  const top = rels.some((r) => r.src === r.tgt) ? 64 : 16;
  return P.map((p) => ({ x: p[0] - mnx + 16 - 85, y: p[1] - mny + top - 26 }));
}

export function entitiesScreen(h: Hub, v: EntitiesView): ScreenModel {
  const x = derive(h);
  const { D, acc, ui, t: T } = h;
  const tab = ENTITY_TABS.some(([k]) => k === v.tab) ? v.tab! : 'types';
  const head: PageHead = { title: 'Business Entities', tabs: tabsOf(ENTITY_TABS), tab, setTab: v.setTab };
  const TY = D.onto.types, RL = D.onto.rels;
  const tyN = TY.map((t) => t.n);
  const canData = acc.canData;
  const setO = (fn: (o: TenantData['onto']) => void, toast: string) => ui.setD((d) => fn(d.onto), toast);
  const relsOf = (n: string) => RL.filter((r) => r.src === n || r.tgt === n);
  const pipesOf = (n: string) => h.ing.pipelines.filter((p) => (p.entTypes ?? []).includes(n)).map((p) => p.id);
  let sections: Section[] = [];

  if (tab === 'types') {
    const typeForm = (t0: OntoType | null) =>
      ui.form(
        t0 ? `Edit entity type · ${t0.n}` : 'Create entity type',
        [
          { k: 'n', label: 'Name', type: 'text', val: t0 ? t0.n : '', ro: !!t0, ph: 'e.g. Supplier' },
          { k: 'd', label: 'Description', type: 'text', val: t0 ? t0.d : '' },
          ...(t0
            ? []
            : ([
                { k: 'idn', label: 'Identifier attribute', type: 'text', ph: 'e.g. supplier ID', hint: 'Used to recognise the same entity across sources.' },
                { k: 'idt', label: 'Identifier data type', type: 'select', opts: DT.filter((y) => y !== 'Reference' && y !== 'Boolean'), val: 'Text' },
              ] as FormField[])),
          { k: 'g', label: 'Extraction guidance (optional)', type: 'text', val: t0 ? t0.guide : '', ph: 'e.g. Only suppliers named with a contract or invoice' },
        ],
        t0 ? 'Save' : 'Create',
        (f) => {
          const n = String(f.n ?? '').trim();
          if (!t0) {
            if (n.length < 2) return 'Enter a name.';
            if (TY.some((t) => t.n.toLowerCase() === n.toLowerCase())) return 'This entity type exists.';
            if (!String(f.idn ?? '').trim()) return 'Enter the identifier attribute.';
          }
          if (t0) setO((o) => { const t = o.types.find((y) => y.n === t0.n); if (t) Object.assign(t, { d: String(f.d ?? '').trim(), guide: String(f.g ?? '').trim() }); }, `${t0.n} saved.`);
          else setO((o) => { o.types.push({ n, d: String(f.d ?? '').trim(), attrs: [{ n: String(f.idn).trim(), ty: String(f.idt || 'Text'), id: true, req: true, hint: '' }], guide: String(f.g ?? '').trim(), cnt: 0 }); }, `${n} created. Pipelines extract it once it is selected in their entity extraction stage.`);
          return '';
        },
      );
    const attrForm = (t0: OntoType) =>
      ui.form(`Add attribute · ${t0.n}`, [
        { k: 'n', label: 'Attribute', type: 'text', val: '' },
        { k: 'ty', label: 'Data type', type: 'select', opts: DT, val: 'Text' },
        { k: 'req', label: 'Required', type: 'select', opts: ['No', 'Yes'], val: 'No' },
        { k: 'hint', label: 'Extraction hint (optional)', type: 'text', val: '' },
      ], 'Add', (f) => {
        const n = String(f.n ?? '').trim();
        if (!n) return 'Enter the attribute name.';
        if (t0.attrs.some((a) => a.n.toLowerCase() === n.toLowerCase())) return 'This attribute exists.';
        setO((o) => { o.types.find((y) => y.n === t0.n)?.attrs.push({ n, ty: String(f.ty), id: false, req: f.req === 'Yes', hint: String(f.hint ?? '').trim() }); }, `Attribute ${n} added to ${t0.n}.`);
        return '';
      });
    const del = (t: OntoType) => {
      const rs = relsOf(t.n), ps = pipesOf(t.n);
      const items = [...rs.map((r) => ({ a: r.n, b: 'Relationship type', c: `${r.src} → ${r.tgt}` })), ...ps.map((p) => ({ a: p, b: 'Pipeline', c: 'Entity extraction stage' }))];
      // the prototype's confirm is blocked while the type is in use
      if (items.length) return ui.form(`Delete entity type ${t.n}?`, [{ type: 'note', tone: 'warn', text: 'Remove what uses it first:' }, { type: 'kv', rows: items.map((i) => [i.a, `${i.b} · ${i.c}`]) }], 'Close', () => '');
      ui.confirm(`Delete entity type ${t.n}?`, `${fmt(t.cnt)} extracted entities of this type are removed from the Entity Store.`, [], 'Delete', () => setO((o) => { o.types = o.types.filter((y) => y.n !== t.n); }, `${t.n} deleted.`));
    };
    head.add = canData ? act('Create entity type', () => typeForm(null), 'primary') : undefined;
    sections = [
      {
        empty: 'No entity types yet.',
        cols: ['Entity type', 'Identifier', 'Attributes', 'Relationship types', 'Extracted', 'Used by pipelines'],
        mode: 'panel',
        rows: TY.map((t): Row => {
          const rs = relsOf(t.n), ps = pipesOf(t.n);
          const idA = t.attrs.find((a) => a.id);
          return {
            key: `t:${t.n}`,
            cells: [cell(t.n, { sub: t.d }), cell(idA ? idA.n : '—'), cell(String(t.attrs.length)), cell(String(rs.length)), cell(fmt(t.cnt)), cell(ps.join(', ') || 'None')],
            kv: kv([['Extraction guidance', t.guide]]),
            lists: [
              {
                title: 'Attributes',
                empty: 'None',
                items: t.attrs.map((a) => ({
                  a: a.n,
                  b: a.ty + (a.id ? ' · identifier' : a.req ? ' · required' : ''),
                  c: a.hint,
                  x: canData && !a.id ? () => ui.confirm(`Remove attribute ${a.n} from ${t.n}?`, 'Values already extracted for it are kept until the next extraction run.', [], 'Remove', () => setO((o) => { const y = o.types.find((q) => q.n === t.n); if (y) y.attrs = y.attrs.filter((q) => q.n !== a.n); }, `${a.n} removed.`)) : undefined,
                  xl: canData && !a.id ? 'Remove' : '',
                })),
              },
              { title: 'Relationship types', empty: 'None', items: rs.map((r) => ({ a: r.n, b: r.src + (r.dir === 'Bidirectional' ? ' ↔ ' : ' → ') + r.tgt, c: r.card })) },
            ],
            acts: canData ? [act('Add attribute', () => attrForm(t)), act('Edit', () => typeForm(t)), act('Delete', () => del(t), 'ghost')] : [],
          };
        }),
      },
    ];
  }

  if (tab === 'rels') {
    const relForm = (r0: (typeof RL)[number] | null) =>
      ui.form(
        r0 ? `Edit relationship type · ${r0.n}` : 'Create relationship type',
        [
          { k: 'n', label: 'Name', type: 'text', val: r0 ? r0.n : '', ro: !!r0, ph: 'e.g. supplies' },
          { k: 'src', label: 'Source entity type', type: 'select', opts: tyN, val: r0 ? r0.src : tyN[0] },
          { k: 'tgt', label: 'Target entity type', type: 'select', opts: tyN, val: r0 ? r0.tgt : tyN[1] || tyN[0] },
          { k: 'dir', label: 'Direction', type: 'select', opts: ['Directed', 'Bidirectional'], val: r0 ? r0.dir : 'Directed' },
          { k: 'card', label: 'Cardinality', type: 'select', opts: ['One-to-one', 'One-to-many', 'Many-to-one', 'Many-to-many'], val: r0 ? r0.card : 'Many-to-many' },
          { k: 'ev', label: 'Evidence required', type: 'select', opts: ['Same sentence', 'Same paragraph', 'Same document', 'Same record'], val: r0 ? r0.ev : 'Same paragraph', hint: 'Both entities must be found within this scope.' },
          { k: 'g', label: 'Extraction guidance (optional)', type: 'text', val: r0 ? r0.guide : '' },
        ],
        r0 ? 'Save' : 'Create',
        (f) => {
          const n = String(f.n ?? '').trim();
          if (!r0) {
            if (!/^[a-z][a-z0-9_]{1,40}$/.test(n)) return 'Name: lower-case letters, digits and underscores.';
            if (RL.some((r) => r.n === n && r.src === f.src && r.tgt === f.tgt)) return 'This relationship type exists for these entity types.';
          }
          if (!tyN.includes(f.src) || !tyN.includes(f.tgt)) return 'Select source and target entity types.';
          if (f.dir === 'Bidirectional' && f.src !== f.tgt && (f.card === 'One-to-many' || f.card === 'Many-to-one')) return 'A bidirectional relationship needs symmetric cardinality: one-to-one or many-to-many.';
          const rec = { src: String(f.src), tgt: String(f.tgt), dir: f.dir as 'Directed' | 'Bidirectional', card: String(f.card), ev: String(f.ev), guide: String(f.g ?? '').trim() };
          if (r0) setO((o) => { const r = o.rels.find((q) => q.n === r0.n && q.src === r0.src && q.tgt === r0.tgt); if (r) Object.assign(r, rec); }, `${r0.n} saved.`);
          else setO((o) => { o.rels.push({ n, ...rec, cnt: 0 }); }, `${n} created.`);
          return '';
        },
      );
    head.add = canData && TY.length > 0 ? act('Create relationship type', () => relForm(null), 'primary') : undefined;
    sections = [
      {
        empty: 'No relationship types yet.',
        cols: ['Relationship', 'Source', 'Target', 'Direction', 'Cardinality', 'Evidence', 'Extracted'],
        rows: RL.map((r): Row => ({
          key: `r:${r.n}${r.src}${r.tgt}`,
          cells: [cell(r.n, { m: true, tip: r.guide }), cell(r.src), cell(r.tgt), cell(r.dir), cell(r.card), cell(r.ev), cell(fmt(r.cnt))],
          acts: canData
            ? [act('Edit', () => relForm(r)), act('Delete', () => ui.confirm(`Delete relationship type ${r.n}?`, `${fmt(r.cnt)} extracted relationships of this type are removed from the Entity Store.`, [], 'Delete', () => setO((o) => { o.rels = o.rels.filter((q) => !(q.n === r.n && q.src === r.src && q.tgt === r.tgt)); }, `${r.n} deleted.`)), 'ghost')]
            : [],
        })),
      },
    ];
  }

  if (tab === 'map') sections = [{ dgm: ontologyMap(h, v.sel ?? null, v.setSel) }, ...(TY.length ? [] : [{ cols: ['Entity type'], rows: [], empty: 'Create entity types to see the ontology.' } as Section])];

  if (tab === 'inst') {
    const vis = D.inst.filter(x.instVis);
    const fT = v.type && tyN.includes(v.type) ? v.type : 'All types';
    const list = vis.filter((e) => fT === 'All types' || e.type === fT);
    sections = [
      {
        title: 'By entity type',
        cols: ['Entity type', 'Extracted', 'Relationships', 'Last extraction'],
        mode: 'inline',
        rows: TY.map((t): Row => {
          const rid = D.inst.find((e) => e.type === t.n)?.run;
          return {
            key: `it:${t.n}`,
            cells: [cell(t.n), cell(fmt(t.cnt)), cell(fmt(relsOf(t.n).filter((r) => r.src === t.n).reduce((a, r) => a + r.cnt, 0))), cell(rid ? `${rid} · ${h.ing.runs.find((r) => r.id === rid)?.start ?? ''}` : '—')],
            quick: [act('Show examples', () => v.setType(t.n))],
          };
        }),
      },
      {
        title: `Examples${fT !== 'All types' ? ` · ${fT}` : ''}`,
        sacts: fT !== 'All types' ? [act('Show all types', () => v.setType('All types'))] : [],
        empty: 'No extracted entities you can view.',
        cols: ['Entity', 'Type', 'Confidence', 'Sources', 'Relationships'],
        mode: 'panel',
        rows: list.map((e): Row => {
          const srcs = e.src.filter(([k, id]) => (k === 'dataset' ? x.visDs(id) : x.visDoc(id)));
          return {
            key: `x:${e.id}`,
            cells: [cell(e.n, { sub: e.id }), cell(e.type), cell(`${Math.round(e.conf * 100)}%`), cell(plural(srcs.length, 'source', 'sources')), cell(String(e.rels.length))],
            kv: kv([...e.attrs, ['Type', e.type], ['Confidence', `${Math.round(e.conf * 100)}%`], ['Extracted by', e.run]]),
            keepKv: true,
            lists: [
              { title: 'Relationships', empty: 'None', items: e.rels.map(([rn, tid, cf]) => ({ a: rn, b: D.inst.find((y) => y.id === tid)?.n ?? tid, c: `${Math.round(cf * 100)}% confidence` })) },
              { title: 'Sources', empty: 'None you can view', items: srcs.map(([k, id]) => ({ a: id, b: k === 'dataset' ? 'Structured Data' : 'Unstructured Data', c: '', x: () => ui.go(k === 'dataset' ? `structured/${enc(id)}` : `unstructured/${enc(id)}/ents`), xl: 'Open' })) },
              { title: 'Evidence', empty: 'None you can view', items: e.ev.filter((q) => srcs.some((s) => s[1] === q[0])).map((q) => ({ a: q[0], b: q[1], c: q[2] })) },
            ],
            acts: [],
          };
        }),
      },
    ];
  }

  if (tab === 'agents') {
    const rowsA = AGENT_ENTITY_CONTEXT[T].filter((a) => acc.canAgent('agent:read', a.id)).filter((a) => a.pe.mode !== 'Off' || a.de);
    sections = [
      { form: true, rows: [fr('Where to change this', 'Agents → Knowledge & Tools', "Entity context is part of each agent's versioned configuration. This page is read-only.")] },
      {
        title: 'Agents using Business Entities',
        empty: 'No agent uses Business Entities yet.',
        cols: ['Agent', 'Entity context', 'Entity types', 'Relationship depth', 'Version', 'Collections'],
        rows: rowsA.map(({ id, pub, draft, pe, de }) =>
          openRow(`ag:${id}`, [
            cell(id, { m: true }),
            cell('', { p: pe.mode === 'Off' ? ['draft', 'Off'] : ['approved', pe.mode] }),
            cell(pe.mode === 'Off' ? '—' : pe.types.join(', ')),
            cell(pe.mode === 'Entities and relationships' ? pe.hops : '—'),
            cell(pub ? `Published ${pub}` : 'Not published', { sub: de ? `Draft ${draft}: ${de.mode}${de.types.length ? ` · ${de.types.join(', ')}` : ''}` : '' }),
            cell((h.all.agColl[id] ?? []).join(', ') || 'None · not required'),
          ], () => ui.go(`agents/${enc(id)}`)),
        ).map((r) => ({ ...r, acts: [act('Open agent', r.onClick!)] })),
      },
      {
        title: 'Entity types in use',
        cols: ['Entity type', 'Agents', 'With relationships'],
        rows: tyN.map((n): Row => {
          const us = rowsA.filter((a) => a.pe.types.includes(n));
          return { key: `tu:${n}`, cells: [cell(n), cell(us.map((a) => a.id).join(', ') || 'Not used'), cell([...new Set(us.filter((a) => a.pe.mode === 'Entities and relationships').map((a) => a.pe.hops))].join(', ') || '—')] };
        }),
      },
    ];
  }
  return { head, sections };
}

/** The Ontology Map diagram (entity types as nodes, relationship types as edges). */
export function ontologyMap(h: Hub, sel0: string | null, setSel: (t: string | null) => void): DiagramSpec {
  const TY = h.D.onto.types, RL = h.D.onto.rels;
  const pos = ontologyLayout(TY, RL);
  const selT = sel0 && TY.some((t) => t.n === sel0) ? sel0 : null;
  const pairs: Record<string, number> = {};
  const edges: DiagramEdge[] = RL.map((r) => {
    const k = [r.src, r.tgt].sort().join('|');
    pairs[k] = (pairs[k] || 0) + 1;
    return { a: `ty:${r.src}`, b: `ty:${r.tgt}`, l: r.n, bend: (pairs[k] - 1) * 34 * (r.src < r.tgt ? 1 : -1), tone: selT && (r.src === selT || r.tgt === selT) ? 'brand' : undefined, noArrow: false, dash: r.dir === 'Bidirectional' ? '6 3' : undefined };
  });
  const t0 = TY.find((t) => t.n === selT);
  const relsOf = (n: string) => RL.filter((r) => r.src === n || r.tgt === n);
  const pipesOf = (n: string) => h.ing.pipelines.filter((p) => (p.entTypes ?? []).includes(n)).map((p) => p.id);
  return {
    nodes: TY.map((t, i) => ({ id: `ty:${t.n}`, x: Math.round(pos[i].x), y: Math.round(pos[i].y), w: 170, h: 52, l1: t.n, l2: `${t.attrs.length} attributes · ${fmt(t.cnt)} extracted`, tone: selT === t.n ? 'brand' : 'base', sel: selT === t.n, click: () => setSel(selT === t.n ? null : t.n) })),
    edges,
    legend: [['Entity type', 'base'], ['Selected', 'brand'], ...(RL.some((r) => r.dir === 'Bidirectional') ? ([['Dashed line: bidirectional relationship', 'ref']] as [string, 'ref'][]) : [])],
    inspect: t0
      ? [
          ['Description', t0.d],
          ['Identifier', t0.attrs.find((a) => a.id)?.n],
          ['Attributes', t0.attrs.map((a) => `${a.n} (${a.ty})`).join(', ')],
          ['Relationships', relsOf(t0.n).map((r) => `${r.src} ${r.n} ${r.tgt}`).join('; ') || 'None'],
          ['Extracted', `${fmt(t0.cnt)} entities`],
          ['Extracted by', pipesOf(t0.n).join(', ') || 'No pipeline'],
        ]
      : [],
    inspectT: t0 ? t0.n : '',
  };
}
