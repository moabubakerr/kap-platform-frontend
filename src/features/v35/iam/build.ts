/**
 * User & Permission Management (v35): users, groups, roles & access policies,
 * service accounts (tenant) and platform administrators, identity providers
 * (platform) as ScreenModels. Port of the prototype's `iamScreen`
 * (design-ref-v35/app.js 3922–4295).
 *
 * Builders are pure apart from the injected context: they read the IAM model
 * (`iamStore`) and the identity data (`identityStore`), and every action goes
 * through `c.ui` (dialogs) and `c.setIam` / `c.setIdn` (store updates), so a
 * change takes effect on every access check immediately.
 */
import { act, cell, fr, kv } from '@/engine/build';
import type { FormField, FormValues } from '@/engine/dialogs';
import type { Action, DsStatus, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import { BUILTIN_ROLES, evaluate, groupsOf, type Decision, type IamData, type IamGrant, type IamGroup, type IamPolicy, type IamUser, type PlatformAdmin, type TenantKey } from '@/v35/iam';
import { CRED_LIFE_MAX, IDP_SECRETS, RESOURCES, TENANT_AGENTS, TENANT_NAMES, type IamEvent, type IdentityData, type Idp, type SaCred, type SaGrant, type ServiceAccount } from '@/v35/data/identity';

// ------------------------------------------------------------------ context
export interface IamUi {
  form: (title: string, fields: FormField[], saveL: string, save: (v: FormValues) => string) => void;
  confirm: (title: string, body: string, items: { a: string; b?: string; c?: string }[], cta: string, fn: () => void) => void;
  secret: (title: string, tok: string, sub?: string) => void;
  toast: (msg: string) => void;
}

export interface IamCtx {
  T: TenantKey;
  /** username of the signed-in ("view as") account */
  actor: string;
  iam: IamData;
  idn: IdentityData;
  /** user:manage · grant:manage · tenant:configure in this tenant; platform:manage on the platform */
  canUser: boolean;
  canGrantM: boolean;
  canCfg: boolean;
  pEdit: boolean;
  ui: IamUi;
  /** navigate: tenant-relative ('users/x') or absolute ('/platform/…') */
  go: (path: string) => void;
  setIam: (fn: (d: IamData) => void) => void;
  setIdn: (fn: (d: IdentityData) => void) => void;
  /** random source for generated ids, passwords and keys (tests pass a fixed one) */
  rand?: () => number;
}

export const PERMS = ['agent:create', 'agent:read', 'agent:update', 'agent:execute', 'agent:oversee', 'agent:delete', 'tool:grant', 'collection:read', 'pipeline:execute', 'data:manage', 'tenant:configure', 'user:manage', 'grant:manage'];
const ADMIN_P = ['tenant:configure', 'user:manage', 'grant:manage'];
const PLAT_ROLES: PlatformAdmin['role'][] = ['Platform Administrator', 'Platform Viewer', 'Security Officer'];
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const TN = (t: string) => TENANT_NAMES[t] ?? t;
const resL = (k: string) => k.replace(':', ' · ');
const activeP = (off: boolean): [DsStatus, string] => (off ? ['draft', 'Disabled'] : ['approved', 'Active']);

type Item = { a: string; b?: string; c?: string };

/** Shared helpers of one screen evaluation (the prototype's iamScreen preamble). */
function env(c: IamCtx, lvl: 'tenant' | 'platform' = 'tenant') {
  const { T, iam, idn } = c;
  const rand = c.rand ?? Math.random;
  const tn = TN(T);
  const DH = RESOURCES[T] ?? { collections: [], datasets: [], documents: [] };
  const COLL = DH.collections.map((x) => x.id);
  const RESK = [...COLL.map((x) => `collection:${x}`), ...DH.datasets.map((x) => `dataset:${x}`), ...DH.documents.map((x) => `document:${x.id}`)];
  const AGENTS = TENANT_AGENTS[T] ?? [];
  const groupsT = iam.groups.filter((g) => g.t === T);
  const RP: Record<string, string[]> = { ...BUILTIN_ROLES, ...Object.fromEntries(iam.customRoles.filter((r) => r.t === T).map((r) => [r.n, r.perms])) };
  const scopeL = (s: string) => (s === 'tenant' ? `All ${tn} resources` : s === 'agents:*' ? 'Agent catalogue' : resL(s));
  const SCOPES = [`All ${tn} resources`, 'Agent catalogue', ...AGENTS.map((a) => `agent · ${a}`), ...COLL.map((x) => `collection · ${x}`)];
  const scopeK = (l: string) => (l.startsWith('All ') ? 'tenant' : l === 'Agent catalogue' ? 'agents:*' : l.replace(' · ', ':'));
  const pols = () => iam.policies.filter((p) => p.t === T);
  const clearedBy = (p: IamPolicy) => (p.cleared.includes('*') ? 'Everyone with access' : p.cleared.join(', '));
  const scopeRes = (s: string): string[] => {
    if (s === 'tenant') return RESK;
    if (!s.startsWith('collection:')) return [];
    const col = DH.collections.find((x) => `collection:${x.id}` === s);
    return [s, ...(col?.ds ?? []).map((x) => `dataset:${x}`), ...(col?.docs ?? []).map((x) => `document:${x}`)];
  };
  const restrOf = (scopes: string[]) => pols().filter((p) => p.res.some((r) => scopes.some((s) => scopeRes(s).includes(r))));
  // a document's classification is its own attribute; the classification policy of that name applies to it
  const polOf = (key: string) => {
    const cls = key.startsWith('document:') ? DH.documents.find((d) => d.id === key.slice(9))?.cls ?? '' : '';
    return pols().filter((p) => (cls && p.kind === 'Classification' ? p.n === cls : p.res.includes(key)));
  };
  const block = (key: string, gs: string[]) => polOf(key).filter((p) => !(p.cleared.includes('*') || p.cleared.some((x) => gs.includes(x))));
  const extra = (uid: string) => idn.users[uid] ?? {};
  const tenantUsers = () => iam.users.filter((u) => groupsT.some((g) => g.members.includes(u.id)) || (extra(u.id).mem ?? []).includes(T));
  const AUTHS = [...idn.idps.filter((p) => p.st === 'Active' && p.maps.some((m) => m[1] === T)).map((p) => p.n), 'Local account'];
  const pick = (s: string) => s[Math.floor(rand() * s.length)];
  const genPw = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 16; i++) s += pick(a);
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12)}`;
  };
  const genKey = () => {
    const a = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 20; i++) s += pick(a);
    return `kap_live_${s}`;
  };
  const pStat = (u: IamUser) => activeP(!!u.dis[T]);
  const permCount = (r: string) => `${(RP[r] ?? []).length} of ${PERMS.length}`;
  const gid = () => {
    const pre = T === 'sceai' ? 'G-' : T === 'econ' ? 'EA-' : 'SB-';
    let id = '';
    do id = pre + (200 + iam.grants.length + Math.floor(rand() * 90));
    while (iam.grants.some((g) => g.id === id));
    return id;
  };
  const saId = () => {
    let id = '';
    do id = `SA-${Math.floor(100 + rand() * 900)}`;
    while (idn.sas.some((a) => a.grants.some((g) => g.id === id)));
    return id;
  };
  const ev = (action: string, res: string, tenants: string[] = []): IamEvent => ({
    id: `${Date.now()}-${Math.floor(rand() * 1e9)}`,
    who: c.actor,
    action,
    res,
    tenants,
    lvl,
    area: 'User & Permission Management',
    at: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  });
  /** apply a change to the access model and/or identity data, record the audit events, show the toast */
  const setI = (m: { iam?: (d: IamData) => void; idn?: (d: IdentityData) => void }, toast?: string, evs: IamEvent | IamEvent[] = []) => {
    if (m.iam) c.setIam(m.iam);
    const list = ([] as IamEvent[]).concat(evs);
    if (m.idn || list.length)
      c.setIdn((d) => {
        m.idn?.(d);
        d.audit.unshift(...list);
      });
    if (toast) c.ui.toast(toast);
  };
  const form = (title: string, fields: FormField[], saveL: string, save: (v: FormValues) => string | void) => c.ui.form(title, fields, saveL, (v) => save(v) || '');
  /** a confirmation; when `blocked`, an information dialog without the action (the prototype's blocked confirm) */
  const confirm = (title: string, body: string, items: Item[], cta: string, fn: () => void, blocked = false) => {
    if (!blocked) return c.ui.confirm(title, body, items, cta, fn);
    const f: FormField[] = [{ type: 'note', text: body, tone: 'warn' }];
    if (items.length) f.push({ type: 'kv', rows: items.map((i) => [i.a, [i.b, i.c].filter(Boolean).join(' · ')] as [string, unknown]) });
    c.ui.form(title, f, 'Close', () => '');
  };
  const grantForm = (title: string, g0: { r: string; scope: string } | null, save: (r: string, scope: string) => string) =>
    form(
      title,
      [
        { k: 'r', label: 'Role', type: 'select', opts: Object.keys(RP), val: g0 ? g0.r : 'Analyst' },
        { k: 's', label: 'Resource scope', type: 'select', opts: SCOPES, val: g0 ? scopeL(g0.scope) : SCOPES[1] },
      ],
      g0 ? 'Save' : 'Assign',
      (v) => save(v.r, scopeK(v.s)),
    );
  return { T, tn, iam, idn, DH, COLL, RESK, AGENTS, groupsT, RP, scopeL, SCOPES, scopeK, pols, clearedBy, restrOf, polOf, block, extra, tenantUsers, AUTHS, genPw, genKey, pStat, permCount, gid, saId, ev, setI, form, confirm, grantForm };
}

const tabsOf = (t: [string, string][]) => t.map(([value, label]) => ({ value, label }));
const deniedModel = (title: string, what: string, tn: string): ScreenModel => ({ head: { title }, sections: [], denied: `This ${what} is not available. It does not exist in ${tn} or you don't have access.` });

