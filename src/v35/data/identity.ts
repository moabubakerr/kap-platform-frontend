/**
 * v35 identity data that the shared access model (src/v35/iam.ts) does not
 * hold: service accounts, identity providers with their group mappings, the
 * directory behind them, per-user sign-in details, and the tenant resource
 * catalogue the effective-access checks walk. Ported from the prototype's
 * iamInit / dhInit (design-ref-v35/app.js).
 */
import { createStore } from '@/engine/store';
import type { TenantKey } from '@/v35/iam';

export interface SaGrant { id: string; r: string; scope: string }
export interface SaCred { id: string; pre: string; created: string; by: string; exp: string; st: 'Active' | 'Revoked' | 'Expires soon'; last: string }
export interface ServiceAccount { t: TenantKey; n: string; d: string; st: 'Active' | 'Disabled'; auth: 'API key' | 'OAuth 2.0 client credentials'; grants: SaGrant[]; creds: SaCred[]; by: string; created: string; last: string }
/** [external group, tenant key or 'platform', KAP group or platform role] */
export type IdpMap = [string, string, string];
export interface Idp { n: string; proto: 'OIDC' | 'SAML 2.0'; issuer: string; cred: string; st: 'Active' | 'Draft'; sync: string; maps: IdpMap[] }
/** sign-in details of a user that the access model does not keep */
export interface UserExtra { mem?: TenantKey[]; created?: string; mfa?: string; pw?: { st: 'Temporary' | 'Set'; at: string } | null; sess?: number }
export interface IamEvent { id: string; who: string; action: string; res: string; tenants: string[]; lvl: 'platform' | 'tenant'; area: string; at: string }

export interface IdentityData {
  sas: ServiceAccount[];
  idps: Idp[];
  /** directory groups per identity provider: provider → external group → usernames */
  dir: Record<string, Record<string, string[]>>;
  users: Record<string, UserExtra>;
  /** authentication source of each platform administrator (absent for directory-synced ones) */
  padminAuth: Record<string, string>;
  /** audit events recorded by User & Permission Management (newest first) */
  audit: IamEvent[];
}

const INITIAL: IdentityData = {
  sas: [
    { t: 'sceai', n: 'dashboards-svc', d: 'Executive dashboards', st: 'Active', auth: 'API key', grants: [{ id: 'SA-301', r: 'API Client', scope: 'agent:sceai_indicators_agent' }, { id: 'SA-302', r: 'API Client', scope: 'collection:sceai_indicators' }], creds: [{ id: 'cred-02', pre: 'kap_live_7Hq2', created: '8 d ago', by: 'sceai_admin', exp: 'in 82 days', st: 'Active', last: '1 min ago' }, { id: 'cred-01', pre: 'kap_live_2bQe', created: '98 d ago', by: 'sceai_admin', exp: '—', st: 'Revoked', last: '8 d ago' }], by: 'sceai_admin', created: '98 d ago', last: '1 min ago' },
    { t: 'sceai', n: 'powerbi-prod', d: 'Power BI reports', st: 'Active', auth: 'OAuth 2.0 client credentials', grants: [{ id: 'SA-303', r: 'API Client', scope: 'collection:sceai_indicators' }], creds: [{ id: 'cred-01', pre: 'kap_live_Rk8v', created: '2 d ago', by: 'sceai_admin', exp: 'in 92 days', st: 'Active', last: 'Never' }], by: 'sceai_admin', created: '2 d ago', last: 'Never' },
    { t: 'sceai', n: 'etl-nightly', d: 'Nightly indicator load', st: 'Active', auth: 'API key', grants: [{ id: 'SA-304', r: 'Pipeline Operator', scope: 'tenant' }], creds: [{ id: 'cred-01', pre: 'kap_live_c91X', created: '81 d ago', by: 'sceai_admin', exp: 'in 9 days', st: 'Expires soon', last: '6 h ago' }], by: 'sceai_admin', created: '81 d ago', last: '6 h ago' },
    { t: 'econ', n: 'budget-sync', d: 'Budget circular sync', st: 'Active', auth: 'API key', grants: [{ id: 'SA-305', r: 'Pipeline Operator', scope: 'tenant' }], creds: [{ id: 'cred-01', pre: 'kap_live_e2Lm', created: '50 d ago', by: 'ea_admin', exp: 'in 40 days', st: 'Active', last: '2 h ago' }], by: 'ea_admin', created: '50 d ago', last: '2 h ago' },
  ],
  dir: {
    'Microsoft Entra ID · SCEAI': { 'SCEAI-KAP-Admins': ['sceai_admin'], 'SCEAI-KAP-Developers': ['r.haddad', 'k.ibrahim'], 'SCEAI-Indicators-Team': ['n.saleh'], 'SCEAI-KAP-Reviewers': ['m.alkuwari'], 'SCEAI-Analysts': ['sceai_analyst', 'n.saleh'] },
    'Microsoft Entra ID · Economic Affairs': { 'EA-KAP-Admins': ['ea_admin'], 'EA-Analysts': ['ea_analyst'] },
    'Keycloak · kap-admin realm': { ai_team: ['kap.ops', 'm.alkuwari', 'r.haddad'], ai_team_sandbox: ['r.haddad'], ai_viewers: ['k.ibrahim'] },
  },
  idps: [
    { n: 'Microsoft Entra ID · SCEAI', proto: 'OIDC', issuer: 'https://login.microsoftonline.com/sceai.example/v2.0', cred: 'secret/platform/kap/entra_sceai_client', st: 'Active', sync: '4 min ago', maps: [['SCEAI-KAP-Admins', 'sceai', 'tenant_admins'], ['SCEAI-KAP-Developers', 'sceai', 'agent_developers'], ['SCEAI-Indicators-Team', 'sceai', 'indicator_builders'], ['SCEAI-KAP-Reviewers', 'sceai', 'agent_reviewers'], ['SCEAI-Analysts', 'sceai', 'economic_analysts']] },
    { n: 'Microsoft Entra ID · Economic Affairs', proto: 'OIDC', issuer: 'https://login.microsoftonline.com/ea.example/v2.0', cred: 'secret/platform/kap/entra_ea_client', st: 'Active', sync: '6 min ago', maps: [['EA-KAP-Admins', 'econ', 'ea_admins'], ['EA-Analysts', 'econ', 'ea_analysts']] },
    { n: 'Keycloak · kap-admin realm', proto: 'OIDC', issuer: 'https://sso.kap.internal/realms/kap-admin', cred: 'secret/platform/kap/keycloak_client', st: 'Active', sync: '4 min ago', maps: [['ai_team', 'platform', 'Platform Administrator'], ['ai_team_sandbox', 'sandbox', 'sbx_admins']] },
    { n: 'Okta · partner access', proto: 'SAML 2.0', issuer: '', cred: '', st: 'Draft', sync: '—', maps: [] },
  ],
  users: {},
  padminAuth: { 'kap.ops': 'Keycloak · kap-admin realm', 'm.alkuwari': 'Keycloak · kap-admin realm', 'r.haddad': 'Keycloak · kap-admin realm' },
  audit: [],
};

