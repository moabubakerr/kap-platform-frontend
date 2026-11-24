/**
 * Business Data Hub (v35): collections, structured datasets, documents and the
 * tenant ontology with its extracted entities, per tenant. Port of the
 * prototype's dhInit + dhExtend (design-ref-v35/app.js 2000–2153).
 *
 * Collections reference datasets and documents by ID; nothing is copied.
 * The session store keeps create/edit/delete changes like the prototype.
 */
import { createStore } from '@/engine/store';
import type { IamPolicy, TenantKey } from '@/v35/iam';

export type DataTenant = 'sceai' | 'econ' | 'sandbox';
export const DATA_TENANTS: DataTenant[] = ['sceai', 'econ', 'sandbox'];
export const isDataTenant = (t: string | null | undefined): t is DataTenant => !!t && (DATA_TENANTS as string[]).includes(t);
export const TENANT_NAME: Record<DataTenant, string> = { sceai: 'SCEAI', econ: 'Economic Affairs', sandbox: 'sandbox' };

export interface DhField { n: string; ty: string; d: string; k: string }
export interface DhDataset {
  id: string;
  kind: string;
  desc: string;
  rows: number;
  fields: DhField[];
  preview: string[][];
  src: { reg?: string; conn?: string; pkg?: string; pipe?: string; run?: string };
  st: string;
  upd: string;
  /** [file, version, rows, loaded] */
  files: [string, string, string, string][];
}
export interface DhDocument {
  id: string;
  ty: string;
  title: string;
  lang: string;
  pages: number;
  /** [version, received, note] — newest first */
  vers: [string, string, string][];
  ex: 'Done' | 'Failed';
  chunks: number;
  idx: string;
  text: string;
  err: string;
  src: { conn?: string; pkg?: string; pipe?: string; run?: string };
  gen?: boolean;
  coll?: string | null;
  /** classification (name of a Classification policy) */
  cls: string;
  entSt: string;
  entN: number;
  /** ingestion date (YYYY-MM-DD) */
  at: string;
  /** processing status: Pending · Processing · Completed · Failed */
  pst: string;
}
export interface DhSearch { mode: string; emb: string; rr: string; k: string; min: string; xl: string }
export interface DhCollection {
  id: string;
  purpose: string;
  desc: string;
  ds: string[];
  docs: string[];
  extraDocs: number;
  sq: string[];
  search: DhSearch | null;
  uses7: number;
  last: string;
  impl: boolean;
}
export interface OntoAttr { n: string; ty: string; id: boolean; req: boolean; hint: string }
export interface OntoType { n: string; d: string; attrs: OntoAttr[]; guide: string; cnt: number }
export interface OntoRel { n: string; src: string; tgt: string; dir: 'Directed' | 'Bidirectional'; card: string; ev: string; cnt: number; guide: string }
export interface EntityInst {
  id: string;
  type: string;
  n: string;
  conf: number;
  attrs: [string, string][];
  src: ['dataset' | 'document', string][];
  /** [relationship, target entity id, confidence] */
  rels: [string, string, number][];
  /** [source id, location, excerpt] */
  ev: [string, string, string][];
  run: string;
}
export interface TenantData {
  datasets: DhDataset[];
  documents: DhDocument[];
  collections: DhCollection[];
  onto: { types: OntoType[]; rels: OntoRel[] };
  inst: EntityInst[];
}
export interface BusinessData {
  tenants: Record<DataTenant, TenantData>;
  /** collections each agent may use (prototype resIndex().agColl) */
  agColl: Record<string, string[]>;
}

// ------------------------------------------------------------------ initial data (dhInit)
const F = (n: string, ty: string, d: string, k = ''): DhField => ({ n, ty, d, k });
const IND_FIELDS = (): DhField[] => [F('indicator_id', 'string', 'Series code', 'Key'), F('country', 'string', 'ISO country name', 'Key'), F('sector', 'string', 'Sector dimension', ''), F('period', 'period', 'Reporting period (month, quarter or year)', 'Key'), F('value', 'decimal', 'Observed value', 'Unit from the indicator'), F('value_type', 'enum', 'actual · target · forecast', ''), F('source_id', 'string', 'Identifier of the originating source', ''), F('ingested_at', 'timestamp', 'Load time', '')];

type DocIn = Omit<DhDocument, 'cls' | 'entSt' | 'entN' | 'at' | 'pst' | 'err'> & { err?: string; cls?: string; entSt?: string; entN?: number };
type TenantIn = { datasets: DhDataset[]; documents: DocIn[]; collections: DhCollection[] };

const SEARCH = (k: string, min: string, xl: string, rr = 'bge-m3-match'): DhSearch => ({ mode: 'Hybrid (keyword + vector)', emb: 'embed-prod · qwen3-embedding', rr, k, min, xl });