// ================================================================ USERS
export function usersScreen(c: IamCtx): ScreenModel {
  const E = env(c);
  const { groupsT } = E;
  const us = E.tenantUsers();
  const add = () =>
    E.form(
      'Create user',
      [
        { k: 'id', label: 'Username', type: 'text', ph: 'e.g. f.alsada', hint: 'Sign-in name. Lower-case letters, digits, dots or underscores.' },
        { k: 'name', label: 'Display name', type: 'text' },
        { k: 'email', label: 'Email', type: 'text', hint: 'Required for directory accounts. Optional for local accounts.' },
        { k: 'auth', label: 'Authentication source', type: 'select', opts: E.AUTHS, val: E.AUTHS[0] },
        { k: 'st', label: 'Initial account status', type: 'select', opts: ['Active', 'Disabled'], val: 'Active' },
        { k: 'groups', label: 'Group membership', type: 'chips', opts: groupsT.filter((g) => g.st !== 'Disabled').map((g) => g.n), val: [] },
      ],
      'Create user',
      (v) => createUser(c, E, v),
    );
  return {
    head: { title: 'Users', add: c.canUser ? act('Create user', add, 'primary') : undefined },
    sections: [
      {
        cols: ['User', 'Email', 'Authentication', 'Groups', 'Status', 'Last sign-in'],
        mode: 'inline',
        rows: us.map((u): Row => {
          const gs = groupsT.filter((g) => g.members.includes(u.id)).map((g) => g.n);
          const open = () => c.go(`users/${encodeURIComponent(u.id)}`);
          return { key: `u:${u.id}`, cells: [cell(u.id, { m: true, sub: u.name }), cell(u.email || '—'), cell(u.idp), cell(gs.join(', ') || '—'), cell('', { p: E.pStat(u) }), cell(u.last)], acts: [act('Open', open)], onClick: open };
        }),
      },
    ],
  };
}

/** Create-user save. Returns an error message or ''. */
function createUser(c: IamCtx, E: ReturnType<typeof env>, v: FormValues): string {
  const { T } = E;
  const id = String(v.id ?? '').trim();
  const local = v.auth === 'Local account';
  const groups: string[] = v.groups ?? [];
  if (!/^[a-z][a-z0-9._]{2,}$/.test(id)) return 'Username: lower-case letters, digits, dots or underscores.';
  if (c.iam.users.some((u) => u.id === id) || c.iam.padmins.some((a) => a.id === id)) return 'This username is already in use.';
  if (!String(v.name ?? '').trim()) return 'Enter a display name.';
  if (v.email && !EMAIL.test(v.email)) return 'Enter a valid email address.';
  if (!local && !v.email) return `Enter the email address used in ${String(v.auth).split(' · ')[0]}.`;
  const pw = local ? E.genPw() : '';
  E.setI(
    {
      iam: (n) => {
        n.users.push({ id, name: String(v.name).trim(), email: v.email || '', idp: v.auth, last: 'Never', dis: v.st === 'Disabled' ? { [T]: true } : {} });
        n.groups.filter((g) => g.t === T && groups.includes(g.n)).forEach((g) => g.members.push(id));
      },
      idn: (n) => {
        n.users[id] = { mem: [T], created: `${c.actor} · just now`, mfa: local ? 'Required at first sign-in' : `Enforced by ${String(v.auth).split(' · ')[0]}`, pw: local ? { st: 'Temporary', at: 'just now' } : null, sess: 0 };
      },
    },
    `User ${id} created.`,
    [E.ev('Created user', `${id} · ${v.auth} · ${v.st}${groups.length ? ` · groups ${groups.join(', ')}` : ''}`, [T]), ...(local ? [E.ev('Issued temporary password', `${id} · value not recorded`, [T])] : [])],
  );
  if (local) c.ui.secret(`Temporary password for ${id}`, pw, 'The user must change it at first sign-in. It expires in 24 hours.');
  return '';
}

export const USER_TABS: [string, string][] = [['overview', 'Overview'], ['groups', 'Groups'], ['access', 'Effective Access'], ['security', 'Security']];

export function userScreen(c: IamCtx, uid: string, tab0?: string): ScreenModel {
  const E = env(c);
  const { T, tn, groupsT, scopeL } = E;
  const u = E.tenantUsers().find((x) => x.id === uid);
  if (!u) return deniedModel(uid, 'user', tn);
  const tab = USER_TABS.some((x) => x[0] === tab0) ? tab0! : 'overview';
  const path = (t: string) => `users/${encodeURIComponent(u.id)}${t === 'overview' ? '' : `/${t}`}`;
  const head: PageHead = { title: u.id, tabs: tabsOf(USER_TABS), tab, setTab: (v) => c.go(path(v)) };
  const gs = groupsT.filter((g) => g.members.includes(u.id));
  const dis = !!u.dis[T];
  const local = u.idp === 'Local account';
  const x = E.extra(u.id);
  const updU = (fn: (y: IamUser) => void, toast: string, e: IamEvent, idn?: (d: IdentityData) => void) => E.setI({ iam: (n) => fn(n.users.find((y) => y.id === u.id)!), idn }, toast, e);
  const sections: Section[] = [];

  if (tab === 'overview') {
    const edit = (lbl: string, key: 'name' | 'email', chk: (x: string) => string): Action[] =>
      c.canUser
        ? [
            act('Edit', () =>
              E.form(lbl, [{ k: 'v', label: lbl, type: 'text', val: u[key] }], 'Save', (v) => {
                const val = String(v.v ?? '').trim();
                const e = chk(val);
                if (e) return e;
                if (val === (u[key] || '')) return 'No change.';
                updU((y) => { y[key] = val; }, `${lbl} saved.`, E.ev('Changed user', `${u.id} · ${lbl.toLowerCase()}`));
                return '';
              }),
            ),
          ]
        : [];
    const remove = () =>
      E.confirm(
        `Remove ${u.id} from ${tn}?`,
        gs.length ? `They are removed from these groups and lose all access in ${tn}. Their account in other tenants is not affected.` : `They lose all access in ${tn}. Their account in other tenants is not affected.`,
        gs.map((g) => ({ a: g.n, b: 'Group', c: '' })),
        'Remove',
        () => {
          E.setI(
            {
              iam: (n) => n.groups.filter((g) => g.t === T).forEach((g) => { g.members = g.members.filter((m) => m !== u.id); }),
              idn: (n) => { const e = (n.users[u.id] ??= {}); e.mem = (e.mem ?? []).filter((t) => t !== T); },
            },
            `${u.id} removed from ${tn}.`,
            E.ev('Removed user from tenant', u.id + (gs.length ? ` · groups ${gs.map((g) => g.n).join(', ')}` : ''), [T]),
          );
          c.go('users');
        },
      );
    const toggle = dis
      ? () => updU((y) => { delete y.dis[T]; }, `${u.id} enabled.`, E.ev('Enabled user', u.id, [T]))
      : () =>
          E.confirm(`Disable ${u.id} in ${tn}?`, 'They lose all access in this tenant until enabled. Active sessions are ended.', [], 'Disable', () =>
            updU((y) => { y.dis[T] = true; }, `${u.id} disabled.`, E.ev('Disabled user', u.id, [T]), (n) => { (n.users[u.id] ??= {}).sess = 0; }),
          );
    sections.push({
      form: true,
      sacts: c.canUser ? [act(`Remove from ${tn}`, remove, 'ghost')] : [],
      rows: [
        fr('Username', u.id, 'Cannot be changed'),
        fr('Display name', u.name, '', edit('Display name', 'name', (v) => (v ? '' : 'Enter a display name.'))),
        fr('Email', u.email || '—', '', edit('Email', 'email', (v) => (!v && !local ? 'Directory accounts need an email address.' : v && !EMAIL.test(v) ? 'Enter a valid email address.' : ''))),
        fr('Authentication source', u.idp),
        fr(`Status in ${tn}`, dis ? 'Disabled' : 'Active', dis ? `Cannot sign in to ${tn}` : '', c.canUser ? [act(dis ? 'Enable' : 'Disable', toggle)] : []),
        fr('Created', x.created || 'Directory provisioning'),
        fr('Last sign-in', u.last),
      ],
    });
  }

  if (tab === 'groups') {
    const avail = groupsT.filter((g) => !g.members.includes(u.id) && g.st !== 'Disabled').map((g) => g.n);
    const addTo = () =>
      E.form(`Add ${u.id} to groups`, [{ k: 'g', label: 'Groups', type: 'chips', opts: avail, val: [] }], 'Add', (v) => {
        const sel: string[] = v.g ?? [];
        if (!sel.length) return 'Select at least one group.';
        E.setI({ iam: (n) => n.groups.filter((g) => g.t === T && sel.includes(g.n)).forEach((g) => g.members.push(u.id)) }, `${u.id} added to ${sel.join(', ')}.`, E.ev('Added user to groups', `${u.id} → ${sel.join(', ')}`, [T]));
        return '';
      });
    sections.push({
      sacts: c.canUser && avail.length ? [act('Add to groups', addTo)] : [],
      cols: ['Group', 'Description', 'Access assignments', 'Status'],
      mode: 'inline',
      empty: 'Not a member of any group.',
      rows: gs.map((g): Row => {
        const gr = c.iam.grants.filter((y) => y.t === T && y.g === g.n);
        const open = () => c.go(`groups/${encodeURIComponent(g.n)}`);
        return {
          key: `ug:${g.n}`,
          cells: [cell(g.n, { m: true }), cell(g.d || '—'), cell(gr.length ? gr.map((y) => `${y.r} · ${scopeL(y.scope)}`).join('; ') : 'None'), cell('', { p: activeP(g.st === 'Disabled') })],
          acts: [
            act('Open', open),
            ...(c.canUser
              ? [
                  act(
                    'Remove',
                    () =>
                      E.confirm(`Remove ${u.id} from ${g.n}?`, gr.length ? 'They lose the access this group grants:' : 'The group has no access assignments.', gr.map((y) => ({ a: y.r, b: scopeL(y.scope), c: '' })), 'Remove', () =>
                        E.setI({ iam: (n) => { const z = n.groups.find((y) => y.t === T && y.n === g.n)!; z.members = z.members.filter((m) => m !== u.id); } }, `${u.id} removed from ${g.n}.`, E.ev('Removed user from groups', `${u.id} ← ${g.n}`, [T])),
                      ),
                    'ghost',
                  ),
                ]
              : []),
          ],
        };
      }),
    });
  }

  if (tab === 'access') sections.push(...userAccess(c, E, u, gs, dis));

  if (tab === 'security') {
    const issue = () => {
      const pw = E.genPw();
      E.setI({ idn: (n) => { const e = (n.users[u.id] ??= {}); e.pw = { st: 'Temporary', at: 'just now' }; e.sess = 0; } }, `Temporary password issued for ${u.id}.`, E.ev('Reset user password', `${u.id} · value not recorded`, [T]));
      c.ui.secret(`Temporary password for ${u.id}`, pw, 'The user must change it at next sign-in. It expires in 24 hours.');
    };
    const sess = x.sess == null ? (u.last === 'Never' ? 0 : 1) : x.sess;
    const src = u.idp.split(' · ')[0];
    sections.push({
      form: true,
      rows: [
        fr('Authentication source', u.idp),
        fr('Password', local ? (x.pw?.st === 'Temporary' ? 'Temporary · must be changed at next sign-in' : 'Set by the user') : `Managed by ${src}`, local && x.pw ? `Issued ${x.pw.at}` : '', local && c.canUser ? [act('Reset password', () => E.confirm(`Reset the password of ${u.id}?`, 'A temporary password is generated and shown once. The current password stops working and active sessions are ended.', [], 'Reset password', issue))] : []),
        fr('Multi-factor authentication', x.mfa || `Enforced by ${src}`),
        fr('Active sessions', String(sess), '', c.canUser && sess > 0 ? [act('End sessions', () => E.confirm(`End all sessions of ${u.id}?`, 'They are signed out everywhere and must sign in again.', [], 'End sessions', () => E.setI({ idn: (n) => { (n.users[u.id] ??= {}).sess = 0; } }, `Sessions of ${u.id} ended.`, E.ev('Ended user sessions', u.id, [T]))))] : []),
        fr('Last sign-in', u.last),
      ],
    });
  }
  return { head, sections };
}

