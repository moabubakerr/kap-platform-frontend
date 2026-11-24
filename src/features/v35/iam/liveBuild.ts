/**
 * User & Permission Management for a live tenant (sandbox): the same screens
 * as `build.ts`, built from KAP records (`liveIamStore`) and writing to KAP.
 *
 * KAP's model differs from the design's in places, and the screens say so:
 * - users have a username and description, no e-mail, display name or
 *   sign-in times; deactivation is KAP's (soft, reversible);
 * - groups cannot be deleted (disable them); a group's grants cannot be listed,
 *   so only grants made from this console in this session are shown;
 * - roles come from KAP and are read-only here; custom roles and access
 *   policies stay session-only (they drive the console's access simulation);
 * - service account credentials are KAP OAuth clients, when KAP and the
 *   platform expose them.
 *
 * Every builder is pure apart from the injected context (`LiveCtx`).
 */
import { act, cell, fr, kv } from '@/engine/build';
import type { FormField, FormValues, SaveResult } from '@/engine/dialogs';
import type { Action, PageHead, Row, ScreenModel, Section } from '@/engine/types';
import { BUILTIN_ROLES, type TenantKey } from '@/v35/iam';
import { TENANT_NAMES } from '@/v35/data/identity';
import { rolesScreen, type IamCtx } from './build';
import { groupName, inDays, parseScope, roleName, scopeLabel, scopeOptions, toKapGrant, toKapGroupCreate, toKapGroupPatch, toKapMember, toKapOauthClient, toKapUserCreate, toKapUserPatch, toGrant, type KapGrant, type KapOauthClient, type KapUserDetails, type LiveGroup, type LiveIam, type LiveUser } from './fromKap';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Item = { a: string; b?: string; c?: string };

export interface LiveUi {
  form: (title: string, fields: FormField[], saveL: string, save: (v: FormValues) => SaveResult) => void;
  confirm: (title: string, body: string, items: Item[], cta: string, fn: () => void | Promise<void | string>) => void;
  secret: (title: string, tok: string, sub?: string) => void;
  toast: (msg: string) => void;
}

export interface LiveCtx {
  T: TenantKey;
  actor: string;
  L: LiveIam;
  /** first load still running */
  loading: boolean;
  canUser: boolean;
  canGrantM: boolean;
  canCfg: boolean;
  ui: LiveUi;
  go: (path: string) => void;
  /** one KAP call (through the platform) */
  call: <R = unknown>(method: Method, path: string, body?: unknown) => Promise<R>;
  /** run KAP writes for a dialog, then reload: '' or KAP's message */
  write: (w: () => Promise<unknown>) => Promise<string>;
  /** record a shared audit event */
  audit: (action: string, res: string) => void;
  /** change the live store directly (grants KAP cannot list) */
  remember: (fn: (L: LiveIam) => void) => void;
  /** the session context, for the parts KAP has no equivalent of */
  session: IamCtx;
  rand?: () => number;
}

const TN = (t: string) => TENANT_NAMES[t] ?? t;
const tabsOf = (t: [string, string][]) => t.map(([value, label]) => ({ value, label }));
const activeP = (on: boolean): [import('@/engine/types').DsStatus, string] => (on ? ['approved', 'Active'] : ['draft', 'Deactivated']);
const enc = encodeURIComponent;
const denied = (title: string, what: string, tn: string): ScreenModel => ({ head: { title }, sections: [], denied: `This ${what} is not available. It does not exist in ${tn} or you don't have access.` });
const loadingModel = (title: string): ScreenModel => ({ head: { title }, sections: [{ cols: [], rows: [], empty: 'Loading from KAP…' }] });