function rawTenants(): Record<DataTenant, TenantIn> {
  return {
    sceai: {
      datasets: [
        { id: 'sceai_indicator_observations', kind: 'Time series', desc: 'Observations for SCEAI indicators across countries, sectors and periods.', rows: 8104, fields: IND_FIELDS(),
          preview: [['IND-TOU-014', 'Qatar', 'Tourism', '2024-Q4', '8.8', 'actual', 'qatar_tourism', '6 h ago'], ['IND-TOU-014', 'Qatar', 'Tourism', '2024-Q4', '7.6', 'target', 'nds_targets', '6 h ago'], ['IND-PRC-002', 'Qatar', '—', '2026-10', '1.9', 'actual', 'psa_national_accounts', '6 h ago'], ['IND-GDP-001', 'Qatar', '—', '2026-Q2', '2.4', 'actual', 'psa_national_accounts', '6 h ago'], ['IND-TRD-031', 'Qatar', 'Trade', '2025', '17.3', 'actual', 'qcb_statistics', '6 h ago']],
          src: { reg: 'psa_national_accounts, qatar_tourism, qcb_statistics', conn: 'sceai_bucket', pkg: 'indicators_csv_daily', pipe: 'indicators_csv_ingest', run: 'Run 87 · 6 h ago · succeeded' }, st: 'Ingested', upd: '6 h ago',
          files: [['sceai_indicators_quarterly.csv', 'v14', '2,316 rows', '6 h ago'], ['sceai_indicators_monthly.csv', 'v31', '4,920 rows', '6 h ago'], ['sceai_indicators_annual.csv', 'v6', '868 rows', '6 h ago']] },
        { id: 'sceai_indicator_definitions', kind: 'Reference table', desc: 'Indicator definitions: code, name, unit, frequency, dimensions and classification.', rows: 7, fields: [F('indicator_id', 'string', 'Indicator code', 'Key'), F('name', 'string', 'Display name', ''), F('unit', 'string', 'Unit of measure', ''), F('frequency', 'enum', 'Monthly · Quarterly · Annual', ''), F('dimensions', 'list', 'Dimensions used by observations', ''), F('classification', 'enum', 'L0–L3', '')],
          preview: [['IND-TOU-014', 'Tourism contribution to GDP', '% of GDP', 'Quarterly', 'Country, Sector', 'L1'], ['IND-PRC-002', 'Consumer price inflation (YoY)', '%', 'Monthly', 'Country', 'L0'], ['IND-GDP-001', 'Real GDP growth', '%', 'Quarterly', 'Country', 'L0']],
          src: { reg: '—', conn: '—', pkg: '—', pipe: 'Maintained in the indicator model', run: 'Edited 12 d ago by m.alkuwari' }, st: 'Ingested', upd: '12 d ago', files: [] },
        { id: 'sceai_strategy_targets', kind: 'Time series', desc: 'NDS targets and forecasts linked to indicators.', rows: 214, fields: [F('indicator_id', 'string', 'Indicator code', 'Key'), F('period', 'period', 'Target period', 'Key'), F('target', 'decimal', 'Target value', ''), F('strategy', 'string', 'Strategy reference', '')],
          preview: [['IND-TOU-014', '2025-Q4', '7.6', 'NDS3'], ['IND-TRD-031', '2026', '18.0', 'NDS3']], src: { reg: 'nds_targets', conn: 'sceai_bucket', pkg: 'targets_manual_upload', pipe: 'indicators_csv_ingest', run: 'Run 71 · 40 d ago · succeeded' }, st: 'Ingested', upd: '40 d ago', files: [['nds3_targets.csv', 'v3', '214 rows', '40 d ago']] },
        { id: 'trade_flows_2026q3', kind: 'Table', desc: 'Quarterly trade flows by partner country, extracted weekly from the data warehouse.', rows: 12480, fields: [F('partner_country', 'string', 'Trading partner', 'Key'), F('hs_section', 'string', 'Harmonized System section', 'Key'), F('flow', 'enum', 'import · export · re-export', 'Key'), F('value_qar', 'decimal', 'Value in QAR', ''), F('quarter', 'period', 'Quarter', 'Key')],
          preview: [['China', 'XVI', 'import', '1,842,100,000', '2026-Q3'], ['India', 'V', 'export', '3,120,500,000', '2026-Q3'], ['Japan', 'V', 'export', '2,904,000,000', '2026-Q3']], src: { reg: 'psa_national_accounts', conn: 'sceai_bucket', pkg: 'trade_upload_1121', pipe: 'tabular_csv_ingest', run: 'Run 3 · 1 d ago · succeeded' }, st: 'Ingested', upd: '1 d ago', files: [['trade_flows_2026q3.csv', 'v1', '12,480 rows', '1 d ago']] },
        { id: 'psa_labour_force_2026_10', kind: 'Table', desc: 'Labour force statistics from the October 2026 delivery.', rows: 3120, fields: [F('quarter', 'period', 'Quarter', 'Key'), F('gender', 'enum', 'Gender', 'Key'), F('age_group', 'string', 'Age group', 'Key'), F('participation_rate', 'decimal', 'Participation rate', '%')], preview: [['2026-Q2', 'F', '25–34', '61.2'], ['2026-Q2', 'M', '25–34', '96.4']], src: {}, st: 'Ingested', upd: '2 h ago', files: [['labour_force.csv', 'v1', '3,120 rows', '2 h ago']] },
        { id: 'psa_prices_2026_10', kind: 'Table', desc: 'Consumer price index components from the October 2026 delivery.', rows: 2604, fields: [F('month', 'period', 'Month', 'Key'), F('cpi_group', 'string', 'CPI group', 'Key'), F('index_value', 'decimal', 'Index value', '2018 = 100')], preview: [['2026-09', 'Food', '108.4'], ['2026-09', 'Housing', '97.1']], src: {}, st: 'Ingested', upd: '2 h ago', files: [['prices.csv', 'v1', '2,604 rows', '2 h ago']] },
        { id: 'psa_trade_2026_10', kind: 'Table', desc: 'Monthly trade summary from the October 2026 delivery.', rows: 3688, fields: [F('month', 'period', 'Month', 'Key'), F('flow', 'enum', 'import · export · re-export', 'Key'), F('value_qar', 'decimal', 'Value', 'QAR')], preview: [['2026-09', 'export', '24,880,000,000']], src: {}, st: 'Ingested', upd: '2 h ago', files: [['trade.csv', 'v1', '3,688 rows', '2 h ago']] },
        { id: 'pm_projects', kind: 'Table', desc: 'Projects from the project management database.', rows: 46, fields: [F('project_id', 'int', 'Project ID', 'Key'), F('name', 'string', 'Project name', ''), F('owner', 'string', 'Owner', ''), F('start_date', 'date', 'Start', ''), F('budget_qar', 'decimal', 'Budget', 'QAR'), F('progress_pct', 'decimal', 'Progress', '%')], preview: [['101', 'National data platform', 'MCIT', '2025-02-01', '48,000,000', '62'], ['102', 'Tourism visitor survey', 'Qatar Tourism', '2026-01-15', '3,200,000', '35']], src: {}, st: 'Ingested', upd: '3 h ago', files: [] },
        { id: 'pm_milestones', kind: 'Table', desc: 'Project milestones from the project management database.', rows: 512, fields: [F('milestone_id', 'int', 'Milestone ID', 'Key'), F('project_id', 'int', 'Project', 'Key'), F('title', 'string', 'Title', ''), F('due_date', 'date', 'Due', ''), F('status', 'enum', 'planned · done · late', '')], preview: [['5501', '101', 'Pilot go-live', '2026-12-15', 'planned']], src: {}, st: 'Ingested', upd: '3 h ago', files: [] },
        { id: 'fdi_inflows_h1_2026', kind: 'Table', desc: 'FDI inflows by source country, first half of 2026 (uploaded file).', rows: 212, fields: [F('source_country', 'string', 'Source country', 'Key'), F('sector', 'string', 'Sector', 'Key'), F('inflow_usd_m', 'decimal', 'Inflow', 'USD million')], preview: [['United Kingdom', 'Finance', '412.5'], ['United States', 'Energy', '388.0']], src: {}, st: 'Ingested', upd: '1 d ago', files: [['fdi_inflows_h1_2026.csv', 'v1', '212 rows', '1 d ago']] },
      ],
      documents: [
        { id: 'NDS2_Economic_Diversification.docx', ty: 'DOCX', title: 'NDS2 economic diversification chapter', lang: 'English', pages: 38, vers: [['v2', '1 d ago', 'Re-uploaded by n.saleh'], ['v1', '120 d ago', 'Initial load']], ex: 'Done', chunks: 96, idx: 'Indexed', text: 'Economic diversification remains the central objective of the second National Development Strategy. Non-hydrocarbon sectors are expected to grow by an average of 4.5% per year…', src: { conn: 'sceai_bucket', pkg: 'docs_docx_ingest', pipe: 'docs_docx_ingest', run: 'Run 87 · 1 d ago' } },
        { id: 'SCEAI_Annual_Review_2024.docx', ty: 'DOCX', title: 'SCEAI annual review 2024', lang: 'English, Arabic', pages: 64, vers: [['v3', '1 d ago', 'Final'], ['v2', '30 d ago', 'Draft 2'], ['v1', '62 d ago', 'Draft 1']], ex: 'Done', chunks: 142, idx: 'Indexed', text: 'In 2024 the Council monitored 214 indicators across 18 sectors. Tourism contribution to GDP reached 8.8% in Q4, above the 7.6% target…', src: { conn: 'sceai_bucket', pkg: 'docs_docx_ingest', pipe: 'docs_docx_ingest', run: 'Run 87 · 1 d ago' } },
        { id: 'SCEAI_Annual_Review_draft.docx', ty: 'DOCX', title: 'SCEAI annual review (draft)', lang: '—', pages: 0, vers: [['v1', '1 d ago', 'Upload']], ex: 'Failed', chunks: 0, idx: 'Not indexed', text: '', err: 'Parse failed: the file is password-protected.', src: { conn: 'sceai_bucket', pkg: 'docs_docx_ingest', pipe: 'docs_docx_ingest', run: 'Run 87 · 1 d ago · 1 file skipped' } },
        { id: 'article_2026-11-12_tourism.html', ty: 'HTML', title: 'Tourism sector growth continues in Q3', lang: 'English', pages: 1, vers: [['v1', '11 d ago', 'Published article']], ex: 'Done', chunks: 6, idx: 'Indexed', text: 'Visitor arrivals rose 12% year on year in the third quarter, supported by…', src: { conn: 'sceai_cms_feed', pkg: 'articles_feed', pipe: 'articles_html_ingest', run: 'Run 412 · 11 d ago' } },
        { id: 'article_2026-11-05_inflation_ar.html', ty: 'HTML', title: 'التضخم يستقر في أكتوبر', lang: 'Arabic', pages: 1, vers: [['v1', '18 d ago', 'Published article']], ex: 'Done', chunks: 5, idx: 'Indexed', text: 'استقر معدل التضخم السنوي عند 1.9% في أكتوبر…', src: { conn: 'sceai_cms_feed', pkg: 'articles_feed', pipe: 'articles_html_ingest', run: 'Run 405 · 18 d ago' } },
        { id: 'Investment_Climate_Brief_2026.pdf', ty: 'PDF', title: 'Investment climate brief 2026', lang: 'English', pages: 12, vers: [['v1', '1 d ago', 'Upload']], ex: 'Done', chunks: 31, idx: 'Indexed', text: 'Foreign direct investment inflows increased in the first half of 2026…', src: { conn: 'sceai_bucket', pkg: 'docs_upload_1121', pipe: 'docs_pdf_ingest', run: 'Run 5 · 1 d ago' } },
      ],
      collections: [
        { id: 'sceai_indicators', purpose: 'Data scope', desc: 'SCEAI indicator observations, definitions and strategy targets for Ask AI and indicator agents.', ds: ['sceai_indicator_observations', 'sceai_indicator_definitions', 'sceai_strategy_targets'], docs: [], extraDocs: 0, sq: ['sceai_indicator_tools (find_indicator, get_indicator_value, actual_vs_target, get_time_series, …)', 'Numeric Analysis Toolkit'], search: null, uses7: 1184, last: '2 min ago', impl: true },
        { id: 'sceai_articles', purpose: 'Data scope', desc: 'SCEAI published articles in English and Arabic.', ds: [], docs: ['article_2026-11-12_tourism.html', 'article_2026-11-05_inflation_ar.html'], extraDocs: 90, sq: [], search: SEARCH('6', '0.35', 'On · Arabic ↔ English'), uses7: 211, last: '14 min ago', impl: true },
        { id: 'nds_planning_docs', purpose: 'Data scope', desc: 'National Development Strategy planning documents.', ds: [], docs: ['NDS2_Economic_Diversification.docx', 'SCEAI_Annual_Review_2024.docx', 'SCEAI_Annual_Review_draft.docx'], extraDocs: 11, sq: [], search: SEARCH('6', '0.40', 'On · Arabic ↔ English'), uses7: 96, last: '1 h ago', impl: true },
      ],
    },
    econ: {
      datasets: [
        { id: 'econ_indicator_observations', kind: 'Time series', desc: 'Directorate KPIs: budget execution and fiscal indicators.', rows: 1240, fields: IND_FIELDS(), preview: [['EA-BUD-001', 'Qatar', '—', '2026-Q3', '71.4', 'actual', 'mof_budget', '1 d ago']], src: { reg: 'mof_budget', conn: 'budget_reports_share', pkg: 'kpi_monthly', pipe: 'kpi_csv_ingest', run: 'Run 22 · 1 d ago · succeeded' }, st: 'Ingested', upd: '1 d ago', files: [['ea_kpis_2026.csv', 'v9', '1,240 rows', '1 d ago']] },
      ],
      documents: [
        { id: 'Budget_Circular_2026-07.pdf', ty: 'PDF', title: 'Budget circular 7/2026', lang: 'Arabic', pages: 9, vers: [['v1', '40 d ago', 'Received from MoF']], ex: 'Done', chunks: 22, idx: 'Indexed', text: 'تعميم بشأن إعداد الموازنة العامة للسنة المالية 2027…', src: { conn: 'budget_reports_share', pkg: 'circulars_sync', pipe: 'docs_pdf_ingest', run: 'Run 58 · 40 d ago' } },
      ],
      collections: [
        { id: 'econ_indicators', purpose: 'Data scope', desc: 'Economic Affairs KPIs for the budget variance agent.', ds: ['econ_indicator_observations'], docs: [], extraDocs: 0, sq: ['Numeric Analysis Toolkit', 'Read-only structured query over the dataset'], search: null, uses7: 140, last: '3 h ago', impl: true },
        { id: 'budget_reports', purpose: 'Data scope', desc: 'Budget circulars and directorate reports.', ds: [], docs: ['Budget_Circular_2026-07.pdf'], extraDocs: 47, sq: [], search: SEARCH('8', '0.35', 'On · Arabic ↔ English'), uses7: 63, last: '5 h ago', impl: true },
      ],
    },
    sandbox: {
      datasets: [
        { id: 'sandbox_indicator_observations', kind: 'Time series', desc: 'Public test indicators used by the AI team.', rows: 520, fields: IND_FIELDS(), preview: [['TST-001', 'Qatar', '—', '2026-Q2', '3.1', 'actual', 'public_open_data', '2 d ago']], src: { reg: 'public_open_data', conn: 'sbx_bucket', pkg: 'public_ingest', pipe: 'kpi_csv_ingest', run: 'Run 14 · 2 d ago · succeeded' }, st: 'Ingested', upd: '2 d ago', files: [['sandbox_indicators.csv', 'v4', '520 rows', '2 d ago']] },
        { id: 'c001_transactions', kind: 'Table', desc: 'Transactions of customer C001 for 2026.', rows: 1836, fields: [F('txn_id', 'string', 'Transaction ID', 'Key'), F('customer_id', 'string', 'Customer', 'Key · C001'), F('booked_at', 'date', 'Booking date', ''), F('amount', 'decimal', 'Amount', 'QAR'), F('channel', 'enum', 'branch · online · mobile', ''), F('category', 'string', 'Merchant category', '')],
          preview: [['T-778201', 'C001', '2026-11-20', '12,400.00', 'online', 'Equipment'], ['T-778155', 'C001', '2026-11-18', '3,050.50', 'mobile', 'Services'], ['T-778090', 'C001', '2026-11-15', '640.00', 'branch', 'Fees']], src: { reg: 'core_banking_export', conn: 'sbx_bucket', pkg: 'c001_upload', pipe: 'tabular_csv_ingest', run: 'Run 2 · 3 d ago · succeeded' }, st: 'Ingested', upd: '3 d ago', files: [['C001_transactions_2026.csv', 'v1', '1,836 rows', '3 d ago']] },
      ],
      documents: [
        { id: 'Open_Data_Guide.pdf', ty: 'PDF', title: 'Open data publishing guide', lang: 'English', pages: 22, vers: [['v1', '20 d ago', 'Upload']], ex: 'Done', chunks: 40, idx: 'Indexed', text: 'This guide describes how public datasets are prepared for publication…', src: { conn: 'sbx_bucket', pkg: 'public_ingest', pipe: 'docs_pdf_ingest', run: 'Run 9 · 20 d ago' } },
        { id: 'Model_Risk_Assessment.docx', ty: 'DOCX', title: 'Model risk assessment (confidential)', lang: 'English', pages: 17, vers: [['v2', '6 d ago', 'Reviewed'], ['v1', '15 d ago', 'Draft']], ex: 'Done', chunks: 35, idx: 'Re-indexing', text: 'Section 3 lists residual risks for the vision experiment…', src: { conn: 'sbx_bucket', pkg: 'confidential_ingest', pipe: 'confidential_reindex', run: 'Run 112 · running 41 min' } },
        { id: 'C001_Service_Agreement.pdf', ty: 'PDF', title: 'Service agreement · customer C001', lang: 'English', pages: 14, vers: [['v2', '3 d ago', 'Signed copy'], ['v1', '30 d ago', 'Draft']], ex: 'Done', chunks: 28, idx: 'Indexed', text: 'This agreement is entered into between the Provider and Customer C001 for a term of 24 months…', src: { conn: 'sbx_bucket', pkg: 'c001_upload', pipe: 'docs_pdf_ingest', run: 'Run 11 · 3 d ago' } },
        { id: 'C001_Correspondence_2026.eml', ty: 'E-mail thread', title: 'Correspondence with C001 (12 messages)', lang: 'English, Arabic', pages: 12, vers: [['v3', '1 d ago', '2 new messages'], ['v2', '9 d ago', ''], ['v1', '30 d ago', '']], ex: 'Done', chunks: 19, idx: 'Indexed', text: 'Re: renewal terms — please confirm the revised fee schedule before 30 November…', src: { conn: 'sbx_mailbox', pkg: 'c001_mail_sync', pipe: 'mail_ingest', run: 'Run 31 · 1 d ago' } },
      ],
      collections: [
        { id: 'sandbox_indicators', purpose: 'Data scope', desc: 'Public test indicators.', ds: ['sandbox_indicator_observations'], docs: [], extraDocs: 0, sq: ['Numeric Analysis Toolkit'], search: null, uses7: 58, last: '1 d ago', impl: true },
        { id: 'sandbox_public_docs', purpose: 'Data scope', desc: 'Public reference documents.', ds: [], docs: ['Open_Data_Guide.pdf'], extraDocs: 0, sq: [], search: SEARCH('6', '0.30', 'Off', '—'), uses7: 33, last: '1 d ago', impl: true },
        { id: 'sandbox_confidential_docs', purpose: 'Data scope', desc: 'Confidential AI team documents.', ds: [], docs: ['Model_Risk_Assessment.docx'], extraDocs: 0, sq: [], search: SEARCH('6', '0.30', 'Off', '—'), uses7: 12, last: '2 d ago', impl: true },
        { id: 'customer_c001', purpose: 'Entity-specific', desc: 'Everything about customer C001: agreement, correspondence and 2026 transactions.', ds: ['c001_transactions'], docs: ['C001_Service_Agreement.pdf', 'C001_Correspondence_2026.eml'], extraDocs: 0, sq: ['Read-only structured query over the dataset'], search: SEARCH('8', '0.30', 'On · Arabic ↔ English', '—'), uses7: 0, last: 'Not used yet', impl: false },
      ],
    },
  };
}