/** Effective access of a user: grants that apply, and each resource decision with its reason. */
function userAccess(c: IamCtx, E: ReturnType<typeof env>, u: IamUser, gs: IamGroup[], dis: boolean): Section[] {
  const { T, RP, scopeL } = E;
  const gr = c.iam.grants.filter((x) => x.t === T && gs.some((g) => g.n === x.g && g.st !== 'Disabled'));
  const res: [string, string, Decision][] = [
    ...E.COLL.map((x): [string, string, Decision] => [`collection · ${x}`, 'Read', evaluate(u.id, T, 'collection:read', 'collection', x)]),
    ...E.AGENTS.map((a): [string, string, Decision] => [`agent · ${a}`, 'Run', evaluate(u.id, T, 'agent:execute', 'agent', a)]),
  ];
  const ug = groupsOf(u.id, T);
  const assets = E.RESK.filter((k) => (k.startsWith('dataset:') ? E.polOf(k).length > 0 : k.startsWith('document:') ? E.polOf(k).some((p) => p.kind !== 'Classification') || E.block(k, ug).length > 0 : false))
    .slice(0, 15)
    .map((k): [string, string, Decision] => {
      const b = E.block(k, ug);
      return [resL(k), 'Clearance', dis ? { ok: false, why: 'Account disabled in this tenant' } : b.length ? { ok: false, why: `Restricted by ${b.map((p) => p.n).join(', ')}` } : { ok: true, why: `Cleared for ${E.polOf(k).map((p) => p.n).join(', ')}` }];
    });
  return [
    {
      title: 'Access grants',
      cols: ['Role', 'Resource scope', 'Permissions', 'Through group'],
      mode: 'inline',
      empty: dis ? 'Account disabled in this tenant.' : 'No access grant.',
      rows: dis ? [] : gr.map((g): Row => ({ key: `ea:${g.id}`, cells: [cell(g.r), cell(scopeL(g.scope)), cell((RP[g.r] ?? []).join(', ')), cell(g.g, { m: true })] })),
    },
    {
      title: 'Resource access',
      cols: ['Resource', 'Action', 'Result', 'Reason'],
      mode: 'inline',
      rows: [...res, ...assets].map(([r, a, x]): Row => ({ key: `rs:${r}${a}`, cells: [cell(r, { m: true }), cell(a), cell('', { p: x.ok ? ['approved', 'Allowed'] : ['rejected', 'Denied'] }), cell(x.why)] })),
    },
  ];
}

// ================================================================ GROUPS
export function groupsScreen(c: IamCtx): ScreenModel {
  const E = env(c);
  const { T, groupsT, scopeL } = E;
  const people = E.tenantUsers().map((u) => u.id);
  const add = () =>
    E.form(
      'Create group',
      [
        { k: 'n', label: 'Group name', type: 'text', ph: 'e.g. policy_analysts', hint: 'Lower-case letters, digits and underscores.' },
        { k: 'd', label: 'Description', type: 'text' },
        { k: 'members', label: 'Members', type: 'chips', opts: people, val: [] },
      ],
      'Create group',
      (v) => {
        const nm = String(v.n ?? '').trim();
        const members: string[] = v.members ?? [];
        if (!/^[a-z][a-z0-9_]{2,}$/.test(nm)) return 'Group name: lower-case letters, digits and underscores.';
        if (groupsT.some((g) => g.n === nm)) return 'A group with this name already exists.';
        E.setI({ iam: (n) => { n.groups.push({ t: T, n: nm, d: String(v.d ?? '').trim(), members }); } }, `Group ${nm} created.`, E.ev('Created group', nm + (members.length ? ` · members ${members.join(', ')}` : ''), [T]));
        return '';
      },
    );
  return {
    head: { title: 'Groups', add: c.canUser ? act('Create group', add, 'primary') : undefined },
    sections: [
      {
        cols: ['Group', 'Description', 'Members', 'Access assignments', 'Status'],
        mode: 'inline',
        rows: groupsT.map((g): Row => {
          const gr = c.iam.grants.filter((x) => x.t === T && x.g === g.n);
          const open = () => c.go(`groups/${encodeURIComponent(g.n)}`);
          return { key: `g:${g.n}`, cells: [cell(g.n, { m: true }), cell(g.d || '—'), cell(String(g.members.length)), cell(gr.length ? gr.map((x) => `${x.r} · ${scopeL(x.scope)}`).join('; ') : 'None'), cell('', { p: activeP(g.st === 'Disabled') })], acts: [act('Open', open)], onClick: open };
        }),
      },
    ],
  };
}

export const GROUP_TABS: [string, string][] = [['members', 'Members'], ['access', 'Access']];