export const identityStore = createStore<IdentityData>(() => structuredClone(INITIAL));

/** Maximum credential lifetime (platform configuration · credential policy). */
export const CRED_LIFE_MAX = '90 days';
/** Client credentials an identity provider can use (platform secret store). */
export const IDP_SECRETS = ['secret/platform/kap/entra_sceai_client', 'secret/platform/kap/entra_ea_client', 'secret/platform/kap/keycloak_client', 'secret/platform/kap/okta_client'];

export const TENANT_NAMES: Record<string, string> = { sceai: 'SCEAI', econ: 'Economic Affairs', sandbox: 'sandbox', default: 'Default', platform: 'KAP platform' };

/** Agents per tenant (scope options and the effective-access check). */
export const TENANT_AGENTS: Record<TenantKey, string[]> = {
  sceai: ['sceai_indicators_agent', 'sceai_indicators_oxford', 'Intent Agent', 'Composer Agent', 'Article Agent'],
  econ: ['policy_brief_agent', 'budget_variance_agent'],
  sandbox: ['exp_router', 'vision_experiment', 'sbx_research_agent', 'c001_account_assistant'],
  default: [],
};

// ------------------------------------------------------------------ resource catalogue
export interface ResCollection { id: string; ds: string[]; docs: string[] }
export interface ResDocument { id: string; cls: string; coll?: string }
export interface TenantResources { collections: ResCollection[]; datasets: string[]; documents: ResDocument[] }

const day = (n: number) => new Date(Date.UTC(2026, 10, 24) - n * 864e5).toISOString().slice(0, 10);
const TOPICS = ['tourism', 'inflation', 'trade', 'investment', 'labour', 'logistics', 'energy', 'fiscal', 'housing', 'digital'];
const UPLOADS = ['Board_minutes_2026-09.pdf', 'Board_minutes_2026-10.pdf', 'Supplier_contracts_summary.docx', 'Meeting_notes_2026-11-18.txt', 'Regional_outlook_2027.pdf', 'Investor_FAQ.html', 'Site_inspection_report_07.pdf', 'Workshop_slides_export.pdf', 'Market_scan_Q3.docx', 'Partner_MoU_draft.docx', 'Quarterly_brief_Q2.pdf', 'Stakeholder_letters.eml', 'Procurement_policy.pdf', 'Research_digest_10.txt', 'Economic_calendar_2027.html', 'Press_briefing_transcript.txt'];