// ------------------------------------------------------------------ ontology and extracted entities (dhExtend)
const A = (n: string, ty: string, o?: { id?: boolean; req?: boolean; hint?: string }): OntoAttr => ({ n, ty, id: !!o?.id, req: !!(o?.req || o?.id), hint: o?.hint ?? '' });

function ontologies(): Record<DataTenant, Pick<TenantData, 'onto' | 'inst'>> {
  return {
    sceai: {
      onto: {
        types: [
          { n: 'Organization', d: 'Ministries, agencies, companies and international bodies', attrs: [A('name', 'Text', { id: true }), A('organization type', 'Category'), A('country', 'Text')], guide: 'Use the full official name. Merge abbreviations with the full name.', cnt: 27 },
          { n: 'Person', d: 'Named people with an organizational role', attrs: [A('name', 'Text', { id: true }), A('role', 'Text'), A('organization', 'Reference')], guide: 'Only people named together with a role or organization.', cnt: 64 },
          { n: 'Sector', d: 'Economic sectors', attrs: [A('name', 'Text', { id: true }), A('classification code', 'Text')], guide: '', cnt: 18 },
          { n: 'Project', d: 'Programmes and projects with an owner', attrs: [A('name', 'Text', { id: true }), A('owner', 'Reference'), A('start date', 'Date'), A('budget', 'Number')], guide: 'Include projects referenced by code or by name.', cnt: 46 },
          { n: 'Strategic Objective', d: 'Objectives of a published strategy', attrs: [A('code', 'Text', { id: true }), A('title', 'Text', { req: true }), A('horizon', 'Date')], guide: '', cnt: 22 },
          { n: 'Indicator', d: 'Measured quantities reported in data and documents', attrs: [A('code', 'Text', { id: true }), A('name', 'Text', { req: true }), A('unit', 'Text')], guide: 'Match codes in datasets to names in documents.', cnt: 214 },
        ],
        rels: [
          { n: 'works_for', src: 'Person', tgt: 'Organization', dir: 'Directed', card: 'Many-to-one', ev: 'Same paragraph', cnt: 58, guide: '' },
          { n: 'operates_in', src: 'Organization', tgt: 'Sector', dir: 'Directed', card: 'Many-to-many', ev: 'Same document', cnt: 41, guide: '' },
          { n: 'runs', src: 'Organization', tgt: 'Project', dir: 'Directed', card: 'One-to-many', ev: 'Same paragraph', cnt: 39, guide: '' },
          { n: 'contributes_to', src: 'Project', tgt: 'Strategic Objective', dir: 'Directed', card: 'Many-to-many', ev: 'Same document', cnt: 33, guide: '' },
          { n: 'measured_by', src: 'Strategic Objective', tgt: 'Indicator', dir: 'Directed', card: 'One-to-many', ev: 'Same document', cnt: 27, guide: '' },
          { n: 'belongs_to', src: 'Indicator', tgt: 'Sector', dir: 'Directed', card: 'Many-to-one', ev: 'Same record', cnt: 180, guide: '' },
          { n: 'partner_of', src: 'Organization', tgt: 'Organization', dir: 'Bidirectional', card: 'Many-to-many', ev: 'Same sentence', cnt: 12, guide: 'Only explicit agreements or joint programmes.' },
        ],
      },
      inst: [
        { id: 'E-ORG-0012', type: 'Organization', n: 'Qatar Tourism', conf: 0.97, attrs: [['organization type', 'Government agency'], ['country', 'Qatar']], src: [['document', 'article_2026-11-12_tourism.html'], ['document', 'SCEAI_Annual_Review_2024.docx']], rels: [['operates_in', 'E-SEC-TOU', 0.95]], ev: [['article_2026-11-12_tourism.html', 'paragraph 2', 'Qatar Tourism reported a further rise in visitor arrivals…']], run: 'R-0480' },
        { id: 'E-SEC-TOU', type: 'Sector', n: 'Tourism', conf: 0.99, attrs: [['classification code', '55–56, 79']], src: [['dataset', 'sceai_indicator_observations'], ['document', 'article_2026-11-12_tourism.html']], rels: [], ev: [['sceai_indicator_observations', 'column sector', 'Tourism']], run: 'R-0087' },
        { id: 'E-IND-TOU-014', type: 'Indicator', n: 'Tourism contribution to GDP', conf: 0.98, attrs: [['code', 'IND-TOU-014'], ['unit', '% of GDP']], src: [['dataset', 'sceai_indicator_definitions']], rels: [['belongs_to', 'E-SEC-TOU', 0.99]], ev: [['sceai_indicator_definitions', 'row IND-TOU-014', 'Tourism contribution to GDP · % of GDP']], run: 'R-0087' },
        { id: 'E-SO-ED-01', type: 'Strategic Objective', n: 'Economic diversification', conf: 0.91, attrs: [['code', 'SO-ED-01'], ['horizon', '2030']], src: [['document', 'NDS2_Economic_Diversification.docx']], rels: [['measured_by', 'E-IND-TRD-031', 0.86]], ev: [['NDS2_Economic_Diversification.docx', 'page 12', 'Objective SO-ED-01 aims to raise the share of non-hydrocarbon exports…']], run: 'R-0086' },
        { id: 'E-IND-TRD-031', type: 'Indicator', n: 'Non-hydrocarbon exports share', conf: 0.93, attrs: [['code', 'IND-TRD-031'], ['unit', '% of exports']], src: [['dataset', 'sceai_indicator_definitions'], ['document', 'NDS2_Economic_Diversification.docx']], rels: [], ev: [['sceai_indicator_definitions', 'row IND-TRD-031', 'Non-hydrocarbon exports (share)']], run: 'R-0087' },
        { id: 'E-ORG-0031', type: 'Organization', n: 'Investment Promotion Agency', conf: 0.88, attrs: [['organization type', 'Government agency']], src: [['document', 'SCEAI_Annual_Review_2024.docx']], rels: [['runs', 'E-PRJ-0102', 0.81], ['partner_of', 'E-ORG-0012', 0.72]], ev: [['SCEAI_Annual_Review_2024.docx', 'page 9', 'The Investment Promotion Agency leads the logistics free zone expansion…']], run: 'R-0086' },
        { id: 'E-PRJ-0102', type: 'Project', n: 'Logistics free zone expansion', conf: 0.84, attrs: [['start date', '2025-03-01'], ['budget', 'QAR 1.2 bn']], src: [['dataset', 'pm_projects'], ['document', 'SCEAI_Annual_Review_2024.docx']], rels: [['contributes_to', 'E-SO-ED-01', 0.78]], ev: [['pm_projects', 'row P-0102', 'Logistics free zone expansion · phase 2']], run: 'R-0093' },
        { id: 'E-ORG-0005', type: 'Organization', n: 'Planning and Statistics Authority', conf: 0.95, attrs: [['organization type', 'Government agency']], src: [['document', 'SCEAI_Annual_Review_2024.docx']], rels: [], ev: [['SCEAI_Annual_Review_2024.docx', 'page 3', 'Data provided by the Planning and Statistics Authority…']], run: 'R-0086' },
        { id: 'E-PER-0007', type: 'Person', n: 'Director of Planning', conf: 0.76, attrs: [['role', 'Director of Planning']], src: [['document', 'SCEAI_Annual_Review_2024.docx']], rels: [['works_for', 'E-ORG-0005', 0.74]], ev: [['SCEAI_Annual_Review_2024.docx', 'page 7', 'The Director of Planning presented the mid-term review…']], run: 'R-0086' },
      ],
    },
    econ: {
      onto: {
        types: [
          { n: 'Directorate', d: 'Organizational units', attrs: [A('name', 'Text', { id: true }), A('head', 'Text')], guide: '', cnt: 4 },
          { n: 'Budget Program', d: 'Funded programmes in the budget', attrs: [A('code', 'Text', { id: true }), A('title', 'Text', { req: true }), A('fiscal year', 'Number'), A('allocation', 'Number')], guide: 'Program codes have the form BP-YYYY-NN.', cnt: 31 },
        ],
        rels: [{ n: 'runs', src: 'Directorate', tgt: 'Budget Program', dir: 'Directed', card: 'One-to-many', ev: 'Same document', cnt: 29, guide: '' }],
      },
      inst: [
        { id: 'E-BP-2027-04', type: 'Budget Program', n: 'Digital government services', conf: 0.9, attrs: [['code', 'BP-2027-04'], ['fiscal year', '2027']], src: [['document', 'Budget_Circular_2026-07.pdf']], rels: [['runs', 'E-DIR-DG', 0.83]], ev: [['Budget_Circular_2026-07.pdf', 'page 3', 'البرنامج BP-2027-04 للخدمات الحكومية الرقمية…']], run: 'R-0058' },
        { id: 'E-DIR-DG', type: 'Directorate', n: 'Digital Government Directorate', conf: 0.87, attrs: [], src: [['document', 'Budget_Circular_2026-07.pdf']], rels: [], ev: [['Budget_Circular_2026-07.pdf', 'page 3', 'إدارة الحكومة الرقمية']], run: 'R-0058' },
      ],
    },
    sandbox: {
      onto: {
        types: [
          { n: 'Customer', d: 'Customers of the business', attrs: [A('customer ID', 'Text', { id: true }), A('name', 'Text', { req: true }), A('segment', 'Category')], guide: 'Customer IDs have the form C###.', cnt: 2 },
          { n: 'Contract', d: 'Agreements with customers', attrs: [A('reference', 'Text', { id: true }), A('start date', 'Date'), A('value', 'Number')], guide: '', cnt: 1 },
          { n: 'Account', d: 'Customer accounts', attrs: [A('account number', 'Text', { id: true }), A('currency', 'Category')], guide: '', cnt: 3 },
        ],
        rels: [
          { n: 'party_to', src: 'Customer', tgt: 'Contract', dir: 'Directed', card: 'One-to-many', ev: 'Same document', cnt: 1, guide: '' },
          { n: 'owns', src: 'Customer', tgt: 'Account', dir: 'Directed', card: 'One-to-many', ev: 'Same record', cnt: 3, guide: '' },
        ],
      },
      inst: [
        { id: 'E-C001', type: 'Customer', n: 'Al Noor Trading', conf: 0.96, attrs: [['customer ID', 'C001'], ['segment', 'SME']], src: [['dataset', 'c001_transactions'], ['document', 'C001_Service_Agreement.pdf']], rels: [['party_to', 'E-CTR-C001-01', 0.92], ['owns', 'E-ACC-001-01', 0.97]], ev: [['C001_Service_Agreement.pdf', 'page 1', 'This agreement is made between KAP Labs and Al Noor Trading (C001)…']], run: 'R-0011' },
        { id: 'E-CTR-C001-01', type: 'Contract', n: 'Service agreement C001-01', conf: 0.92, attrs: [['start date', '2026-01-01']], src: [['document', 'C001_Service_Agreement.pdf']], rels: [], ev: [['C001_Service_Agreement.pdf', 'page 1', 'Service agreement C001-01, effective 1 January 2026']], run: 'R-0011' },
        { id: 'E-ACC-001-01', type: 'Account', n: 'ACC-001-01', conf: 0.97, attrs: [['currency', 'QAR']], src: [['dataset', 'c001_transactions']], rels: [], ev: [['c001_transactions', 'column account_id', 'ACC-001-01']], run: 'R-0011' },
      ],
    },
  };
}