export function groupScreen(c: IamCtx, gn: string, tab0?: string): ScreenModel {
  const E = env(c);
  const { T, tn, groupsT, RP, scopeL } = E;
  const g = groupsT.find((x) => x.n === gn);
  if (!g) return deniedModel(gn, 'group', tn);
  const tab = GROUP_TABS.some((x) => x[0] === tab0) ? tab0! : 'members';
  const path = (t: string) => `groups/${encodeURIComponent(g.n)}${t === 'members' ? '' : `/${t}`}`;
  const head: PageHead = { title: g.n, tabs: tabsOf(GROUP_TABS), tab, setTab: (v) => c.go(path(v)) };
  const gr = c.iam.grants.filter((x) => x.t === T && x.g === g.n);
  const off = g.st === 'Disabled';
  const updG = (fn: (x: IamGroup, n: IamData) => void, toast: string, e: IamEvent) => E.setI({ iam: (n) => fn(n.groups.find((x) => x.t === T && x.n === g.n)!, n) }, toast, e);
  const srcOf = c.idn.idps.flatMap((p) => p.maps.filter((m) => m[1] === T && m[2] === g.n).map((m) => `${p.n.split(' · ')[0]} · ${m[0]}`)).join(', ');
  const grItems = gr.map((x) => ({ a: x.r, b: scopeL(x.scope), c: '' }));
  const sections: Section[] = [];

  if (tab === 'members') {
    const cand = E.tenantUsers().map((u) => u.id).filter((x) => !g.members.includes(x));
    const toggle = off
      ? () => updG((x) => { delete x.st; }, `${g.n} enabled.`, E.ev('Enabled group', g.n, [T]))
      : () => E.confirm(`Disable ${g.n}?`, 'Members lose the access this group grants until it is enabled.', grItems, 'Disable', () => updG((x) => { x.st = 'Disabled'; }, `${g.n} disabled.`, E.ev('Disabled group', g.n, [T])));
    const addMembers = () =>
      E.form(`Add members to ${g.n}`, [{ k: 'm', label: 'Users', type: 'chips', opts: cand, val: [] }], 'Add', (v) => {
        const sel: string[] = v.m ?? [];
        if (!sel.length) return 'Select at least one user.';
        updG((x) => { x.members = x.members.concat(sel); }, sel.length + (sel.length === 1 ? ' member added.' : ' members added.'), E.ev('Added members to group', `${g.n} · ${sel.join(', ')}`, [T]));
        return '';
      });
    const del = () =>
      E.confirm(`Delete group ${g.n}?`, gr.length ? 'Its access assignments are revoked and members lose this access:' : 'Members are not deleted.', grItems, 'Delete', () => {
        E.setI(
          { iam: (n) => { n.groups = n.groups.filter((y) => !(y.t === T && y.n === g.n)); n.grants = n.grants.filter((y) => !(y.t === T && y.g === g.n)); } },
          `Group ${g.n} deleted.`,
          E.ev('Deleted group', g.n + (gr.length ? ` · revoked ${gr.map((x) => x.id).join(', ')}` : ''), [T]),
        );
        c.go('groups');
      });
    sections.push(
      {
        form: true,
        rows: [
          fr('Description', g.d || '—', '', c.canUser ? [act('Edit', () => E.form('Description', [{ k: 'v', label: 'Description', type: 'text', val: g.d }], 'Save', (v) => { updG((x) => { x.d = String(v.v ?? '').trim(); }, 'Description saved.', E.ev('Changed group', `${g.n} · description`, [T])); return ''; }))] : []),
          fr('Status', off ? 'Disabled' : 'Active', off ? 'Its access assignments do not apply' : '', c.canUser ? [act(off ? 'Enable' : 'Disable', toggle)] : []),
          fr('Membership source', srcOf ? 'Directory mapping' : 'Managed in KAP', srcOf ? `${srcOf} · directory synchronisation can change members` : ''),
        ],
      },
      {
        title: 'Members',
        sacts: [...(c.canUser && cand.length ? [act('Add members', addMembers)] : []), ...(c.canUser ? [act('Delete group', del, 'ghost')] : [])],
        cols: ['User', 'Email', 'Status', 'Last sign-in'],
        mode: 'inline',
        empty: 'No members.',
        rows: g.members
          .map((m) => c.iam.users.find((u) => u.id === m) ?? ({ id: m, name: '', email: '', idp: '', dis: {}, last: '—' } as IamUser))
          .map((u): Row => ({
            key: `gm:${u.id}`,
            cells: [cell(u.id, { m: true, sub: u.name }), cell(u.email || '—'), cell('', { p: E.pStat(u) }), cell(u.last)],
            acts: [
              act('Open', () => c.go(`users/${encodeURIComponent(u.id)}`)),
              ...(c.canUser
                ? [act('Remove', () => E.confirm(`Remove ${u.id} from ${g.n}?`, gr.length ? 'They lose the access this group grants:' : 'The group has no access assignments.', grItems, 'Remove', () => updG((x) => { x.members = x.members.filter((y) => y !== u.id); }, `${u.id} removed from ${g.n}.`, E.ev('Removed members from group', `${g.n} · ${u.id}`, [T]))), 'ghost')]
                : []),
            ],
          })),
      },
    );
  }

  if (tab === 'access') {
    const save0 = (g0: IamGrant | null) => (r: string, scope: string) => {
      if (c.iam.grants.some((x) => x.t === T && x.g === g.n && x.r === r && x.scope === scope && (!g0 || x.id !== g0.id))) return 'This group already has this role on this scope.';
      if (g0 && g0.r === r && g0.scope === scope) return 'No change.';
      if (g0) E.setI({ iam: (n) => { Object.assign(n.grants.find((x) => x.id === g0.id)!, { r, scope }); } }, 'Access assignment updated.', E.ev('Changed access grant', `${g0.id} · ${g.n} · ${g0.r} on ${scopeL(g0.scope)} → ${r} on ${scopeL(scope)}`, [T]));
      else {
        const id = E.gid();
        E.setI({ iam: (n) => { n.grants.push({ id, t: T, g: g.n, r, scope }); } }, `${r} assigned to ${g.n}.`, E.ev('Created access grant', `${id} · ${g.n} → ${r} on ${scopeL(scope)}`, [T]));
      }
      return '';
    };
    const rs = E.restrOf(gr.map((x) => x.scope));
    sections.push(
      {
        title: 'Access assignments',
        sacts: c.canGrantM ? [act('Assign access', () => E.grantForm(`Assign access to ${g.n}`, null, save0(null)))] : [],
        cols: ['Role', 'Resource scope', 'Permissions', 'Grant'],
        mode: 'inline',
        empty: 'No access assignments.',
        rows: gr.map((x): Row => ({
          key: `ga:${x.id}`,
          cells: [cell(x.r), cell(scopeL(x.scope)), cell(E.permCount(x.r), { tip: (RP[x.r] ?? []).join(', ') }), cell(x.id, { m: true })],
          acts: c.canGrantM
            ? [
                act('Modify', () => E.grantForm(`Modify ${x.id}`, x, save0(x))),
                act('Revoke', () => E.confirm(`Revoke ${x.r} on ${scopeL(x.scope)}?`, g.members.length ? 'These members lose this access:' : 'The group has no members.', g.members.map((m) => ({ a: m, b: g.n, c: '' })), 'Revoke', () => E.setI({ iam: (n) => { n.grants = n.grants.filter((y) => y.id !== x.id); } }, `${x.id} revoked.`, E.ev('Revoked access grant', `${x.id} · ${g.n} → ${x.r} on ${scopeL(x.scope)}`, [T]))), 'ghost'),
              ]
            : [],
        })),
      },
      {
        title: 'Applicable restrictions',
        sacts: c.canGrantM ? [act('Manage policies', () => c.go('roles?tab=policies'))] : [],
        cols: ['Policy', 'Kind', 'Applies to', 'This group'],
        mode: 'inline',
        empty: 'No access policy restricts these scopes.',
        rows: rs.map((p): Row => {
          const ok = p.cleared.includes('*') || p.cleared.includes(g.n);
          return { key: `gp:${p.n}`, cells: [cell(p.n), cell(p.kind), cell(p.res.map(resL).join(', ')), cell('', { p: ok ? ['approved', 'Cleared'] : ['rejected', 'Not cleared'] })] };
        }),
      },
    );
  }
  return { head, sections };
}

// ================================================================ ROLES & PERMISSIONS
export const ROLE_TABS: [string, string][] = [['roles', 'Roles'], ['policies', 'Access Policies']];