/** Shared helpers of one live screen. */
function env(c: LiveCtx) {
  const { L } = c;
  const tn = TN(c.T);
  const rand = c.rand ?? Math.random;
  /** a KAP write for a dialog: audit and toast on success, KAP's message otherwise */
  const save = async (w: () => Promise<unknown>, action: string, res: string, toast: string): Promise<string> => {
    const e = await c.write(w);
    if (!e) {
      c.audit(action, res);
      c.ui.toast(toast);
    }
    return e;
  };
  const genPw = () => {
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    let s = '';
    for (let i = 0; i < 16; i++) s += a[Math.floor(rand() * a.length)];
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}-${s.slice(12)}!7`;
  };
  const groupsOfU = (u: LiveUser) => L.groups.filter((g) => u.groups.includes(g.id));
  const grantsOfG = (g: LiveGroup) => L.grants.filter((x) => x.gid === g.id);
  const grantL = (x: LiveIam['grants'][number]) => `${roleName(L, x.roleId)} · ${scopeLabel(L, x)}`;
  const rolesOf = (codes: string[]) => codes.map((code) => L.roles.find((r) => r.code === code) ?? { id: code, code, n: code, d: '', sys: false, perms: [] });
  const userL = (id: string) => L.users.find((u) => u.id === id)?.n ?? id;
  const credsOf = (u: LiveUser) => (L.creds ?? []).filter((x) => x.uid === u.id);
  return { L, tn, save, genPw, groupsOfU, grantsOfG, grantL, rolesOf, userL, credsOf };
}
type Env = ReturnType<typeof env>;

/** Add `u` to groups, one call per group. */
const addToGroups = (c: LiveCtx, userId: string, groupIds: string[]) => async () => {
  for (const gid of groupIds) await c.call('POST', `groups/${gid}/users`, toKapMember(userId));
};

// ================================================================ USERS
export function liveUsersScreen(c: LiveCtx): ScreenModel {
  const E = env(c);
  const { L } = E;
  const us = L.users.filter((u) => u.type === 'user');
  const gOpts = L.groups.filter((g) => g.active).map((g) => g.n);
  const add = () =>
    c.ui.form(
      'Create user',
      [
        { k: 'id', label: 'Username', type: 'text', ph: 'e.g. f.alsada', hint: 'Sign-in name in KAP. It cannot be changed later.' },
        { k: 'd', label: 'Description', type: 'text', hint: 'KAP keeps a description instead of a display name and e-mail.' },
        { k: 'pw', label: 'Password', type: 'select', opts: ['Generate a password', 'No password (single sign-on)'], val: 'Generate a password', hint: 'A generated password is shown once.' },
        { k: 'groups', label: 'Group membership', type: 'chips', opts: gOpts, val: [] },
      ],
      'Create user',
      async (v) => {
        const id = String(v.id ?? '').trim();
        if (!/^[A-Za-z0-9._@+-]{3,150}$/.test(id)) return 'Username: at least 3 letters, digits or . _ @ + -';
        if (L.users.some((u) => u.n === id)) return 'This username is already in use.';
        const sel: string[] = v.groups ?? [];
        const pw = v.pw === 'Generate a password' ? E.genPw() : '';
        const groupIds = L.groups.filter((g) => sel.includes(g.n)).map((g) => g.id);
        const e = await E.save(() => c.call('POST', 'users', toKapUserCreate({ username: id, type: 'user', description: v.d, password: pw || undefined, groupIds })), 'Created user', `${id}${sel.length ? ` · groups ${sel.join(', ')}` : ''}`, `User ${id} created.`);
        if (!e && pw) c.ui.secret(`Password for ${id}`, pw, 'Shown once. KAP keeps only a hash of it; pass it to the user securely.');
        return e;
      },
    );
  return {
    head: { title: 'Users', add: c.canUser ? act('Create user', add, 'primary') : undefined },
    sections: [
      {
        cols: ['User', 'Description', 'Account', 'Groups', 'Status', 'Created'],
        mode: 'inline',
        empty: c.loading ? 'Loading from KAP…' : 'No users in KAP for this tenant.',
        rows: us.map((u): Row => {
          const open = () => c.go(`users/${enc(u.n)}`);
          const gs = E.groupsOfU(u).map((g) => g.n);
          return {
            key: `u:${u.id}`,
            cells: [cell(u.n, { m: true }), cell(u.d || '—'), cell(u.superuser ? 'Superuser' : u.staff ? 'Staff' : 'User'), cell(u.detailed ? gs.join(', ') || '—' : 'Not read'), cell('', { p: activeP(u.active) }), cell(u.created)],
            acts: [act('Open', open)],
            onClick: open,
          };
        }),
      },
    ],
  };
}

export const LIVE_USER_TABS: [string, string][] = [['overview', 'Overview'], ['groups', 'Groups'], ['access', 'Effective Access']];

/** Overview rows shared by users and service accounts: description, status, account facts. */
function accountOverview(c: LiveCtx, E: Env, u: LiveUser, can: boolean, back: string): Section {
  const sa = u.type === 'service_account';
  const what = sa ? 'Purpose' : 'Description';
  const edit: Action[] = can
    ? [
        act('Edit', () =>
          c.ui.form(what, [{ k: 'v', label: what, type: 'text', val: u.d }], 'Save', (v) => {
            const body = toKapUserPatch(u, { description: String(v.v ?? '') });
            if (!Object.keys(body).length) return 'No change.';
            if (sa && !String(v.v ?? '').trim()) return 'Describe the purpose.';
            return E.save(() => c.call('PATCH', `users/${u.id}`, body), sa ? 'Changed service account' : 'Changed user', `${u.n} · ${what.toLowerCase()}`, `${what} saved.`);
          }),
        ),
      ]
    : [];
  const self = !!E.L.me && u.id === E.L.me;
  const toggle = u.active
    ? self
      ? () => c.ui.form(`Deactivate ${u.n}?`, [{ type: 'note', text: 'This is the account the platform uses to call KAP. Deactivating it would cut the console off from KAP.', tone: 'warn' }], 'Close', () => '')
      : () =>
        c.ui.confirm(
          `Deactivate ${u.n}?`,
          sa ? 'KAP revokes all its OAuth clients and issued tokens. The account is kept and can be reactivated.' : 'KAP revokes their active tokens. The account is kept and can be reactivated.',
          [],
          'Deactivate',
          () => E.save(() => c.call('POST', `users/${u.id}/deactivate`), sa ? 'Disabled service account' : 'Disabled user', u.n, `${u.n} deactivated.`).then((e) => e || undefined),
        )
    : () =>
        c.ui.confirm(`Reactivate ${u.n}?`, sa ? 'It can obtain tokens again with new OAuth clients.' : 'They can sign in again.', [], 'Reactivate', () =>
          E.save(() => c.call('PATCH', `users/${u.id}`, toKapUserPatch(u, { active: true })), sa ? 'Enabled service account' : 'Enabled user', u.n, `${u.n} reactivated.`).then((e) => e || undefined),
        );
  return {
    form: true,
    note: back,
    rows: [
      fr(sa ? 'Account name' : 'Username', u.n, 'Cannot be changed'),
      fr(what, u.d || '—', '', edit),
      fr('Account type', sa ? 'Service account' : u.superuser ? 'User · installation superuser' : u.staff ? 'User · staff' : 'User'),
      ...(sa ? [fr('Authentication method', 'OAuth 2.0 client credentials', 'Tokens from KAP OAuth clients')] : []),
      fr(`Status in ${E.tn}`, u.active ? 'Active' : 'Deactivated', u.active ? '' : u.deactivated !== '—' ? `Since ${u.deactivated}` : '', can ? [act(u.active ? 'Deactivate' : 'Reactivate', toggle)] : []),
      fr('Created', u.created),
      fr('Last changed', u.updated),
      fr('KAP id', u.id),
    ],
  };
}

/** Group memberships of an account (users and service accounts). */
function accountGroups(c: LiveCtx, E: Env, u: LiveUser, can: boolean): Section {
  const gs = E.groupsOfU(u);
  const avail = E.L.groups.filter((g) => g.active && !u.groups.includes(g.id));
  const addTo = () =>
    c.ui.form(`Add ${u.n} to groups`, [{ k: 'g', label: 'Groups', type: 'chips', opts: avail.map((g) => g.n), val: [] }], 'Add', (v) => {
      const sel: string[] = v.g ?? [];
      if (!sel.length) return 'Select at least one group.';
      return E.save(addToGroups(c, u.id, avail.filter((g) => sel.includes(g.n)).map((g) => g.id)), 'Added user to groups', `${u.n} → ${sel.join(', ')}`, `${u.n} added to ${sel.join(', ')}.`);
    });
  return {
    sacts: can && u.detailed && avail.length ? [act('Add to groups', addTo)] : [],
    cols: ['Group', 'Description', 'Access assignments', 'Status'],
    mode: 'inline',
    empty: u.detailed ? 'Not a member of any group.' : 'Group memberships could not be read from KAP.',
    rows: gs.map((g): Row => {
      const gr = E.grantsOfG(g);
      const open = () => c.go(`groups/${enc(g.n)}`);
      return {
        key: `ug:${g.id}`,
        cells: [cell(g.n, { m: true }), cell(g.d || '—'), cell(gr.length ? gr.map(E.grantL).join('; ') : 'Not listed by KAP'), cell('', { p: g.active ? ['approved', 'Active'] : ['draft', 'Disabled'] })],
        acts: [
          act('Open', open),
          ...(can
            ? [act('Remove', () => c.ui.confirm(`Remove ${u.n} from ${g.n}?`, 'They lose the roles this group grants.', gr.map((x) => ({ a: roleName(E.L, x.roleId), b: scopeLabel(E.L, x) })), 'Remove', () => E.save(() => c.call('DELETE', `groups/${g.id}/users/${u.id}`), 'Removed user from groups', `${u.n} ← ${g.n}`, `${u.n} removed from ${g.n}.`).then((e) => e || undefined)), 'ghost')]
            : []),
        ],
      };
    }),
  };
}

/** Effective roles (from KAP) and the grants known to this console. */
function accountAccess(E: Env, u: LiveUser): Section[] {
  const gs = E.groupsOfU(u);
  const known = E.L.grants.filter((x) => gs.some((g) => g.id === x.gid));
  return [
    {
      title: 'Effective roles',
      cols: ['Role', 'Code', 'Permissions'],
      mode: 'inline',
      empty: !u.detailed ? 'Effective roles could not be read from KAP.' : u.active ? 'No role. Calls that need a permission are rejected.' : 'Account deactivated.',
      callout: 'From KAP: the roles this account holds through its groups. KAP checks every call against current group membership.',
      rows: E.rolesOf(u.roles).map((r): Row => ({ key: `er:${r.code}`, cells: [cell(r.n), cell(r.code, { m: true }), cell(r.perms.join(', ') || '—')] })),
    },
    {
      title: 'Access grants',
      cols: ['Role', 'Resource scope', 'Through group', 'Grant'],
      mode: 'inline',
      empty: 'None made from this console. KAP does not list existing grants.',
      rows: known.map((x): Row => ({ key: `ea:${x.id}`, cells: [cell(roleName(E.L, x.roleId)), cell(scopeLabel(E.L, x)), cell(groupName(E.L, x.gid), { m: true }), cell(x.id, { m: true })] })),
    },
  ];
}

export function liveUserScreen(c: LiveCtx, name: string, tab0?: string): ScreenModel {
  const E = env(c);
  const u = E.L.users.find((x) => x.n === name && x.type === 'user');
  if (!u) return c.loading ? loadingModel(name) : denied(name, 'user', E.tn);
  const tab = LIVE_USER_TABS.some((x) => x[0] === tab0) ? tab0! : 'overview';
  const path = (t: string) => `users/${enc(u.n)}${t === 'overview' ? '' : `/${t}`}`;
  const head: PageHead = { title: u.n, tabs: tabsOf(LIVE_USER_TABS), tab, setTab: (v) => c.go(path(v)), status: activeP(u.active) };
  const sections: Section[] = [];
  if (tab === 'overview') sections.push(accountOverview(c, E, u, c.canUser, 'KAP accounts have no e-mail, display name or sign-in history. Passwords and sessions are managed in KAP.'));
  if (tab === 'groups') sections.push(accountGroups(c, E, u, c.canUser));
  if (tab === 'access') sections.push(...accountAccess(E, u));
  return { head, sections };
}

// ================================================================ GROUPS
export function liveGroupsScreen(c: LiveCtx): ScreenModel {
  const E = env(c);
  const { L } = E;
  const people = L.users.filter((u) => u.active);
  const add = () =>
    c.ui.form(
      'Create group',
      [
        { k: 'n', label: 'Group name', type: 'text', ph: 'e.g. policy_analysts', hint: 'Unique in the tenant. Up to 128 characters.' },
        { k: 'd', label: 'Description', type: 'text' },
        { k: 'members', label: 'Members', type: 'chips', opts: people.map((u) => u.n), val: [] },
      ],
      'Create group',
      (v) => {
        const nm = String(v.n ?? '').trim();
        const members: string[] = v.members ?? [];
        if (!nm || nm.length > 128) return 'Enter a group name (up to 128 characters).';
        if (L.groups.some((g) => g.n === nm)) return 'A group with this name already exists.';
        const ids = people.filter((u) => members.includes(u.n)).map((u) => u.id);
        return E.save(
          async () => {
            const g = await c.call<{ id: string }>('POST', 'groups', toKapGroupCreate(nm, v.d));
            for (const id of ids) await c.call('POST', `groups/${g.id}/users`, toKapMember(id));
          },
          'Created group',
          nm + (members.length ? ` · members ${members.join(', ')}` : ''),
          `Group ${nm} created.`,
        );
      },
    );
  return {
    head: { title: 'Groups', add: c.canUser ? act('Create group', add, 'primary') : undefined },
    sections: [
      {
        cols: ['Group', 'Description', 'Members', 'Access assignments', 'Status'],
        mode: 'inline',
        empty: c.loading ? 'Loading from KAP…' : 'No groups in KAP for this tenant.',
        callout: 'KAP does not list the role grants of a group. Access assignments made from this console in this session are shown.',
        rows: L.groups.map((g): Row => {
          const gr = E.grantsOfG(g);
          const open = () => c.go(`groups/${enc(g.n)}`);
          return { key: `g:${g.id}`, cells: [cell(g.n, { m: true }), cell(g.d || '—'), cell(String(g.members.length)), cell(gr.length ? gr.map(E.grantL).join('; ') : '—'), cell('', { p: g.active ? ['approved', 'Active'] : ['draft', 'Disabled'] })], acts: [act('Open', open)], onClick: open };
        }),
      },
    ],
  };
}

export const LIVE_GROUP_TABS: [string, string][] = [['members', 'Members'], ['access', 'Access']];

export function liveGroupScreen(c: LiveCtx, gn: string, tab0?: string): ScreenModel {
  const E = env(c);
  const { L } = E;
  const g = L.groups.find((x) => x.n === gn);
  if (!g) return c.loading ? loadingModel(gn) : denied(gn, 'group', E.tn);
  const tab = LIVE_GROUP_TABS.some((x) => x[0] === tab0) ? tab0! : 'members';
  const path = (t: string) => `groups/${enc(g.n)}${t === 'members' ? '' : `/${t}`}`;
  const head: PageHead = { title: g.n, tabs: tabsOf(LIVE_GROUP_TABS), tab, setTab: (v) => c.go(path(v)) };
  const gr = E.grantsOfG(g);
  const grItems = gr.map((x) => ({ a: roleName(L, x.roleId), b: scopeLabel(L, x) }));
  const sections: Section[] = [];

  if (tab === 'members') {
    const patch = (next: Parameters<typeof toKapGroupPatch>[1], action: string, res: string, toast: string) => {
      const body = toKapGroupPatch(g, next);
      if (!Object.keys(body).length) return Promise.resolve('No change.');
      return E.save(() => c.call('PATCH', `groups/${g.id}`, body), action, res, toast);
    };
    const toggle = g.active
      ? () => c.ui.confirm(`Disable ${g.n}?`, 'Members lose the roles this group grants until it is enabled.', grItems, 'Disable', () => patch({ active: false }, 'Disabled group', g.n, `${g.n} disabled.`).then((e) => e || undefined))
      : () => c.ui.confirm(`Enable ${g.n}?`, 'Members get the roles this group grants again.', grItems, 'Enable', () => patch({ active: true }, 'Enabled group', g.n, `${g.n} enabled.`).then((e) => e || undefined));
    const cand = L.users.filter((u) => u.active && !g.members.includes(u.id));
    const addMembers = () =>
      c.ui.form(`Add members to ${g.n}`, [{ k: 'm', label: 'Users and service accounts', type: 'chips', opts: cand.map((u) => u.n), val: [] }], 'Add', (v) => {
        const sel: string[] = v.m ?? [];
        if (!sel.length) return 'Select at least one account.';
        const ids = cand.filter((u) => sel.includes(u.n)).map((u) => u.id);
        return E.save(
          async () => {
            for (const id of ids) await c.call('POST', `groups/${g.id}/users`, toKapMember(id));
          },
          'Added members to group',
          `${g.n} · ${sel.join(', ')}`,
          sel.length + (sel.length === 1 ? ' member added.' : ' members added.'),
        );
      });
    const rename = () =>
      c.ui.form('Group name', [{ k: 'v', label: 'Group name', type: 'text', val: g.n }], 'Save', (v) => {
        const nm = String(v.v ?? '').trim();
        if (!nm) return 'Enter a group name.';
        if (L.groups.some((x) => x.id !== g.id && x.n === nm)) return 'A group with this name already exists.';
        return patch({ name: nm }, 'Changed group', `${g.n} → ${nm}`, 'Group renamed.').then((e) => {
          if (!e) c.go(`groups/${enc(nm)}`);
          return e;
        });
      });
    sections.push(
      {
        form: true,
        note: 'KAP does not delete groups. Disable a group to withdraw the roles it grants.',
        rows: [
          fr('Group name', g.n, '', c.canUser ? [act('Rename', rename)] : []),
          fr('Description', g.d || '—', '', c.canUser ? [act('Edit', () => c.ui.form('Description', [{ k: 'v', label: 'Description', type: 'text', val: g.d }], 'Save', (v) => patch({ description: String(v.v ?? '') }, 'Changed group', `${g.n} · description`, 'Description saved.')))] : []),
          fr('Status', g.active ? 'Active' : 'Disabled', g.active ? '' : 'Its roles do not apply', c.canUser ? [act(g.active ? 'Disable' : 'Enable', toggle)] : []),
          fr('Membership source', 'Managed in KAP'),
          fr('Created', g.created),
          fr('KAP id', g.id),
        ],
      },
      {
        title: 'Members',
        sacts: c.canUser && cand.length ? [act('Add members', addMembers)] : [],
        cols: ['Account', 'Description', 'Type', 'Status'],
        mode: 'inline',
        empty: 'No members.',
        rows: g.members
          .map((id) => L.users.find((u) => u.id === id)!)
          .filter(Boolean)
          .map((u): Row => ({
            key: `gm:${u.id}`,
            cells: [cell(u.n, { m: true }), cell(u.d || '—'), cell(u.type === 'service_account' ? 'Service account' : 'User'), cell('', { p: activeP(u.active) })],
            acts: [
              act('Open', () => c.go(u.type === 'service_account' ? `service-accounts/${enc(u.n)}` : `users/${enc(u.n)}`)),
              ...(c.canUser
                ? [act('Remove', () => c.ui.confirm(`Remove ${u.n} from ${g.n}?`, 'They lose the roles this group grants.', grItems, 'Remove', () => E.save(() => c.call('DELETE', `groups/${g.id}/users/${u.id}`), 'Removed members from group', `${g.n} · ${u.n}`, `${u.n} removed from ${g.n}.`).then((e) => e || undefined)), 'ghost')]
                : []),
            ],
          })),
      },
    );
  }

  if (tab === 'access') {
    const SC = scopeOptions(L);
    const assign = () =>
      c.ui.form(
        `Assign access to ${g.n}`,
        [
          { k: 'r', label: 'Role', type: 'select', opts: L.roles.map((r) => r.n), val: L.roles.find((r) => r.code === 'analyst')?.n ?? L.roles[0]?.n },
          { k: 's', label: 'Resource scope', type: 'select', opts: SC, val: SC.find((x) => x === 'All · agent') ?? SC[0], hint: 'All resources of a type, or one resource. audit, rbac and user accept only all.' },
        ],
        'Assign',
        (v) => {
          const r = L.roles.find((x) => x.n === v.r);
          const s = parseScope(L, String(v.s ?? ''));
          if (!r) return 'Select a role.';
          if (!s) return 'Select a resource scope.';
          let body: ReturnType<typeof toKapGrant>;
          try {
            body = toKapGrant(r.id, s);
          } catch (e) {
            return (e as Error).message;
          }
          if (gr.some((x) => x.roleId === r.id && x.rt === s.rt && x.scope === s.scope && x.rid === s.rid)) return 'This group already has this role on this scope.';
          return E.save(
            async () => {
              const out = await c.call<KapGrant>('POST', `groups/${g.id}/access-grants`, body);
              c.remember((n) => { n.grants.push(toGrant({ ...out, group_id: out.group_id ?? g.id })); });
            },
            'Created access grant',
            `${g.n} → ${r.n} on ${v.s}`,
            `${r.n} assigned to ${g.n}.`,
          );
        },
      );
    const revokeById = () =>
      c.ui.form(`Revoke a grant of ${g.n}`, [{ k: 'id', label: 'Grant id', type: 'text', hint: 'The id KAP returned when the grant was made (KAP does not list grants).' }], 'Revoke', (v) => {
        const id = String(v.id ?? '').trim();
        if (!/^[0-9a-fA-F-]{36}$/.test(id)) return 'Enter the grant id (a UUID).';
        return E.save(async () => { await c.call('DELETE', `groups/${g.id}/access-grants/${id}`); c.remember((n) => { n.grants = n.grants.filter((y) => y.id !== id); }); }, 'Revoked access grant', `${id} · ${g.n}`, 'Grant revoked.');
      });
    sections.push({
      title: 'Access assignments',
      sacts: c.canGrantM ? [act('Assign access', assign), act('Revoke by id', revokeById, 'ghost')] : [],
      cols: ['Role', 'Resource scope', 'Permissions', 'Grant'],
      mode: 'inline',
      empty: 'No access assignments made from this console. KAP does not list existing grants.',
      callout: 'Roles are granted in KAP over a resource type: on all its resources, or on one. Members get them through membership. Access policies (classification, need-to-know) have no KAP equivalent.',
      rows: gr.map((x): Row => {
        const r = L.roles.find((y) => y.id === x.roleId);
        return {
          key: `ga:${x.id}`,
          cells: [cell(roleName(L, x.roleId)), cell(scopeLabel(L, x)), cell(r ? String(r.perms.length) : '—', { tip: r?.perms.join(', ') }), cell(x.id, { m: true, sub: x.created })],
          acts: c.canGrantM
            ? [act('Revoke', () => c.ui.confirm(`Revoke ${roleName(L, x.roleId)} on ${scopeLabel(L, x)}?`, g.members.length ? 'These members lose this access:' : 'The group has no members.', g.members.map((m) => ({ a: E.userL(m), b: g.n })), 'Revoke', () => E.save(async () => { await c.call('DELETE', `groups/${g.id}/access-grants/${x.id}`); c.remember((n) => { n.grants = n.grants.filter((y) => y.id !== x.id); }); }, 'Revoked access grant', `${x.id} · ${g.n} → ${roleName(L, x.roleId)} on ${scopeLabel(L, x)}`, 'Grant revoked.').then((e) => e || undefined)), 'ghost')]
            : [],
        };
      }),
    });
  }
  return { head, sections };
}

// ================================================================ ROLES & PERMISSIONS
export function liveRolesScreen(c: LiveCtx, tab0?: string): ScreenModel {
  const E = env(c);
  const { L } = E;
  const base = rolesScreen(c.session, tab0);
  if (base.head.tab === 'policies') {
    const [first, ...rest] = base.sections;
    return {
      head: { ...base.head, add: base.head.add && { ...base.head.add, l: 'Create session policy' } },
      sections: [{ ...first, callout: 'Session only: KAP has no access policies (classification, need-to-know). In sandbox they apply to this console’s access simulation until the page is reloaded, not to KAP.' }, ...rest],
    };
  }
  const catalogue = [...new Set([...L.perms.map((p) => p.code), ...L.roles.flatMap((r) => r.perms)])].sort();
  const usedBy = (id: string): Item[] => L.grants.filter((g) => g.roleId === id).map((g) => ({ a: groupName(L, g.gid), b: 'Group', c: scopeLabel(L, g) }));
  const kapRoles: Section = {
    title: 'KAP roles',
    cols: ['Role', 'Type', 'Permissions', 'Used by'],
    mode: 'panel',
    empty: c.loading ? 'Loading from KAP…' : 'No roles returned by KAP.',
    callout: 'From KAP. System roles are fixed; KAP custom roles are created in KAP’s admin panel. Used by shows the grants made from this console.',
    rows: L.roles.map((r): Row => {
      const used = usedBy(r.id);
      return {
        key: `kr:${r.id}`,
        cells: [cell(r.n, { sub: r.code }), cell('', { p: r.sys ? ['draft', 'System'] : ['submitted', 'Custom'] }), cell(`${r.perms.length} of ${catalogue.length}`), cell(used.length ? used.length + (used.length === 1 ? ' assignment' : ' assignments') : '—')],
        kv: kv([['Code', r.code, true], ['Description', r.d], ['KAP id', r.id, true]]),
        perms: catalogue.map((p) => ({ p, on: r.perms.includes(p) })),
        lists: [{ title: 'Assigned from this console', items: used, empty: 'None known' }],
      };
    }),
  };
  const sessionRows = (base.sections[0]?.rows ?? []).filter((r) => !Object.keys(BUILTIN_ROLES).includes(r.key.slice(2)));
  const custom: Section = {
    ...base.sections[0],
    title: 'Console custom roles',
    badge: 'Session only',
    rows: sessionRows,
    empty: 'None.',
    callout: 'Session only: these roles exist in this console’s access simulation and are not created in KAP (KAP has no API to create roles), so they cannot be assigned in KAP.',
  };
  return { head: { ...base.head, add: base.head.add && { ...base.head.add, l: 'Create session role' } }, sections: [kapRoles, custom] };
}

// ================================================================ SERVICE ACCOUNTS
const LIFE = ['30 days', '60 days', '90 days', '180 days', 'No expiry'];

/** Create an OAuth client and show its secret once. */
function issueCred(c: LiveCtx, E: Env, u: { id: string; n: string }, label: string, life: string): Promise<string> {
  let out: KapOauthClient | null = null;
  const exp = life === 'No expiry' ? null : inDays(parseInt(life, 10));
  return E.save(
    async () => {
      out = await c.call<KapOauthClient>('POST', 'oauth-clients', toKapOauthClient(u.id, label, exp));
    },
    'Issued service account credential',
    `${u.n} · ${label}`,
    'OAuth client created.',
  ).then((e) => {
    const o = out as KapOauthClient | null;
    if (!e && o?.client_secret) c.ui.secret(`Client secret for ${u.n}`, o.client_secret, `Client ID: ${o.client_id}. Shown once; KAP does not issue it again.`);
    return e;
  });
}

export function liveServiceAccountsScreen(c: LiveCtx): ScreenModel {
  const E = env(c);
  const { L } = E;
  const SAS = L.users.filter((u) => u.type === 'service_account');
  const credOn = L.creds !== null;
  const add = () =>
    c.ui.form(
      'Create service account',
      [
        { k: 'n', label: 'Account name', type: 'text', ph: 'e.g. reporting-svc', hint: 'KAP username of the account. It cannot sign in to the admin panel or hold a password.' },
        { k: 'd', label: 'Purpose', type: 'text' },
        { k: 'groups', label: 'Groups', type: 'chips', opts: L.groups.filter((g) => g.active).map((g) => g.n), val: [], hint: 'Its permissions come from the roles of these groups.' },
        ...(credOn ? [{ k: 'exp', label: 'OAuth client expires after', type: 'select', opts: LIFE, val: '90 days', hint: 'An OAuth client is created and its secret shown once.' } as FormField] : [{ type: 'note', text: `Credentials cannot be issued here: ${L.credsWhy || 'OAuth clients are not available.'} Issue them in KAP’s admin panel.`, tone: 'warn' } as FormField]),
      ],
      'Create',
      async (v) => {
        const nm = String(v.n ?? '').trim();
        if (!/^[A-Za-z0-9._@+-]{3,150}$/.test(nm)) return 'Account name: at least 3 letters, digits or . _ @ + -';
        if (L.users.some((u) => u.n === nm)) return 'An account with this name already exists.';
        if (!String(v.d ?? '').trim()) return 'Describe the purpose.';
        const sel: string[] = v.groups ?? [];
        let made: KapUserDetails | null = null;
        const e = await E.save(
          async () => {
            made = await c.call<KapUserDetails>('POST', 'users', toKapUserCreate({ username: nm, type: 'service_account', description: v.d, groupIds: L.groups.filter((g) => sel.includes(g.n)).map((g) => g.id) }));
          },
          'Created service account',
          `${nm}${sel.length ? ` · groups ${sel.join(', ')}` : ''}`,
          `Service account ${nm} created.`,
        );
        const m = made as KapUserDetails | null;
        if (e || !credOn || !m) return e;
        const ce = await issueCred(c, E, { id: m.id, n: nm }, `${nm}-1`, v.exp);
        if (ce) c.ui.toast(`Account created, but the OAuth client failed: ${ce}`);
        return '';
      },
    );
  return {
    head: { title: 'Service Accounts', add: c.canCfg ? act('Create service account', add, 'primary') : undefined },
    sections: [
      {
        cols: ['Account', 'Purpose', 'Status', 'Groups', 'Credentials', 'Created'],
        mode: 'inline',
        empty: c.loading ? 'Loading from KAP…' : 'No service accounts yet.',
        rows: SAS.map((a): Row => {
          const open = () => c.go(`service-accounts/${enc(a.n)}`);
          const cr = E.credsOf(a).filter((x) => x.st === 'Active');
          return {
            key: `k:${a.id}`,
            cells: [cell(a.n, { m: true }), cell(a.d || '—'), cell('', { p: a.active ? ['approved', 'Enabled'] : ['draft', 'Disabled'] }), cell(a.detailed ? E.groupsOfU(a).map((g) => g.n).join(', ') || 'None' : 'Not read'), credOn ? cell('', { p: cr.length ? ['approved', `${cr.length} active`] : ['rejected', 'No active credential'] }) : cell('Not available'), cell(a.created)],
            acts: [act('Open', open)],
            onClick: open,
          };
        }),
      },
    ],
  };
}

export const LIVE_SA_TABS: [string, string][] = [['overview', 'Overview'], ['access', 'Access'], ['creds', 'Credentials']];

export function liveServiceAccountScreen(c: LiveCtx, name: string, tab0?: string): ScreenModel {
  const E = env(c);
  const { L } = E;
  const a = L.users.find((x) => x.n === name && x.type === 'service_account');
  if (!a) return c.loading ? loadingModel(name) : denied(name, 'service account', E.tn);
  const tab = LIVE_SA_TABS.some((x) => x[0] === tab0) ? tab0! : 'overview';
  const path = (t: string) => `service-accounts/${enc(a.n)}${t === 'overview' ? '' : `/${t}`}`;
  const head: PageHead = { title: a.n, tabs: tabsOf(LIVE_SA_TABS), tab, setTab: (v) => c.go(path(v)), status: a.active ? ['approved', 'Enabled'] : ['draft', 'Disabled'] };
  const sections: Section[] = [];
  if (tab === 'overview') sections.push(accountOverview(c, E, a, c.canCfg, 'A service account calls KAP with tokens from its OAuth clients; it cannot hold a password or sign in to the admin panel.'));
  if (tab === 'access') sections.push({ ...accountGroups(c, E, a, c.canCfg), title: 'Groups', note: 'A service account gets its permissions from the roles of its groups.' }, ...accountAccess(E, a));
  if (tab === 'creds') {
    if (L.creds === null) {
      sections.push({ cols: ['Client', 'Client ID', 'Created', 'Expires', 'Status'], rows: [], empty: 'OAuth clients are not available here.', callout: `KAP OAuth clients could not be read: ${L.credsWhy || 'not available'}. They need KAP’s single sign-on/M2M setting and the platform forwarding /oauth-clients. Issue credentials in KAP’s admin panel.` });
    } else {
      const cr = E.credsOf(a);
      const create = () =>
        c.ui.form(
          'Create credential',
          [
            { k: 'l', label: 'Label', type: 'text', val: `${a.n}-${cr.length + 1}` },
            { k: 'exp', label: 'Expires after', type: 'select', opts: LIFE, val: '90 days' },
          ],
          'Create',
          (v) => (String(v.l ?? '').trim() ? issueCred(c, E, a, String(v.l), v.exp) : 'Enter a label.'),
        );
      sections.push({
        sacts: c.canCfg && a.active ? [act('Create credential', create)] : [],
        cols: ['Client', 'Client ID', 'Created', 'Expires', 'Status', 'Last used'],
        mode: 'inline',
        empty: 'No OAuth clients.',
        note: 'Rotate by creating a new client, switching the caller over, then revoking the old one. Revocation cannot be undone.',
        rows: cr.map((x): Row => ({
          key: `sc:${x.id}`,
          cells: [cell(x.label || '—'), cell(x.clientId, { m: true }), cell(x.created), cell(x.exp), cell('', { p: x.st === 'Active' ? ['approved', 'Active'] : ['rejected', x.st] }), cell(x.last)],
          acts:
            c.canCfg && x.st === 'Active'
              ? [act('Revoke', () => c.ui.confirm(`Revoke ${x.label || x.clientId}?`, 'Tokens of this client are rejected from now on. This cannot be undone.', [], 'Revoke', () => E.save(() => c.call('POST', `oauth-clients/${x.id}/revoke`), 'Revoked service account credential', `${a.n} · ${x.clientId}`, 'OAuth client revoked.').then((e) => e || undefined)), 'ghost')]
              : [],
        })),
      });
    }
  }
  return { head, sections };
}