// ------------------------------------------------------------------ document inventory (dhExtend)
/** ISO date `n` days before 24 Nov 2026 (the prototype's "today"). */
export const dayAgo = (n: number) => new Date(Date.UTC(2026, 10, 24) - n * 864e5).toISOString().slice(0, 10);
const agoDays = (s: string) => {
  const m = /^(\d+)\s*(min|h|d)/.exec(s || '');
  return !m ? 0 : m[2] === 'd' ? +m[1] : 0;
};

type GenOpts = { pages?: number; ex?: 'Done' | 'Failed'; chunks?: number; idx?: string; err?: string; entSt?: string; entN?: number; cls?: string };
const genDoc = (id: string, ty: string, title: string, lang: string, ageD: number, pipe: string, run: string, coll: string | null, o: GenOpts = {}): DocIn => ({
  id, ty, title, lang,
  pages: o.pages || 1 + ((id.length * 7) % 30),
  vers: [['v1', `${ageD} d ago`, '']],
  ex: o.ex || 'Done',
  chunks: o.chunks != null ? o.chunks : 4 + ((id.length * 3) % 40),
  idx: o.idx || 'Indexed',
  text: `${title}…`,
  src: { pipe, run },
  gen: true,
  coll,
  err: o.err || '',
  entSt: o.entSt || 'Not processed',
  entN: o.entN || 0,
  cls: o.cls || '',
});