export function rolesScreen(c: IamCtx, tab0?: string): ScreenModel {
  const E = env(c);
  const { T, groupsT, scopeL } = E;
  const tab = ROLE_TABS.some((x) => x[0] === tab0) ? tab0! : 'roles';
  const head: PageHead = { title: 'Roles & Permissions', tabs: tabsOf(ROLE_TABS), tab, setTab: (v) => c.go(v === 'roles' ? 'roles' : `roles?tab=${v}`) };

  if (tab === 'roles') {
    const builtIn = Object.keys(BUILTIN_ROLES);
    const customs = c.iam.customRoles.filter((r) => r.t === T);
    const usedBy = (n: string): Item[] => [
      ...c.iam.grants.filter((g) => g.t === T && g.r === n).map((g) => ({ a: g.g, b: 'Group', c: scopeL(g.scope) })),
      ...c.idn.sas.filter((a) => a.t === T).flatMap((a) => a.grants.filter((x) => x.r === n).map((x) => ({ a: a.n, b: 'Service account', c: scopeL(x.scope) }))),
    ];
    const roleForm = (title: string, r: { n: string; perms: string[]; t?: TenantKey } | null) =>
      E.form(
        title,
        [
          { k: 'n', label: 'Role name', type: 'text', val: r ? r.n : '', ro: !!r?.t },
          { k: 'perms', label: 'Permissions', type: 'chips', opts: PERMS, val: r ? r.perms.slice() : [] },
        ],
        'Save',
        (v) => {
          const nm = String(v.n ?? '').trim();
          const perms: string[] = v.perms ?? [];
          if (!nm) return 'Enter a role name.';
          if (!r?.t && (builtIn.includes(nm) || customs.some((x) => x.n === nm))) return 'A role with this name already exists.';
          if (!perms.length) return 'Select at least one permission.';
          if (r?.t) E.setI({ iam: (n) => { n.customRoles.find((x) => x.t === T && x.n === r.n)!.perms = perms.slice(); } }, `Role ${r.n} updated.`, E.ev('Updated custom role', `${r.n} · ${perms.join(', ')}`, [T]));
          else E.setI({ iam: (n) => { n.customRoles.push({ t: T, n: nm, perms: perms.slice(), by: `${c.actor} · just now` }); } }, `Role ${nm} created.`, E.ev('Created custom role', `${nm} · ${perms.join(', ')}`, [T]));
          return '';
        },
      );
    const all = [...builtIn.map((n) => ({ n, perms: BUILTIN_ROLES[n], b: true, t: undefined as TenantKey | undefined })), ...customs.map((r) => ({ n: r.n, perms: r.perms, b: false, t: r.t }))];
    return {
      head: { ...head, add: c.canGrantM ? act('Create role', () => roleForm('Create role', null), 'primary') : undefined },
      sections: [
        {
          cols: ['Role', 'Type', 'Permissions', 'Used by'],
          mode: 'panel',
          rows: all.map((r): Row => {
            const used = usedBy(r.n);
            return {
              key: `r:${r.n}`,
              cells: [cell(r.n), cell('', { p: r.b ? ['draft', 'Built-in'] : ['submitted', 'Custom'] }), cell(`${r.perms.length} of ${PERMS.length}`), cell(used.length ? used.length + (used.length === 1 ? ' assignment' : ' assignments') : 'Not used')],
              perms: PERMS.map((p) => ({ p, on: r.perms.includes(p) })),
              lists: [{ title: 'Assigned to', items: used, empty: 'Not assigned' }],
              acts: !c.canGrantM
                ? []
                : r.b
                  ? [act('Duplicate as custom role', () => roleForm('Create role', { n: `${r.n} (custom)`, perms: r.perms }))]
                  : [
                      act('Edit', () => roleForm(`Edit role · ${r.n}`, r)),
                      act('Delete', () => E.confirm(`Delete role ${r.n}?`, used.length ? 'The role is in use. Remove these assignments first:' : 'This can’t be undone.', used, 'Delete', () => E.setI({ iam: (n) => { n.customRoles = n.customRoles.filter((x) => !(x.t === T && x.n === r.n)); } }, `Role ${r.n} deleted.`, E.ev('Deleted custom role', r.n, [T])), used.length > 0), 'ghost'),
                    ],
            };
          }),
        },
      ],
    };
  }

  // ---- access policies
  const gopts = ['Everyone with access', ...groupsT.map((g) => g.n)];
  const RO = E.RESK.filter((k) => !k.startsWith('document:')).map(resL);
  const polForm = (title: string, p: IamPolicy | null) =>
    E.form(
      title,
      [
        { k: 'n', label: 'Policy name', type: 'text', val: p ? p.n : '', ro: !!p, ph: 'e.g. L2 · Restricted' },
        { k: 'kind', label: 'Kind', type: 'select', opts: ['Classification', 'Need-to-know'], val: p ? p.kind : 'Need-to-know', hint: 'A resource has at most one classification and any number of need-to-know policies.' },
        { k: 'res', label: 'Applies to', type: 'chips', opts: RO, val: p ? p.res.filter((k) => !k.startsWith('document:')).map(resL) : [], hint: 'Document classification and document need-to-know are set on each document.' },
        { k: 'cleared', label: 'Cleared groups', type: 'chips', opts: gopts, val: p ? p.cleared.map((x) => (x === '*' ? 'Everyone with access' : x)) : [] },
      ],
      'Save',
      (v) => savePolicy(E, p, v),
    );
  const docCount = (p: IamPolicy) => (p.kind === 'Classification' ? E.DH.documents.filter((d) => d.cls === p.n).length : p.res.filter((k) => k.startsWith('document:')).length);
  const appliesTo = (p: IamPolicy) => {
    const n0 = docCount(p);
    return [...p.res.filter((k) => !k.startsWith('document:')).map(resL), ...(n0 ? [n0 + (n0 === 1 ? ' document' : ' documents')] : [])].join(', ') || 'Not applied';
  };
  return {
    head: { ...head, add: c.canGrantM ? act('Create policy', () => polForm('Create policy', null), 'primary') : undefined },
    sections: [
      {
        cols: ['Policy', 'Kind', 'Applies to', 'Cleared groups'],
        mode: 'panel',
        rows: E.pols().map((p): Row => {
          const without = groupsT
            .filter((g) => !(p.cleared.includes('*') || p.cleared.includes(g.n)))
            .flatMap((g) => g.members.filter((m) => !groupsT.some((h) => p.cleared.includes(h.n) && h.members.includes(m))).map((m) => ({ a: m, b: g.n, c: '' })))
            .filter((x, i, a) => a.findIndex((y) => y.a === x.a) === i);
          return {
            key: `l:${p.n}`,
            cells: [cell(p.n), cell(p.kind), cell(appliesTo(p)), cell(E.clearedBy(p))],
            lists: [{ title: 'Users without clearance', items: without, empty: 'None' }],
            acts: c.canGrantM
              ? [
                  act('Edit', () => polForm(`Edit policy · ${p.n}`, p)),
                  act('Delete', () => E.confirm(`Delete policy ${p.n}?`, p.res.length ? 'These resources are no longer restricted by it:' : 'Not applied to any resource.', p.res.map((k) => ({ a: resL(k), b: '', c: '' })), 'Delete', () => E.setI({ iam: (n) => { n.policies = n.policies.filter((x) => !(x.t === T && x.n === p.n)); } }, `Policy ${p.n} deleted.`, E.ev('Deleted access policy', p.n, [T]))), 'ghost'),
                ]
              : [],
          };
        }),
      },
    ],
  };
}

function savePolicy(E: ReturnType<typeof env>, p: IamPolicy | null, v: FormValues): string {
  const { T } = E;
  const nm = String(v.n ?? '').trim();
  const sel: string[] = v.res ?? [];
  const cleared: string[] = v.cleared ?? [];
  if (!nm) return 'Enter a policy name.';
  if (!p && E.pols().some((x) => x.n === nm)) return 'A policy with this name already exists.';
  if (!cleared.length) return 'Select at least one cleared group.';
  const res = [...sel.map((x) => x.replace(' · ', ':')), ...(p ? p.res.filter((k) => k.startsWith('document:')) : [])];
  if (v.kind === 'Classification') {
    const clash = res.filter((k) => E.pols().some((x) => x.n !== nm && x.kind === 'Classification' && x.res.includes(k)));
    if (clash.length) return clash.map(resL).join(', ') + (clash.length === 1 ? ' already has a classification.' : ' already have a classification.');
  }
  const cl = cleared.includes('Everyone with access') ? ['*'] : cleared;
  const kind = v.kind as IamPolicy['kind'];
  if (p) {
    const lost = p.res.filter((k) => !res.includes(k));
    const added = res.filter((k) => !p.res.includes(k));
    E.setI({ iam: (n) => { Object.assign(n.policies.find((x) => x.t === T && x.n === p.n)!, { kind, res, cleared: cl }); } }, `Policy ${p.n} updated.`, E.ev('Updated access policy', `${p.n} · ${kind}${added.length ? ` · applied to ${added.join(', ')}` : ''}${lost.length ? ` · removed from ${lost.join(', ')}` : ''} · cleared ${cleared.join(', ')}`, [T]));
  } else E.setI({ iam: (n) => { n.policies.push({ t: T, n: nm, kind, res, cleared: cl }); } }, `Policy ${nm} created.`, E.ev('Created access policy', `${nm} · ${kind}${res.length ? ` · applied to ${res.join(', ')}` : ''}`, [T]));
  return '';
}

// ================================================================ SERVICE ACCOUNTS
const credSt = (a: ServiceAccount): [DsStatus, string] =>
  a.st === 'Disabled' ? ['draft', 'Disabled'] : !a.creds.some((x) => x.st !== 'Revoked') ? ['rejected', 'No active credential'] : a.creds.some((x) => x.st === 'Expires soon') ? ['hold', 'Expires soon'] : ['approved', 'Valid'];
const lifeOpts = () => ['30 days', '60 days', '90 days', '180 days'].filter((x) => parseInt(x, 10) <= parseInt(CRED_LIFE_MAX, 10));

function saEnv(c: IamCtx) {
  const E = env(c);
  const SAS = c.idn.sas.filter((a) => a.t === E.T);
  const SA_ROLES = Object.keys(E.RP).filter((r) => !(E.RP[r] ?? []).some((p) => ADMIN_P.includes(p)));
  const newCred = (a: { creds: SaCred[] }, exp: string) => {
    const tok = E.genKey();
    const cr: SaCred = { id: `cred-${String(a.creds.length + 1).padStart(2, '0')}`, pre: tok.slice(0, 13), created: 'just now', by: c.actor, exp: `in ${exp}`, st: 'Active', last: 'Never' };
    return { tok, cr };
  };
  return { ...E, SAS, SA_ROLES, newCred };
}