function catalogue(): Record<TenantKey, TenantResources> {
  const R: Record<TenantKey, TenantResources> = {
    sceai: {
      datasets: ['sceai_indicator_observations', 'sceai_indicator_definitions', 'sceai_strategy_targets', 'trade_flows_2026q3', 'psa_labour_force_2026_10', 'psa_prices_2026_10', 'psa_trade_2026_10', 'pm_projects', 'pm_milestones', 'fdi_inflows_h1_2026'],
      documents: [
        { id: 'NDS2_Economic_Diversification.docx', cls: 'L2 · Restricted' },
        { id: 'SCEAI_Annual_Review_2024.docx', cls: 'L1 · Internal' },
        { id: 'SCEAI_Annual_Review_draft.docx', cls: 'L1 · Internal' },
        { id: 'article_2026-11-12_tourism.html', cls: 'L0 · Public' },
        { id: 'article_2026-11-05_inflation_ar.html', cls: 'L0 · Public' },
        { id: 'Investment_Climate_Brief_2026.pdf', cls: 'L1 · Internal' },
      ],
      collections: [
        { id: 'sceai_indicators', ds: ['sceai_indicator_observations', 'sceai_indicator_definitions', 'sceai_strategy_targets'], docs: [] },
        { id: 'sceai_articles', ds: [], docs: ['article_2026-11-12_tourism.html', 'article_2026-11-05_inflation_ar.html'] },
        { id: 'nds_planning_docs', ds: [], docs: ['NDS2_Economic_Diversification.docx', 'SCEAI_Annual_Review_2024.docx', 'SCEAI_Annual_Review_draft.docx'] },
      ],
    },
    econ: {
      datasets: ['econ_indicator_observations'],
      documents: [{ id: 'Budget_Circular_2026-07.pdf', cls: 'L1 · Internal' }],
      collections: [
        { id: 'econ_indicators', ds: ['econ_indicator_observations'], docs: [] },
        { id: 'budget_reports', ds: [], docs: ['Budget_Circular_2026-07.pdf'] },
      ],
    },
    sandbox: {
      datasets: ['sandbox_indicator_observations', 'c001_transactions'],
      documents: [
        { id: 'Open_Data_Guide.pdf', cls: 'L0 · Public' },
        { id: 'Model_Risk_Assessment.docx', cls: 'L2 · Confidential' },
        { id: 'C001_Service_Agreement.pdf', cls: 'L2 · Confidential' },
        { id: 'C001_Correspondence_2026.eml', cls: 'L2 · Confidential' },
      ],
      collections: [
        { id: 'sandbox_indicators', ds: ['sandbox_indicator_observations'], docs: [] },
        { id: 'sandbox_public_docs', ds: [], docs: ['Open_Data_Guide.pdf'] },
        { id: 'sandbox_confidential_docs', ds: [], docs: ['Model_Risk_Assessment.docx'] },
        { id: 'customer_c001', ds: ['c001_transactions'], docs: ['C001_Service_Agreement.pdf', 'C001_Correspondence_2026.eml'] },
      ],
    },
    default: { datasets: [], documents: [], collections: [] },
  };
  // the document inventory the collections count (generated, as in the prototype)
  for (let i = 0; i < 90; i++) {
    const ar = i % 3 === 0;
    R.sceai.documents.push({ id: `article_${day(2 + i * 3)}_${TOPICS[i % TOPICS.length]}${ar ? '_ar' : ''}.html`, cls: 'L0 · Public', coll: 'sceai_articles' });
  }
  for (let i = 0; i < 11; i++) R.sceai.documents.push({ id: `NDS2_chapter_${String(i + 1).padStart(2, '0')}.docx`, cls: 'L2 · Restricted', coll: 'nds_planning_docs' });
  UPLOADS.forEach((id, i) => R.sceai.documents.push({ id, cls: i % 4 === 1 ? 'L2 · Restricted' : 'L1 · Internal' }));
  for (let i = 0; i < 47; i++) R.econ.documents.push({ id: `Directorate_report_2026_${String(i + 1).padStart(2, '0')}.pdf`, cls: 'L1 · Internal', coll: 'budget_reports' });
  ['Test_upload_01.txt', 'Test_upload_02.pdf', 'Prompt_samples.html'].forEach((id) => R.sandbox.documents.push({ id, cls: 'L0 · Public' }));
  for (const t of Object.keys(R) as TenantKey[])
    for (const c of R[t].collections) for (const d of R[t].documents) if (d.coll === c.id && !c.docs.includes(d.id)) c.docs.push(d.id);
  return R;
}

export const RESOURCES: Record<TenantKey, TenantResources> = catalogue();