const DOC_CLS: Record<string, string> = { 'NDS2_Economic_Diversification.docx': 'L2 · Restricted', 'SCEAI_Annual_Review_2024.docx': 'L1 · Internal', 'SCEAI_Annual_Review_draft.docx': 'L1 · Internal', 'article_2026-11-12_tourism.html': 'L0 · Public', 'article_2026-11-05_inflation_ar.html': 'L0 · Public', 'Investment_Climate_Brief_2026.pdf': 'L1 · Internal', 'Budget_Circular_2026-07.pdf': 'L1 · Internal', 'Open_Data_Guide.pdf': 'L0 · Public', 'Model_Risk_Assessment.docx': 'L2 · Confidential', 'C001_Service_Agreement.pdf': 'L2 · Confidential', 'C001_Correspondence_2026.eml': 'L2 · Confidential' };
const DOC_ENT: Record<string, [string, number]> = { 'NDS2_Economic_Diversification.docx': ['Completed', 14], 'SCEAI_Annual_Review_2024.docx': ['Completed', 22], 'SCEAI_Annual_Review_draft.docx': ['Failed', 0], 'article_2026-11-12_tourism.html': ['Completed', 5], 'article_2026-11-05_inflation_ar.html': ['Completed', 3], 'Open_Data_Guide.pdf': ['No entities found', 0], 'C001_Service_Agreement.pdf': ['Completed', 4], 'C001_Correspondence_2026.eml': ['Completed', 2] };