export function serviceAccountsScreen(c: IamCtx): ScreenModel {
  const E = saEnv(c);
  const { T, SCOPES, SA_ROLES, scopeL } = E;
  const add = () =>
    E.form(
      'Create service account',
      [
        { k: 'n', label: 'Account name', type: 'text', ph: 'e.g. reporting-svc', hint: 'Lower-case letters, digits and hyphens.' },
        { k: 'd', label: 'Purpose', type: 'text' },
        { k: 'auth', label: 'Authentication method', type: 'select', opts: ['API key', 'OAuth 2.0 client credentials'], val: 'API key' },
        { k: 'r', label: 'Role', type: 'select', opts: SA_ROLES, val: SA_ROLES.includes('API Client') ? 'API Client' : SA_ROLES[0], hint: 'Roles with administration permissions cannot be assigned to service accounts.' },
        { k: 's', label: 'Resource scope', type: 'select', opts: SCOPES, val: SCOPES[1] },
        { k: 'exp', label: 'Credential expires after', type: 'select', opts: lifeOpts(), val: lifeOpts().slice(-1)[0] },
      ],
      'Create',
      (v) => {
        const nm = String(v.n ?? '').trim();
        if (!/^[a-z][a-z0-9-]{2,}$/.test(nm)) return 'Account name: lower-case letters, digits and hyphens.';
        if (E.SAS.some((x) => x.n === nm)) return 'A service account with this name already exists.';
        if (!String(v.d ?? '').trim()) return 'Describe the purpose.';
        const { tok, cr } = E.newCred({ creds: [] }, v.exp);
        const gId = E.saId();
        E.setI(
          { idn: (n) => { n.sas.push({ t: T, n: nm, d: String(v.d).trim(), st: 'Active', auth: v.auth, grants: [{ id: gId, r: v.r, scope: E.scopeK(v.s) }], creds: [cr], by: c.actor, created: 'just now', last: 'Never' }); } },
          `Service account ${nm} created.`,
          [E.ev('Created service account', `${nm} · ${v.auth} · ${v.r} on ${v.s}`, [T]), E.ev('Issued service account credential', `${nm} · ${cr.id} · ${cr.pre}…`, [T])],
        );
        c.ui.secret(`${v.auth === 'API key' ? 'API key' : 'Client secret'} for ${nm}`, tok, v.auth === 'API key' ? 'KAP keeps only a hash of this key.' : `Client ID: ${nm}@${T}. KAP keeps only a hash of this secret.`);
        return '';
      },
    );
  return {
    head: { title: 'Service Accounts', add: c.canCfg ? act('Create service account', add, 'primary') : undefined },
    sections: [
      {
        cols: ['Account', 'Purpose', 'Status', 'Authentication', 'Roles and scopes', 'Credential', 'Last used'],
        mode: 'inline',
        empty: 'No service accounts yet.',
        rows: E.SAS.map((a): Row => {
          const open = () => c.go(`service-accounts/${encodeURIComponent(a.n)}`);
          return { key: `k:${a.n}`, cells: [cell(a.n, { m: true }), cell(a.d), cell('', { p: a.st === 'Disabled' ? ['draft', 'Disabled'] : ['approved', 'Enabled'] }), cell(a.auth), cell(a.grants.map((x) => `${x.r} · ${scopeL(x.scope)}`).join('; ') || 'None'), cell('', { p: credSt(a) }), cell(a.last)], acts: [act('Open', open)], onClick: open };
        }),
      },
    ],
  };
}

export const SA_TABS: [string, string][] = [['overview', 'Overview'], ['access', 'Access'], ['creds', 'Credentials']];

export function serviceAccountScreen(c: IamCtx, name: string, tab0?: string): ScreenModel {
  const E = saEnv(c);
  const { T, tn, RP, SCOPES, SA_ROLES, scopeL } = E;
  const a = E.SAS.find((x) => x.n === name);
  if (!a) return deniedModel(name, 'service account', tn);
  const tab = SA_TABS.some((x) => x[0] === tab0) ? tab0! : 'overview';
  const path = (t: string) => `service-accounts/${encodeURIComponent(a.n)}${t === 'overview' ? '' : `/${t}`}`;
  const head: PageHead = { title: a.n, tabs: tabsOf(SA_TABS), tab, setTab: (v) => c.go(path(v)) };
  const updA = (fn: (y: ServiceAccount) => void, toast: string, e: IamEvent | IamEvent[]) => E.setI({ idn: (n) => fn(n.sas.find((x) => x.t === T && x.n === a.n)!) }, toast, e);
  const off = a.st === 'Disabled';
  const sections: Section[] = [];

  if (tab === 'overview') {
    const toggle = off
      ? () => updA((y) => { y.st = 'Active'; }, `${a.n} enabled.`, E.ev('Enabled service account', a.n, [T]))
      : () => E.confirm(`Disable ${a.n}?`, 'Calls with any of its credentials are rejected until it is enabled.', [], 'Disable', () => updA((y) => { y.st = 'Disabled'; }, `${a.n} disabled.`, E.ev('Disabled service account', a.n, [T])));
    sections.push({
      form: true,
      rows: [
        fr('Purpose', a.d, '', c.canCfg ? [act('Edit', () => E.form('Purpose', [{ k: 'v', label: 'Purpose', type: 'text', val: a.d }], 'Save', (v) => { const x = String(v.v ?? '').trim(); if (!x) return 'Describe the purpose.'; updA((y) => { y.d = x; }, 'Purpose saved.', E.ev('Changed service account', `${a.n} · purpose`, [T])); return ''; }))] : []),
        fr('Status', off ? 'Disabled' : 'Enabled', off ? 'All credentials are rejected' : '', c.canCfg ? [act(off ? 'Enable' : 'Disable', toggle)] : []),
        fr('Authentication method', a.auth, a.auth === 'OAuth 2.0 client credentials' ? `Client ID ${a.n}@${T}` : ''),
        fr('Created', `${a.by} · ${a.created}`),
        fr('Last used', a.last),
      ],
    });
  }

  if (tab === 'access') {
    const saveA = (g0: SaGrant | null) => (r: string, scope: string) => {
      if (!SA_ROLES.includes(r)) return 'Roles with administration permissions cannot be assigned to service accounts.';
      if (a.grants.some((x) => x.r === r && x.scope === scope && (!g0 || x.id !== g0.id))) return 'This assignment already exists.';
      if (g0 && g0.r === r && g0.scope === scope) return 'No change.';
      if (g0) updA((y) => { Object.assign(y.grants.find((x) => x.id === g0.id)!, { r, scope }); }, 'Access assignment updated.', E.ev('Changed service account access', `${a.n} · ${g0.r} on ${scopeL(g0.scope)} → ${r} on ${scopeL(scope)}`, [T]));
      else {
        const id = E.saId();
        updA((y) => { y.grants.push({ id, r, scope }); }, `${r} assigned to ${a.n}.`, E.ev('Assigned service account access', `${a.n} → ${r} on ${scopeL(scope)}`, [T]));
      }
      return '';
    };
    const saForm = (title: string, g0: SaGrant | null) =>
      E.form(
        title,
        [
          { k: 'r', label: 'Role', type: 'select', opts: SA_ROLES, val: g0 ? g0.r : SA_ROLES[0], hint: 'Roles with administration permissions are not available to service accounts.' },
          { k: 's', label: 'Resource scope', type: 'select', opts: SCOPES, val: g0 ? scopeL(g0.scope) : SCOPES[1] },
        ],
        g0 ? 'Save' : 'Assign',
        (v) => saveA(g0)(v.r, E.scopeK(v.s)),
      );
    const rs = E.restrOf(a.grants.map((x) => x.scope));
    sections.push(
      {
        title: 'Access assignments',
        sacts: c.canCfg ? [act('Assign access', () => saForm(`Assign access to ${a.n}`, null))] : [],
        cols: ['Role', 'Resource scope', 'Permissions'],
        mode: 'inline',
        empty: 'No access assignments. Calls are rejected.',
        rows: a.grants.map((x): Row => ({
          key: `sg:${x.id}`,
          cells: [cell(x.r), cell(scopeL(x.scope)), cell((RP[x.r] ?? []).join(', '))],
          acts: c.canCfg
            ? [
                act('Modify', () => saForm('Modify assignment', x)),
                act('Remove', () => E.confirm(`Remove ${x.r} on ${scopeL(x.scope)}?`, a.grants.length === 1 ? `${a.n} will have no access.` : 'Calls that need this access are rejected from now on.', [], 'Remove', () => updA((y) => { y.grants = y.grants.filter((z) => z.id !== x.id); }, 'Assignment removed.', E.ev('Removed service account access', `${a.n} · ${x.r} on ${scopeL(x.scope)}`, [T]))), 'ghost'),
              ]
            : [],
        })),
      },
      {
        title: 'Applicable restrictions',
        cols: ['Policy', 'Kind', 'Applies to'],
        mode: 'inline',
        empty: 'No access policy restricts these scopes.',
        rows: rs.map((p): Row => ({ key: `sp:${p.n}`, cells: [cell(p.n), cell(p.kind), cell(p.res.map(resL).join(', '))] })),
      },
    );
  }

  if (tab === 'creds') {
    const issue = (exp: string, prev?: string, keep?: boolean) => {
      const { tok, cr } = E.newCred(a, exp);
      updA(
        (y) => {
          y.creds.unshift(cr);
          if (prev) {
            const p = y.creds.find((z) => z.id === prev)!;
            if (keep) { p.st = 'Expires soon'; p.exp = 'in 24 h'; } else p.st = 'Revoked';
          }
        },
        prev ? 'Credential rotated.' : 'Credential created.',
        E.ev(prev ? 'Rotated service account credential' : 'Issued service account credential', `${a.n} · ${cr.id} · ${cr.pre}…${prev ? ` · ${prev}${keep ? ' expires in 24 h' : ' revoked'}` : ''}`, [T]),
      );
      c.ui.secret(`${a.auth === 'API key' ? 'API key' : 'Client secret'} for ${a.n}`, tok, 'KAP keeps only a hash of this value.');
    };
    sections.push({
      sacts: c.canCfg && !off ? [act('Create credential', () => E.form('Create credential', [{ k: 'exp', label: 'Expires after', type: 'select', opts: lifeOpts(), val: lifeOpts().slice(-1)[0], hint: `Platform maximum: ${CRED_LIFE_MAX}.` }], 'Create', (v) => { issue(v.exp); return ''; }))] : [],
      cols: ['Credential', 'Key', 'Created', 'Expires', 'Status', 'Last used'],
      mode: 'inline',
      empty: 'No credentials.',
      rows: a.creds.map((x): Row => ({
        key: `sc:${x.id}`,
        cells: [cell(x.id, { m: true }), cell(`${x.pre}••••••••`, { m: true }), cell(`${x.by || a.by} · ${x.created}`), cell(x.st === 'Revoked' ? '—' : x.exp), cell('', { p: x.st === 'Revoked' ? ['rejected', 'Revoked'] : x.st === 'Expires soon' ? ['hold', 'Expires soon'] : ['approved', 'Active'] }), cell(x.last)],
        acts:
          c.canCfg && x.st !== 'Revoked'
            ? [
                ...(off
                  ? []
                  : [
                      act('Rotate', () =>
                        E.form(
                          `Rotate ${x.id}`,
                          [
                            { k: 'exp', label: 'New credential expires after', type: 'select', opts: lifeOpts(), val: lifeOpts().slice(-1)[0] },
                            { k: 'keep', label: 'Current credential', type: 'select', opts: ['Revoke immediately', 'Keep valid for 24 hours'], val: 'Keep valid for 24 hours', hint: 'Keeping it valid gives callers time to switch to the new value.' },
                          ],
                          'Rotate',
                          (v) => { issue(v.exp, x.id, v.keep !== 'Revoke immediately'); return ''; },
                        ),
                      ),
                    ]),
                act('Revoke', () => E.confirm(`Revoke ${x.id}?`, 'Calls with this credential are rejected from now on.', [], 'Revoke', () => updA((y) => { y.creds.find((z) => z.id === x.id)!.st = 'Revoked'; }, `${x.id} revoked.`, E.ev('Revoked service account credential', `${a.n} · ${x.id}`, [T]))), 'ghost'),
              ]
            : [],
      })),
    });
  }
  return { head, sections };
}