export function initialBusinessData(): BusinessData {
  const R = rawTenants();
  const topics = ['tourism', 'inflation', 'trade', 'investment', 'labour', 'logistics', 'energy', 'fiscal', 'housing', 'digital'];
  for (let i = 0; i < 90; i++) {
    const dd = 2 + i * 3;
    const ar = i % 3 === 0;
    const tp = topics[i % topics.length];
    const id = `article_${dayAgo(dd)}_${tp}${ar ? '_ar' : ''}.html`;
    R.sceai.documents.push(genDoc(id, 'HTML', `${ar ? 'Arabic article · ' : 'Article · '}${tp} update`, ar ? 'Arabic' : 'English', dd, 'articles_html_ingest', 'R-0480', 'sceai_articles', { entSt: i % 17 === 5 ? 'No entities found' : 'Completed', entN: i % 17 === 5 ? 0 : 2 + (i % 6), cls: 'L0 · Public' }));
  }
  for (let i = 0; i < 11; i++) {
    R.sceai.documents.push(genDoc(`NDS2_chapter_${String(i + 1).padStart(2, '0')}.docx`, 'DOCX', `NDS2 chapter ${i + 1}`, i % 4 === 3 ? 'Arabic' : 'English', 60 + i * 9, 'docs_docx_ingest', 'R-0086', 'nds_planning_docs', { entSt: 'Completed', entN: 6 + i, cls: 'L2 · Restricted' }));
  }
  const UPL: [string, string, string][] = [['Board_minutes_2026-09.pdf', 'PDF', 'Completed'], ['Board_minutes_2026-10.pdf', 'PDF', 'Completed'], ['Supplier_contracts_summary.docx', 'DOCX', 'Completed'], ['Meeting_notes_2026-11-18.txt', 'TXT', 'Completed'], ['Regional_outlook_2027.pdf', 'PDF', 'Processing'], ['Investor_FAQ.html', 'HTML', 'Completed'], ['Site_inspection_report_07.pdf', 'PDF', 'Failed'], ['Workshop_slides_export.pdf', 'PDF', 'Pending'], ['Market_scan_Q3.docx', 'DOCX', 'Completed'], ['Partner_MoU_draft.docx', 'DOCX', 'Pending'], ['Quarterly_brief_Q2.pdf', 'PDF', 'Completed'], ['Stakeholder_letters.eml', 'E-mail thread', 'Completed'], ['Procurement_policy.pdf', 'PDF', 'Completed'], ['Research_digest_10.txt', 'TXT', 'Processing'], ['Economic_calendar_2027.html', 'HTML', 'Completed'], ['Press_briefing_transcript.txt', 'TXT', 'Completed']];
  UPL.forEach(([id, ty, stt], i) =>
    R.sceai.documents.push(genDoc(id, ty, id.replace(/\.\w+$/, '').replace(/_/g, ' '), i % 5 === 2 ? 'Arabic' : 'English', 1 + i * 4, 'manual_uploads', 'R-0089', null, { ex: stt === 'Failed' ? 'Failed' : 'Done', idx: stt === 'Completed' ? 'Indexed' : stt === 'Failed' ? 'Not indexed' : stt, err: stt === 'Failed' ? 'OCR timeout after 120 s on page 14' : '', chunks: stt === 'Completed' ? 6 + i : 0, cls: i % 4 === 1 ? 'L2 · Restricted' : 'L1 · Internal' })),
  );
  for (let i = 0; i < 47; i++) {
    R.econ.documents.push(genDoc(`Directorate_report_2026_${String(i + 1).padStart(2, '0')}.pdf`, 'PDF', `Directorate report ${i + 1}`, i % 2 ? 'Arabic' : 'English', 5 + i * 6, 'circulars_sync', 'R-0058', 'budget_reports', { cls: 'L1 · Internal' }));
  }
  ['Test_upload_01.txt', 'Test_upload_02.pdf', 'Prompt_samples.html'].forEach((id, i) =>
    R.sandbox.documents.push(genDoc(id, id.endsWith('.pdf') ? 'PDF' : id.endsWith('.html') ? 'HTML' : 'TXT', id.replace(/\.\w+$/, '').replace(/_/g, ' '), 'English', 3 + i * 5, 'public_ingest', 'R-0112', null, { cls: 'L0 · Public' })),
  );

  const O = ontologies();
  const tenants = {} as Record<DataTenant, TenantData>;
  for (const T of DATA_TENANTS) {
    const D = R[T];
    for (const c of D.collections) {
      for (const d of D.documents) if (d.coll === c.id && !c.docs.includes(d.id)) c.docs.push(d.id);
      c.extraDocs = 0;
      c.purpose = 'Data scope';
    }
    const documents: DhDocument[] = D.documents.map((d0) => {
      const d = { ...d0, err: d0.err ?? '' } as DhDocument;
      if (!d.gen) {
        d.cls = DOC_CLS[d.id] || 'L1 · Internal';
        [d.entSt, d.entN] = DOC_ENT[d.id] || ['Not processed', 0];
      }
      d.at = dayAgo(agoDays(d.vers[d.vers.length - 1][1]) || 1);
      d.pst = d.ex === 'Failed' ? 'Failed' : d.idx === 'Indexed' ? 'Completed' : d.idx === 'Re-indexing' || d.idx === 'Processing' ? 'Processing' : d.idx === 'Pending' ? 'Pending' : d.ex === 'Done' ? 'Completed' : 'Pending';
      return d;
    });
    tenants[T] = { datasets: D.datasets, documents, collections: D.collections, onto: O[T].onto, inst: O[T].inst };
  }
  return {
    tenants,
    agColl: { sceai_indicators_agent: ['sceai_indicators', 'nds_planning_docs'], sceai_indicators_oxford: ['sceai_indicators', 'nds_planning_docs'], 'Article Agent': ['sceai_articles'], 'Indicator Picker': ['sceai_indicators'], policy_brief_agent: ['budget_reports'], budget_variance_agent: ['econ_indicators', 'budget_reports'], sbx_research_agent: ['sandbox_indicators', 'sandbox_public_docs', 'sandbox_confidential_docs'], c001_account_assistant: ['customer_c001'] },
  };
}

/** The editable Business Data Hub state (session). */
export const businessStore = createStore<BusinessData>(initialBusinessData);

// ------------------------------------------------------------------ agents of each tenant (prototype resIndex / dataHub TAG)
export const TENANT_AGENTS: Record<DataTenant, string[]> = {
  sceai: ['sceai_indicators_agent', 'sceai_indicators_oxford', 'Intent Agent', 'Indicator Picker', 'Composer Agent', 'Article Agent', 'Follow-up Agent', 'Reader Agent'],
  econ: ['policy_brief_agent', 'budget_variance_agent'],
  sandbox: ['vision_experiment', 'sbx_research_agent', 'c001_account_assistant'],
};

export interface EntityContext { mode: 'Off' | 'Entities only' | 'Entities and relationships'; hops: string; types: string[] }
/**
 * Business Entities context of each agent's published and draft version (from
 * the prototype's afInit). Only agents with entity context are listed.
 */
export const AGENT_ENTITY_CONTEXT: Record<DataTenant, { id: string; pub: string | null; draft: string | null; pe: EntityContext; de: EntityContext | null }[]> = {
  sceai: [
    { id: 'sceai_indicators_agent', pub: 'v5', draft: 'v6', pe: { mode: 'Entities and relationships', hops: '1 hop', types: ['Indicator', 'Sector', 'Strategic Objective'] }, de: null },
    { id: 'Article Agent', pub: 'v4', draft: null, pe: { mode: 'Entities only', hops: '—', types: ['Organization', 'Person', 'Sector'] }, de: null },
  ],
  econ: [],
  sandbox: [{ id: 'c001_account_assistant', pub: null, draft: 'v1', pe: { mode: 'Off', hops: '—', types: [] }, de: { mode: 'Entities and relationships', hops: '1 hop', types: ['Customer', 'Contract', 'Account'] } }],
};

// ------------------------------------------------------------------ ingestion provenance (reference copy of the prototype's ihInit)
export interface IngestSourceRef { id: string; type: string; loc: string }
export interface IngestPipelineRef { id: string; desc: string; src: string; dsName?: string; uSteps: string[]; entTypes?: string[]; chunk?: string }
export interface IngestRunRef { id: string; pipe: string; start: string; st: string; batch?: string; dedup?: string; items: { n: string; path: string }[]; outDs: string[]; outDocs: string[] }
export interface IngestRef { sources: IngestSourceRef[]; pipelines: IngestPipelineRef[]; runs: IngestRunRef[] }

const UNS = ['File validation', 'Text extraction / OCR', 'Language detection and normalization', 'Chunking', 'Embedding generation', 'Vector indexing'];
const UNS_E = ['File validation', 'Text extraction / OCR', 'Language detection and normalization', 'Chunking', 'Entity and relationship extraction', 'Embedding generation', 'Vector indexing'];
const CH = 'By heading · 800 tokens · 100 overlap';

/**
 * Which pipeline, run and data source published each dataset and document.
 * A read-only reference copy of the Data Ingestion Hub catalog (ihInit), so the
 * provenance rows match the prototype without depending on that hub's store.
 */