// ================================================================ PLATFORM ADMINISTRATORS
export function platformAdminsScreen(c: IamCtx): ScreenModel {
  const E = env(c, 'platform');
  const { iam, idn } = c;
  const PAUTH = ['Keycloak · kap-admin realm', 'Local account'];
  const add = () =>
    E.form(
      'Create administrator',
      [
        { k: 'id', label: 'Username', type: 'text', ph: 'e.g. a.alhajri', hint: 'Lower-case letters, digits, dots or underscores.' },
        { k: 'name', label: 'Display name', type: 'text' },
        { k: 'email', label: 'Email', type: 'text', hint: 'Required for directory accounts. Optional for local accounts.' },
        { k: 'role', label: 'Platform role', type: 'select', opts: PLAT_ROLES, val: PLAT_ROLES[1] },
        { k: 'auth', label: 'Authentication source', type: 'select', opts: PAUTH, val: PAUTH[0] },
        { k: 'st', label: 'Initial status', type: 'select', opts: ['Active', 'Disabled'], val: 'Active' },
      ],
      'Create administrator',
      (v) => {
        const id = String(v.id ?? '').trim();
        const local = v.auth === 'Local account';
        if (!/^[a-z][a-z0-9._]{2,}$/.test(id)) return 'Username: lower-case letters, digits, dots or underscores.';
        if (iam.padmins.some((a) => a.id === id)) return 'Already a platform administrator.';
        if (!String(v.name ?? '').trim()) return 'Enter a display name.';
        if (v.email && !EMAIL.test(v.email)) return 'Enter a valid email address.';
        if (!local && !v.email) return 'Enter the email address used in the directory.';
        const pw = local ? E.genPw() : '';
        E.setI(
          {
            iam: (n) => { n.padmins.push({ id, name: String(v.name).trim(), email: v.email || '', role: v.role, st: v.st, last: 'Never', src: local ? '' : v.auth }); },
            idn: (n) => { n.padminAuth[id] = v.auth; },
          },
          `${id} created.`,
          [E.ev('Created platform administrator', `${id} · ${v.role} · ${v.auth} · ${v.st}`), ...(local ? [E.ev('Issued temporary password', `${id} · value not recorded`)] : [])],
        );
        if (local) c.ui.secret(`Temporary password for ${id}`, pw, 'Must be changed at first sign-in. It expires in 24 hours.');
        return '';
      },
    );
  const admins = iam.padmins.filter((x) => x.role === 'Platform Administrator' && x.st !== 'Disabled');
  return {
    head: { title: 'Platform Administrators', add: c.pEdit ? act('Create administrator', add, 'primary') : undefined },
    sections: [
      {
        cols: ['User', 'Platform role', 'Authentication', 'Status', 'Last sign-in'],
        mode: 'panel',
        rows: iam.padmins.map((a): Row => {
          const active = a.st !== 'Disabled';
          const last = a.role === 'Platform Administrator' && active && admins.length === 1;
          const auth = idn.padminAuth[a.id];
          const setA = (fn: (x: PlatformAdmin, n: IamData) => void, toast: string, e: IamEvent) => E.setI({ iam: (n) => fn(n.padmins.find((x) => x.id === a.id)!, n) }, toast, e);
          return {
            key: `pa:${a.id}`,
            cells: [cell(a.id, { m: true, sub: a.name }), cell(a.role), cell(auth || 'Keycloak · kap-admin realm'), cell('', { p: activeP(!active) }), cell(a.last)],
            kv: kv([['Email', a.email], ['Provisioned by', a.src && a.src !== auth ? `Directory sync · ${a.src}` : a.src ? 'Directory account' : 'Local account']]),
            acts: !c.pEdit
              ? []
              : [
                  act('Change role', () =>
                    E.form(`Platform role · ${a.id}`, [{ k: 'role', label: 'Platform role', type: 'select', opts: PLAT_ROLES, val: a.role }], 'Save', (v) => {
                      if (v.role === a.role) return 'No change.';
                      if (last && v.role !== 'Platform Administrator') return 'At least one active Platform Administrator is required.';
                      setA((x) => { x.role = v.role; }, `${a.id} is now ${v.role}.`, E.ev('Changed platform role', `${a.id} · ${a.role} → ${v.role}`));
                      return '';
                    }),
                  ),
                  act(
                    active ? 'Disable' : 'Enable',
                    active
                      ? () => E.confirm(`Disable ${a.id}?`, last ? 'At least one active Platform Administrator is required.' : 'They can’t sign in to platform administration until enabled.', [], 'Disable', () => setA((x) => { x.st = 'Disabled'; }, `${a.id} disabled.`, E.ev('Disabled platform administrator', a.id)), last)
                      : () => setA((x) => { x.st = 'Active'; }, `${a.id} enabled.`, E.ev('Enabled platform administrator', a.id)),
                  ),
                  act('Remove', () => E.confirm(`Remove ${a.id}?`, last ? 'At least one active Platform Administrator is required.' : 'Their platform role is removed. Tenant memberships are not affected.', [], 'Remove', () => E.setI({ iam: (n) => { n.padmins = n.padmins.filter((x) => x.id !== a.id); } }, `${a.id} removed.`, E.ev('Removed platform administrator', a.id)), last), 'ghost'),
                ],
          };
        }),
      },
    ],
  };
}

// ================================================================ IDENTITY PROVIDERS
type SyncChange = { a: string; b: string; c: string; id?: string; role?: string; op?: 'add' | 'role' | 'del' };