export const INGEST_REF: Record<DataTenant, IngestRef> = {
  sceai: {
    sources: [
      { id: 'sceai_bucket', type: 'S3', loc: 's3://sceai-data · https://s3.kap.internal' },
      { id: 'sceai_cms_feed', type: 'REST API', loc: 'https://cms.sceai.gov.qa/api/v2' },
      { id: 'sceai_projects_db', type: 'Microsoft SQL Server', loc: 'sql-pm.sceai.internal:1433 / ProjectsDB' },
      { id: 'sceai_dwh', type: 'Data warehouse · Azure Synapse', loc: 'sceai-synapse.sql.azuresynapse.net / econdw' },
      { id: 'finance_share', type: 'File repository', loc: 'SMB network share · \\\\fs01.sceai.internal\\finance\\reports' },
    ],
    pipelines: [
      { id: 'indicators_csv_ingest', desc: 'Loads indicator observation CSV files.', src: 'sceai_bucket', dsName: 'sceai_indicator_observations', uSteps: [] },
      { id: 'docs_docx_ingest', desc: 'Scans the NDS document folder and indexes PDF and DOCX files.', src: 'sceai_bucket', uSteps: UNS_E, entTypes: ['Organization', 'Person', 'Project', 'Strategic Objective'], chunk: CH },
      { id: 'statistics_zip_ingest', desc: 'Extracts a monthly statistics delivery (ZIP of CSV files) into datasets.', src: 'sceai_bucket', dsName: 'psa_{file}_2026_10', uSteps: [] },
      { id: 'articles_html_ingest', desc: 'Pulls published articles from the CMS API.', src: 'sceai_cms_feed', uSteps: UNS_E, entTypes: ['Organization', 'Person', 'Sector'], chunk: 'By paragraph · 500 tokens · 50 overlap' },
      { id: 'projects_sql_extract', desc: 'Extracts projects and milestones from the project management database.', src: 'sceai_projects_db', dsName: 'pm_{table}', uSteps: [] },
      { id: 'trade_dwh_extract', desc: 'Weekly incremental extract of quarterly trade flows from the warehouse.', src: 'sceai_dwh', dsName: 'trade_flows_2026q3', uSteps: [] },
      { id: 'manual_uploads', desc: 'Files uploaded by administrators; routed by file type.', src: 'manual', dsName: '{file}', uSteps: UNS, chunk: CH },
      { id: 'finance_reports_sync', desc: 'Finance reports from the network share (disabled until access is granted).', src: 'finance_share', uSteps: UNS, chunk: CH },
    ],
    runs: [
      { id: 'R-0093', pipe: 'projects_sql_extract', start: '3 h ago', st: 'Succeeded', items: [{ n: 'dbo.Projects', path: 'ProjectsDB · full table' }, { n: 'dbo.Milestones', path: 'ProjectsDB · full table' }], outDs: ['pm_projects', 'pm_milestones'], outDocs: [] },
      { id: 'R-0091', pipe: 'statistics_zip_ingest', start: '2 h ago', st: 'Succeeded', batch: 'B-2026-10-STAT', dedup: '12 duplicate rows removed', items: [{ n: 'statistics_2026-10.zip', path: 's3://sceai-data/deliveries/statistics_2026-10.zip' }, { n: 'labour_force.csv', path: 'statistics_2026-10.zip › labour_force.csv' }, { n: 'prices.csv', path: 'statistics_2026-10.zip › prices.csv' }, { n: 'trade.csv', path: 'statistics_2026-10.zip › trade.csv' }], outDs: ['psa_labour_force_2026_10', 'psa_prices_2026_10', 'psa_trade_2026_10'], outDocs: [] },
      { id: 'R-0090', pipe: 'trade_dwh_extract', start: '1 d ago', st: 'Succeeded', dedup: '', items: [{ n: 'mart.vw_trade_quarterly', path: 'econdw · watermark load_ts' }], outDs: ['trade_flows_2026q3'], outDocs: [] },
      { id: 'R-0089', pipe: 'manual_uploads', start: '1 d ago', st: 'Succeeded', batch: 'U-1121', items: [{ n: 'Investment_Climate_Brief_2026.pdf', path: 'Upload batch U-1121' }, { n: 'fdi_inflows_h1_2026.csv', path: 'Upload batch U-1121' }], outDs: ['fdi_inflows_h1_2026'], outDocs: ['Investment_Climate_Brief_2026.pdf'] },
      { id: 'R-0087', pipe: 'indicators_csv_ingest', start: '6 h ago', st: 'Succeeded', dedup: '', items: [{ n: 'sceai_indicators_quarterly.csv', path: 's3://sceai-data/indicators/' }, { n: 'sceai_indicators_monthly.csv', path: 's3://sceai-data/indicators/' }, { n: 'sceai_indicators_annual.csv', path: 's3://sceai-data/indicators/' }], outDs: ['sceai_indicator_observations'], outDocs: [] },
      { id: 'R-0086', pipe: 'docs_docx_ingest', start: '1 d ago', st: 'Partially succeeded', items: [{ n: 'NDS2_Economic_Diversification.docx', path: 's3://sceai-data/documents/nds/' }, { n: 'SCEAI_Annual_Review_2024.docx', path: 's3://sceai-data/documents/nds/' }, { n: 'SCEAI_Annual_Review_draft.docx', path: 's3://sceai-data/documents/nds/drafts/' }, { n: 'NDS3_Consultation_scan.pdf', path: 's3://sceai-data/documents/nds/scans/' }], outDs: [], outDocs: ['NDS2_Economic_Diversification.docx', 'SCEAI_Annual_Review_2024.docx'] },
      { id: 'R-0480', pipe: 'articles_html_ingest', start: '30 min ago', st: 'Succeeded', items: [{ n: '/articles?updated_since=…', path: 'cms.sceai.gov.qa' }], outDs: [], outDocs: [] },
      { id: 'R-0085', pipe: 'finance_reports_sync', start: '5 d ago', st: 'Failed', items: [], outDs: [], outDocs: [] },
    ],
  },
  econ: {
    sources: [{ id: 'budget_reports_share', type: 'File repository', loc: 'SharePoint document library · https://mof.sharepoint.com/sites/circulars/Shared Documents' }],
    pipelines: [
      { id: 'circulars_sync', desc: 'Budget circulars.', src: 'budget_reports_share', uSteps: UNS, chunk: CH },
      { id: 'kpi_csv_ingest', desc: 'Directorate KPI file.', src: 'budget_reports_share', dsName: 'econ_indicator_observations', uSteps: [] },
    ],
    runs: [{ id: 'R-0058', pipe: 'kpi_csv_ingest', start: '1 d ago', st: 'Succeeded', items: [{ n: 'ea_kpis_2026.csv', path: 'KPIs/' }], outDs: ['econ_indicator_observations'], outDocs: [] }],
  },
  sandbox: {
    sources: [
      { id: 'sbx_bucket', type: 'S3', loc: 's3://sandbox-data · https://s3.kap.internal' },
      { id: 'sbx_mailbox', type: 'REST API', loc: 'https://graph.microsoft.com/v1.0' },
    ],
    pipelines: [
      { id: 'public_ingest', desc: 'Public test data and documents.', src: 'sbx_bucket', dsName: 'sandbox_indicator_observations', uSteps: UNS, chunk: CH },
      { id: 'confidential_reindex', desc: 'Re-indexes confidential documents.', src: 'sbx_bucket', uSteps: UNS, chunk: CH },
      { id: 'c001_upload', desc: 'Customer C001 agreement and transactions.', src: 'sbx_bucket', dsName: 'c001_transactions', uSteps: UNS_E, entTypes: ['Customer', 'Contract'], chunk: CH },
    ],
    runs: [
      { id: 'R-0112', pipe: 'confidential_reindex', start: '41 min ago', st: 'Running', items: [{ n: 'Model_Risk_Assessment.docx', path: 's3://sandbox-data/confidential/' }], outDs: [], outDocs: ['Model_Risk_Assessment.docx'] },
      { id: 'R-0011', pipe: 'c001_upload', start: '3 d ago', st: 'Succeeded', items: [{ n: 'C001_transactions_2026.csv', path: 's3://sandbox-data/customers/C001/' }, { n: 'C001_Service_Agreement.pdf', path: 's3://sandbox-data/customers/C001/' }], outDs: ['c001_transactions'], outDocs: ['C001_Service_Agreement.pdf'] },
    ],
  },
};

// ------------------------------------------------------------------ access policies on data (prototype iamPolOf / iamBlock)
/**
 * Access policies that apply to a resource key (`collection:x`, `dataset:x`,
 * `document:x`). A document's classification is its own attribute: the
 * Classification policy of that name applies to it wherever it is referenced.
 */
export function policiesOf(policies: IamPolicy[], documents: DhDocument[], t: TenantKey, key: string): IamPolicy[] {
  let cls = '';
  if (key.startsWith('document:')) cls = documents.find((x) => x.id === key.slice(9))?.cls ?? '';
  return policies.filter((p) => p.t === t && (cls && p.kind === 'Classification' ? p.n === cls : p.res.includes(key)));
}

/** Policies on `key` that the groups `gs` are not cleared by. */
export function blockingPolicies(policies: IamPolicy[], documents: DhDocument[], t: TenantKey, key: string, gs: string[]): IamPolicy[] {
  return policiesOf(policies, documents, t, key).filter((p) => !(p.cleared.includes('*') || p.cleared.some((x) => gs.includes(x))));
}