/** What "Sync now" would change: group memberships and platform roles that follow the directory. */
export function idpSyncPlan(iam: IamData, idn: IdentityData, p: Idp) {
  const DIR = idn.dir[p.n] ?? {};
  const known = iam.users.map((u) => u.id);
  const tg = [...new Set(p.maps.filter((m) => m[1] !== 'platform').map((m) => `${m[1]}|${m[2]}`))];
  const ch: SyncChange[] = [];
  const want: Record<string, string[]> = {};
  tg.forEach((k) => {
    const [t, g] = k.split('|');
    const grp = iam.groups.find((x) => x.t === t && x.n === g);
    if (!grp) return;
    const w = [...new Set(p.maps.filter((m) => m[1] === t && m[2] === g).flatMap((m) => DIR[m[0]] ?? []))].filter((x) => known.includes(x));
    want[k] = w;
    w.filter((x) => !grp.members.includes(x)).forEach((x) => ch.push({ a: `+ ${x}`, b: TN(t), c: g }));
    grp.members.filter((x) => !w.includes(x)).forEach((x) => ch.push({ a: `− ${x}`, b: TN(t), c: g }));
  });
  const knownP = new Set([...iam.users.map((u) => u.id), ...iam.padmins.map((x) => x.id)]);
  const pm = p.maps.filter((m) => m[1] === 'platform');
  const wantP: Record<string, string> = {};
  pm.forEach((m) => (DIR[m[0]] ?? []).filter((x) => knownP.has(x)).forEach((x) => { if (wantP[x] !== 'Platform Administrator') wantP[x] = m[2]; }));
  const pch: SyncChange[] = [];
  if (pm.length) {
    Object.entries(wantP).forEach(([id, role]) => {
      const rec = iam.padmins.find((x) => x.id === id);
      if (!rec) pch.push({ a: `+ ${id}`, b: 'KAP platform', c: role, id, role, op: 'add' });
      else if (rec.role !== role) pch.push({ a: `~ ${id}`, b: 'KAP platform', c: `${rec.role} → ${role}`, id, role, op: 'role' });
    });
    iam.padmins.filter((x) => x.src === p.n && !wantP[x.id]).forEach((x) => pch.push({ a: `− ${x.id}`, b: 'KAP platform', c: x.role, id: x.id, op: 'del' }));
  }
  const after = [
    ...iam.padmins.filter((x) => !pch.some((y) => y.op === 'del' && y.id === x.id)).map((x) => { const y = pch.find((z) => z.id === x.id && z.op === 'role'); return { role: y ? y.role! : x.role, st: x.st }; }),
    ...pch.filter((y) => y.op === 'add').map((y) => ({ role: y.role!, st: 'Active' })),
  ];
  const noAdmin = !after.some((x) => x.role === 'Platform Administrator' && x.st === 'Active');
  const all: Item[] = [...ch, ...pch].map((x) => ({ a: x.a, b: x.b, c: x.c }));
  return { want, ch, pch, noAdmin, all };
}

export function identityProvidersScreen(c: IamCtx): ScreenModel {
  const E = env(c, 'platform');
  const { iam, idn } = c;
  const tkOf = (label: string) => Object.keys(TENANT_NAMES).find((k) => TENANT_NAMES[k] === label) ?? label;
  const targets = [
    ...(['sceai', 'econ', 'sandbox'] as TenantKey[]).flatMap((t) => iam.groups.filter((g) => g.t === t).map((g) => `${TN(t)} · ${g.n}`)),
    ...PLAT_ROLES.map((r) => `${TN('platform')} · ${r}`),
  ];
  const pForm = (title: string, p: Idp | null) =>
    E.form(
      title,
      [
        { k: 'n', label: 'Name', type: 'text', val: p ? p.n : '', ro: !!p },
        { k: 'proto', label: 'Protocol', type: 'select', opts: ['OIDC', 'SAML 2.0'], val: p ? p.proto : 'OIDC' },
        { k: 'issuer', label: 'Issuer URL', type: 'text', val: p ? p.issuer : '', ph: 'https://' },
        { k: 'cred', label: 'Client credential', type: 'select', opts: ['Select credential', ...IDP_SECRETS.map((s) => s.split('/').pop()!)], val: p?.cred ? p.cred.split('/').pop() : 'Select credential' },
      ],
      'Save',
      (v) => {
        const nm = String(v.n ?? '').trim();
        if (!nm) return 'Enter a name.';
        if (!p && idn.idps.some((x) => x.n === nm)) return 'A provider with this name already exists.';
        if (!/^https:\/\//.test(v.issuer || '')) return 'Enter an HTTPS issuer URL.';
        if (v.cred === 'Select credential') return 'Select a client credential.';
        const cred = IDP_SECRETS.find((s) => s.endsWith(`/${v.cred}`)) ?? '';
        if (p) E.setI({ idn: (n) => { Object.assign(n.idps.find((x) => x.n === p.n)!, { proto: v.proto, issuer: v.issuer, cred, st: p.st === 'Draft' ? 'Active' : p.st }); } }, `${p.n} saved.`, E.ev('Updated identity provider', p.n));
        else E.setI({ idn: (n) => { n.idps.push({ n: nm, proto: v.proto, issuer: v.issuer, cred, st: 'Active', sync: '—', maps: [] }); } }, `${nm} added.`, E.ev('Added identity provider', nm));
        return '';
      },
    );
  const sync = (p: Idp) => {
    const { want, ch, pch, noAdmin, all } = idpSyncPlan(iam, idn, p);
    E.confirm(
      `Synchronize ${p.n}?`,
      noAdmin ? 'Not applied: the directory would leave no active Platform Administrator.' : all.length ? 'Mapped groups and platform roles follow the directory. Changes:' : 'Mapped groups and platform roles already match the directory.',
      all,
      'Synchronize',
      () =>
        E.setI(
          {
            iam: (n) => {
              Object.entries(want).forEach(([k, w]) => { const [t, g] = k.split('|'); n.groups.find((x) => x.t === t && x.n === g)!.members = w.slice(); });
              pch.forEach((y) => {
                if (y.op === 'add') { const u = n.users.find((x) => x.id === y.id); n.padmins.push({ id: y.id!, name: u?.name || y.id!, email: u?.email || '', role: y.role as PlatformAdmin['role'], st: 'Active', last: 'Never', src: p.n }); }
                else if (y.op === 'role') n.padmins.find((x) => x.id === y.id)!.role = y.role as PlatformAdmin['role'];
                else n.padmins = n.padmins.filter((x) => x.id !== y.id);
              });
            },
            idn: (n) => { n.idps.find((x) => x.n === p.n)!.sync = 'just now'; },
          },
          `${p.n} synchronized · ${all.length}${all.length === 1 ? ' change' : ' changes'}.`,
          all.length ? [...ch.map((y) => E.ev('Synchronized group membership', `${p.n} · ${y.a} ${y.c}`, [tkOf(y.b)])), ...pch.map((y) => E.ev('Synchronized platform role', `${p.n} · ${y.a} ${y.c}`))] : [E.ev('Synchronized identity provider', `${p.n} · no changes`)],
        ),
      !all.length || noAdmin,
    );
  };
  const addMapping = (p: Idp) =>
    E.form(
      `Add group mapping · ${p.n}`,
      [
        { k: 'ext', label: 'External group', type: 'text', ph: `Group name in ${p.n.split(' · ')[0]}` },
        { k: 'tgt', label: 'KAP group', type: 'select', opts: targets, val: targets[0] },
      ],
      'Add',
      (v) => {
        const ext = String(v.ext ?? '').trim();
        if (!ext) return 'Enter the external group.';
        const [tl, g] = String(v.tgt).split(' · ');
        const t = tkOf(tl);
        if (p.maps.some((m) => m[0] === ext && m[1] === t && m[2] === g)) return 'This mapping already exists.';
        E.setI({ idn: (n) => { n.idps.find((x) => x.n === p.n)!.maps.push([ext, t, g]); } }, 'Mapping added.', E.ev('Added group mapping', `${p.n} · ${ext} → ${v.tgt}`, t === 'platform' ? [] : [t]));
        return '';
      },
    );
  return {
    head: { title: 'Identity Provider Configuration', add: c.pEdit ? act('Add provider', () => pForm('Add provider', null), 'primary') : undefined },
    sections: [
      {
        cols: ['Provider', 'Protocol', 'Used by', 'Group mappings', 'Status'],
        mode: 'panel',
        rows: idn.idps.map((p): Row => {
          const used = [...new Set(p.maps.map((m) => TN(m[1])))];
          return {
            key: `idp:${p.n}`,
            cells: [cell(p.n), cell(p.proto), cell(used.join(', ') || 'Not used'), cell(String(p.maps.length)), cell('', { p: p.st === 'Draft' ? ['draft', 'Draft'] : ['approved', 'Active'] })],
            kv: kv([['Issuer', p.issuer, true], ['Client credential', p.cred ? p.cred.split('/').pop() : '', true], ['Last sync', p.sync]]),
            lists: [
              {
                title: 'Group mappings',
                empty: 'No mappings',
                items: p.maps.map((m, i) => ({
                  a: m[0],
                  b: `→ ${TN(m[1])} · ${m[2]}`,
                  c: `Directory: ${(idn.dir[p.n]?.[m[0]] ?? []).join(', ') || 'no members'}`,
                  ...(c.pEdit
                    ? {
                        x: () => E.confirm('Remove mapping?', `${m[0]} → ${TN(m[1])} · ${m[2]}`, [], 'Remove', () => E.setI({ idn: (n) => { n.idps.find((x) => x.n === p.n)!.maps.splice(i, 1); } }, 'Mapping removed.', E.ev('Removed group mapping', `${p.n} · ${m[0]} → ${TN(m[1])} · ${m[2]}`, m[1] === 'platform' ? [] : [m[1]]))),
                        xl: 'Remove',
                      }
                    : {}),
                })),
              },
            ],
            acts: !c.pEdit ? [] : [act('Sync now', () => sync(p)), act('Edit', () => pForm(`Edit provider · ${p.n}`, p)), act('Add mapping', () => addMapping(p))],
          };
        }),
      },
    ],
  };
}
