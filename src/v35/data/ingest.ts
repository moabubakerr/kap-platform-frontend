/**
 * Data Ingestion Hub: per-tenant data sources, pipelines and runs (port of the
 * prototype's `ihInit`, design-ref-v35/app.js). `impl`: Implemented = supported
 * by the current backend; Planned = needs backend work (the console simulates it).
 *
 * `pub` mirrors the parts of the Business Data Hub that ingestion publishes to
 * (collections, dataset and document ids, ontology types) and `creds` the
 * tenant's managed credential names, so the hub works on its own.
 */
import { createStore } from '@/engine/store';

export type IngestTenantKey = 'sceai' | 'econ' | 'sandbox';
export const INGEST_TENANTS: IngestTenantKey[] = ['sceai', 'econ', 'sandbox'];
export const isIngestTenant = (t: string | null | undefined): t is IngestTenantKey => !!t && (INGEST_TENANTS as string[]).includes(t);

export type Impl = 'Implemented' | 'Planned';
export type SourceStatus = 'Connected' | 'Failed' | 'Not tested' | 'Disabled';

export interface Source {
  id: string;
  type: string;
  desc: string;
  cfg: Record<string, string>;
  auth: string;
  cred: string;
  ident?: string;
  st: SourceStatus;
  chk: string;
  err?: string;
  impl: Impl;
  /** discovered objects: [name, kind, detail] */
  browse: [string, string, string][];
  /** activity: [when, who, event] */
  act: [string, string, string][];
}

export interface PipeCfg {
  src: string;
  sel?: string;
  path?: string;
  pat?: string;
  rec?: string;
  zip?: string;
  which?: string;
  chg?: string;
  files?: string[];
  schema?: string;
  objs?: string[];
  query?: string;
  ext?: string;
  wm?: string;
  params?: string;
  page?: string;
  inc?: string;
  resp?: string;
  sSteps: string[];
  uSteps: string[];
  chunk?: string;
  entTypes?: string[];
  entConf?: string;
  dsName?: string;
  mode?: string;
  keys?: string;
  colls: string[];
  trig: string;
  sched?: string;
  ev?: string;
}

export interface Pipeline {
  id: string;
  on: boolean;
  impl: Impl;
  desc: string;
  v: PipeCfg;
}

export type RunStatus = 'Queued' | 'Running' | 'Succeeded' | 'Partially succeeded' | 'Failed' | 'Cancelled';

/** [stage, status, duration, processed, failed, summary] */
export type Stage = [string, string, string, number, number, string];

export interface RunItem {
  n: string;
  path: string;
  ty: string;
  size: string;
  res: string;
  err: string;
  retry: boolean;
  parent: string;
  /** simulation only: the result this item will have when the run finishes */
  want?: string;
}

export interface Batch {
  id: string;
  kind: string;
  inv: string;
  sum: string;
  ver: string;
}

export interface Run {
  id: string;
  pipe: string;
  trig: string;
  start: string;
  dur: string;
  st: RunStatus;
  inN: string;
  outN: string;
  errN: number;
  stages: Stage[];
  items: RunItem[];
  /** [time, level, message] */
  logs: [string, string, string][];
  outDs: string[];
  outDocs: string[];
  batch: Batch | null;
  retryOf?: string;
}

export interface PubRefs {
  colls: { id: string; ds: string[]; docs: string[] }[];
  datasets: string[];
  documents: string[];
}

export interface IngestTenant {
  sources: Source[];
  pipelines: Pipeline[];
  runs: Run[];
  pub: PubRefs;
  /** entity types of the tenant ontology (Business Entities) */
  onto: string[];
  /** managed credential names (Security & Credentials) */
  creds: string[];
}

export type IngestData = Record<IngestTenantKey, IngestTenant>;

const S3 = (id: string, desc: string, cfg: Record<string, string>, extra: Omit<Source, 'id' | 'type' | 'desc' | 'cfg'>): Source => ({ id, type: 'S3', desc, cfg, ...extra });
const it = (n: string, path: string, ty: string, size: string, res: string, err?: string, retry?: boolean, parent?: string): RunItem => ({ n, path, ty, size, res, err: err || '', retry: !!retry, parent: parent || '' });
const STR = ['Parse files', 'Schema detection and mapping', 'Validation', 'Normalization and deduplication', 'Load structured records'];
const UNS = ['File validation', 'Text extraction / OCR', 'Language detection and normalization', 'Chunking', 'Embedding generation', 'Vector indexing'];
const UNS_E = ['File validation', 'Text extraction / OCR', 'Language detection and normalization', 'Chunking', 'Entity and relationship extraction', 'Embedding generation', 'Vector indexing'];

export function ingestInit(): IngestData {
  return {
    sceai: {
      sources: [
        S3('sceai_bucket', 'SCEAI data bucket for indicator files, documents and deliveries.', { endpoint: 'https://s3.kap.internal', region: 'me-central-1', bucket: 'sceai-data', base: '/' }, { auth: 'Access key', cred: 'sceai_bucket_key', st: 'Connected', chk: '2 h ago', impl: 'Implemented', browse: [['indicators/', 'Folder', '3 objects'], ['documents/nds/', 'Folder', '16 objects'], ['deliveries/statistics_2026-10.zip', 'ZIP archive', '3.2 MB'], ['uploads/2026-11/', 'Folder', '2 objects']], act: [['2 h ago', 'System', 'Connection check succeeded (bucket listed)'], ['211 d ago', 'r.haddad', 'Created data source']] }),
        { id: 'sceai_cms_feed', type: 'REST API', desc: 'Published articles from the SCEAI website CMS.', cfg: { url: 'https://cms.sceai.gov.qa/api/v2', test: '/health', headers: 'Accept: application/json' }, auth: 'OAuth 2.0 client credentials', cred: 'sceai_cms_client', st: 'Connected', chk: '30 min ago', impl: 'Implemented', browse: [['/articles', 'Endpoint', 'GET · paged by cursor'], ['/articles/{id}', 'Endpoint', 'GET'], ['/categories', 'Endpoint', 'GET']], act: [['30 min ago', 'System', 'Connection check succeeded (HTTP 200)']] },
        { id: 'sceai_projects_db', type: 'Microsoft SQL Server', desc: 'Project management system database.', cfg: { server: 'sql-pm.sceai.internal', port: '1433', db: 'ProjectsDB', tls: 'Encrypt (TLS 1.2+), validate certificate' }, auth: 'SQL login', cred: 'projects_db_reader', st: 'Connected', chk: '3 h ago', impl: 'Planned', browse: [['dbo.Projects', 'Table', '46 rows'], ['dbo.Milestones', 'Table', '512 rows'], ['dbo.vw_ProjectProgress', 'View', '46 rows']], act: [['3 h ago', 'sceai_admin', 'Connection test succeeded'], ['5 d ago', 'sceai_admin', 'Created data source']] },
        { id: 'sceai_dwh', type: 'Data warehouse · Azure Synapse', desc: 'Economic data warehouse (dedicated SQL pool).', cfg: { endpoint: 'sceai-synapse.sql.azuresynapse.net', pool: 'econdw', schema: 'mart' }, auth: 'Microsoft Entra ID service principal', cred: 'synapse_sp_secret', st: 'Connected', chk: '1 d ago', impl: 'Planned', browse: [['mart.fact_trade', 'Table', '2.4M rows'], ['mart.dim_country', 'Table', '249 rows'], ['mart.vw_trade_quarterly', 'View', '48k rows'], ['trade_by_partner_q', 'Saved query', 'Reviewed by sceai_admin']], act: [['1 d ago', 'System', 'Scheduled run used the connection'], ['12 d ago', 'sceai_admin', 'Created data source']] },
        { id: 'finance_share', type: 'File repository', desc: 'Finance department report share.', cfg: { repo: 'SMB network share', path: '\\\\fs01.sceai.internal\\finance\\reports' }, auth: 'Service identity', cred: '', ident: 'svc-kap-ingest (Kerberos)', st: 'Failed', chk: '5 d ago', err: 'Access denied: svc-kap-ingest has no read permission on \\\\fs01.sceai.internal\\finance\\reports.', impl: 'Planned', browse: [], act: [['5 d ago', 'System', 'Connection check failed: access denied']] },
      ],
      pipelines: [
        { id: 'indicators_csv_ingest', on: true, impl: 'Implemented', desc: 'Loads indicator observation CSV files.', v: { src: 'sceai_bucket', sel: 'Folder / prefix', path: 'indicators/', pat: '*.csv', rec: 'No', zip: 'No', which: 'New or changed files only', chg: 'Object version / ETag', sSteps: STR, uSteps: [], dsName: 'sceai_indicator_observations', mode: 'Incremental update (upsert on keys)', keys: 'indicator_id, country, period, value_type', colls: ['sceai_indicators'], trig: 'Schedule', sched: 'Daily 02:00 AST', ev: '' } },
        { id: 'docs_docx_ingest', on: true, impl: 'Implemented', desc: 'Scans the NDS document folder and indexes PDF and DOCX files.', v: { src: 'sceai_bucket', sel: 'Folder / prefix', path: 'documents/nds/', pat: '*.pdf, *.docx', rec: 'Yes', zip: 'No', which: 'New or changed files only', chg: 'Object version / ETag', sSteps: [], uSteps: UNS_E, entTypes: ['Organization', 'Person', 'Project', 'Strategic Objective'], entConf: '0.70', chunk: 'By heading · 800 tokens · 100 overlap', colls: ['nds_planning_docs'], trig: 'Schedule', sched: 'Every 6 hours', ev: '' } },
        { id: 'statistics_zip_ingest', on: true, impl: 'Planned', desc: 'Extracts a monthly statistics delivery (ZIP of CSV files) into datasets.', v: { src: 'sceai_bucket', sel: 'Single file', path: 'deliveries/statistics_2026-10.zip', pat: '*.csv', rec: 'No', zip: 'Yes', which: 'All matching files', chg: 'Object version / ETag', sSteps: STR, uSteps: [], dsName: 'psa_{file}_2026_10', mode: 'Full refresh (replace)', keys: '', colls: [], trig: 'Manual only', sched: '', ev: '' } },
        { id: 'articles_html_ingest', on: true, impl: 'Implemented', desc: 'Pulls published articles from the CMS API.', v: { src: 'sceai_cms_feed', path: '/articles', params: 'lang=en,ar&status=published', page: 'Cursor / next link', inc: 'Since last run (updated_since parameter)', resp: 'Documents (unstructured)', sSteps: [], uSteps: ['File validation', 'Text extraction / OCR', 'Language detection and normalization', 'Chunking', 'Entity and relationship extraction', 'Embedding generation', 'Vector indexing'], entTypes: ['Organization', 'Person', 'Sector'], entConf: '0.70', chunk: 'By paragraph · 500 tokens · 50 overlap', colls: ['sceai_articles'], trig: 'Schedule', sched: 'Hourly', ev: '' } },
        { id: 'projects_sql_extract', on: true, impl: 'Planned', desc: 'Extracts projects and milestones from the project management database.', v: { src: 'sceai_projects_db', schema: 'dbo', objs: ['dbo.Projects', 'dbo.Milestones'], query: 'None', ext: 'Full refresh', wm: '', sSteps: ['Database extraction', 'Schema detection and mapping', 'Validation', 'Load structured records'], uSteps: [], dsName: 'pm_{table}', mode: 'Full refresh (replace)', keys: '', colls: [], trig: 'Manual only', sched: '', ev: '' } },
        { id: 'trade_dwh_extract', on: true, impl: 'Planned', desc: 'Weekly incremental extract of quarterly trade flows from the warehouse.', v: { src: 'sceai_dwh', schema: 'mart', objs: ['mart.vw_trade_quarterly'], query: 'None', ext: 'Incremental (watermark column)', wm: 'load_ts', sSteps: ['Database extraction', 'Validation', 'Normalization and deduplication', 'Load structured records'], uSteps: [], dsName: 'trade_flows_2026q3', mode: 'Incremental update (upsert on keys)', keys: 'partner_country, hs_section, flow, quarter', colls: [], trig: 'Schedule', sched: 'Weekly Sunday 03:00 AST', ev: '' } },
        { id: 'manual_uploads', on: true, impl: 'Planned', desc: 'Files uploaded by administrators; routed by file type.', v: { src: 'manual', files: ['Investment_Climate_Brief_2026.pdf', 'fdi_inflows_h1_2026.csv'], zip: 'No', sSteps: STR, uSteps: UNS, chunk: 'By heading · 800 tokens · 100 overlap', dsName: '{file}', mode: 'Full refresh (replace)', keys: '', colls: [], trig: 'On upload', sched: '', ev: '' } },
        { id: 'finance_reports_sync', on: false, impl: 'Planned', desc: 'Finance reports from the network share (disabled until access is granted).', v: { src: 'finance_share', sel: 'Folder / prefix', path: 'monthly\\', pat: '*.pdf', rec: 'Yes', zip: 'No', which: 'New or changed files only', chg: 'Last-modified timestamp', sSteps: [], uSteps: UNS, chunk: 'By heading · 800 tokens · 100 overlap', colls: [], trig: 'Schedule', sched: 'Daily 02:00 AST', ev: '' } },
      ],
      runs: [
        { id: 'R-0093', pipe: 'projects_sql_extract', trig: 'Manual · sceai_admin', start: '3 h ago', dur: '48 s', st: 'Succeeded', inN: '2 tables', outN: '558 records', errN: 0,
          stages: [['Database extraction', 'Succeeded', '31 s', 558, 0, ''], ['Schema detection and mapping', 'Succeeded', '4 s', 558, 0, ''], ['Validation', 'Succeeded', '6 s', 558, 0, ''], ['Load structured records', 'Succeeded', '7 s', 558, 0, '']],
          items: [it('dbo.Projects', 'ProjectsDB · full table', 'Table', '46 rows', 'Succeeded'), it('dbo.Milestones', 'ProjectsDB · full table', 'Table', '512 rows · 2 batches', 'Succeeded')], logs: [['10:02:11', 'INFO', 'Connected to sql-pm.sceai.internal:1433 (TLS 1.3)'], ['10:02:42', 'INFO', 'Extracted dbo.Milestones in 2 batches of 500'], ['10:02:59', 'INFO', 'Loaded pm_projects (46) and pm_milestones (512)']], outDs: ['pm_projects', 'pm_milestones'], outDocs: [], batch: null },
        { id: 'R-0091', pipe: 'statistics_zip_ingest', trig: 'Manual · sceai_admin', start: '2 h ago', dur: '1 min 12 s', st: 'Succeeded', inN: '1 archive · 3 files', outN: '3 datasets · 9,412 records', errN: 0,
          stages: [['Archive extraction', 'Succeeded', '3 s', 3, 0, ''], ['Parse files', 'Succeeded', '22 s', 3, 0, ''], ['Schema detection and mapping', 'Succeeded', '9 s', 3, 0, ''], ['Validation', 'Succeeded', '14 s', 9412, 0, ''], ['Normalization and deduplication', 'Succeeded', '11 s', 9412, 0, '12 duplicate rows removed'], ['Load structured records', 'Succeeded', '13 s', 9412, 0, '']],
          items: [it('statistics_2026-10.zip', 's3://sceai-data/deliveries/statistics_2026-10.zip', 'ZIP archive', '3.2 MB', 'Succeeded'), it('labour_force.csv', 'statistics_2026-10.zip › labour_force.csv', 'CSV', '1.1 MB', 'Succeeded', '', false, 'statistics_2026-10.zip'), it('prices.csv', 'statistics_2026-10.zip › prices.csv', 'CSV', '0.9 MB', 'Succeeded', '', false, 'statistics_2026-10.zip'), it('trade.csv', 'statistics_2026-10.zip › trade.csv', 'CSV', '1.6 MB', 'Succeeded', '', false, 'statistics_2026-10.zip')],
          logs: [['08:14:02', 'INFO', 'Downloaded statistics_2026-10.zip (sha256 9f2c…a41e)'], ['08:14:05', 'INFO', 'Extracted 3 files'], ['08:14:49', 'WARN', 'prices.csv: 12 duplicate rows removed'], ['08:15:14', 'INFO', 'Published 3 datasets']], outDs: ['psa_labour_force_2026_10', 'psa_prices_2026_10', 'psa_trade_2026_10'], outDocs: [],
          batch: { id: 'B-2026-10-STAT', kind: 'Versioned delivery (ZIP archive)', inv: 'statistics_2026-10.zip → labour_force.csv, prices.csv, trade.csv', sum: 'sha256 9f2c…a41e', ver: 'Delivery 2026-10 · S3 version 3' } },
        { id: 'R-0090', pipe: 'trade_dwh_extract', trig: 'Schedule', start: '1 d ago', dur: '2 min 40 s', st: 'Succeeded', inN: '1 view · 12,480 new or changed rows', outN: '12,480 records', errN: 0,
          stages: [['Database extraction', 'Succeeded', '1 min 52 s', 12480, 0, 'Watermark load_ts > 2026-11-16 03:00'], ['Validation', 'Succeeded', '21 s', 12480, 0, ''], ['Normalization and deduplication', 'Succeeded', '14 s', 12480, 0, ''], ['Load structured records', 'Succeeded', '13 s', 12480, 0, 'Upsert on partner_country, hs_section, flow, quarter']],
          items: [it('mart.vw_trade_quarterly', 'econdw · watermark load_ts', 'View', '12,480 rows · 25 batches', 'Succeeded')], logs: [['03:00:02', 'INFO', 'Watermark: load_ts > 2026-11-16 03:00:00'], ['03:02:40', 'INFO', 'New watermark 2026-11-23 02:58:11']], outDs: ['trade_flows_2026q3'], outDocs: [], batch: null },
        { id: 'R-0089', pipe: 'manual_uploads', trig: 'Upload · sceai_admin', start: '1 d ago', dur: '1 min 05 s', st: 'Succeeded', inN: '2 files', outN: '1 dataset · 1 document', errN: 0,
          stages: [['Route by file type', 'Succeeded', '1 s', 2, 0, '1 structured · 1 unstructured'], ['Parse files', 'Succeeded', '3 s', 1, 0, ''], ['Load structured records', 'Succeeded', '4 s', 1, 0, ''], ['Text extraction / OCR', 'Succeeded', '19 s', 1, 0, ''], ['Chunking', 'Succeeded', '2 s', 31, 0, ''], ['Embedding generation', 'Succeeded', '28 s', 31, 0, ''], ['Vector indexing', 'Succeeded', '8 s', 31, 0, '']],
          items: [it('Investment_Climate_Brief_2026.pdf', 'Upload batch U-1121', 'PDF', '2.4 MB', 'Succeeded'), it('fdi_inflows_h1_2026.csv', 'Upload batch U-1121', 'CSV', '84 KB', 'Succeeded')], logs: [['14:20:10', 'INFO', 'Received 2 files from sceai_admin'], ['14:21:15', 'INFO', 'Published fdi_inflows_h1_2026 and Investment_Climate_Brief_2026.pdf']], outDs: ['fdi_inflows_h1_2026'], outDocs: ['Investment_Climate_Brief_2026.pdf'],
          batch: { id: 'U-1121', kind: 'Manual upload batch', inv: 'Investment_Climate_Brief_2026.pdf, fdi_inflows_h1_2026.csv', sum: '2 checksums recorded', ver: 'Upload 1' } },
        { id: 'R-0087', pipe: 'indicators_csv_ingest', trig: 'Schedule', start: '6 h ago', dur: '3 min 18 s', st: 'Succeeded', inN: '3 changed files', outN: '8,104 records (214 updated)', errN: 0,
          stages: [['Parse files', 'Succeeded', '14 s', 3, 0, ''], ['Schema detection and mapping', 'Succeeded', '6 s', 8104, 0, ''], ['Validation', 'Succeeded', '41 s', 8104, 0, ''], ['Normalization and deduplication', 'Succeeded', '22 s', 8104, 0, ''], ['Load structured records', 'Succeeded', '1 min 55 s', 8104, 0, '214 updated · 0 inserted']],
          items: [it('sceai_indicators_quarterly.csv', 's3://sceai-data/indicators/', 'CSV', '412 KB', 'Succeeded'), it('sceai_indicators_monthly.csv', 's3://sceai-data/indicators/', 'CSV', '806 KB', 'Succeeded'), it('sceai_indicators_annual.csv', 's3://sceai-data/indicators/', 'CSV', '151 KB', 'Succeeded')], logs: [['02:00:01', 'INFO', '3 objects changed since last run (ETag)'], ['02:03:19', 'INFO', 'Upserted 214 observations']], outDs: ['sceai_indicator_observations'], outDocs: [], batch: null },
        { id: 'R-0086', pipe: 'docs_docx_ingest', trig: 'Schedule', start: '1 d ago', dur: '6 min 02 s', st: 'Partially succeeded', inN: '4 new or changed files', outN: '2 documents', errN: 2,
          stages: [['File validation', 'Succeeded', '2 s', 4, 0, ''], ['Text extraction / OCR', 'Partially succeeded', '3 min 40 s', 2, 2, '1 password-protected · 1 OCR timeout'], ['Language detection and normalization', 'Succeeded', '6 s', 2, 0, ''], ['Chunking', 'Succeeded', '4 s', 238, 0, ''], ['Entity and relationship extraction', 'Succeeded', '1 min 10 s', 13, 0, '312 entities · 147 relationships'], ['Embedding generation', 'Succeeded', '1 min 51 s', 238, 0, ''], ['Vector indexing', 'Succeeded', '19 s', 238, 0, '']],
          items: [it('NDS2_Economic_Diversification.docx', 's3://sceai-data/documents/nds/', 'DOCX', '1.8 MB', 'Succeeded'), it('SCEAI_Annual_Review_2024.docx', 's3://sceai-data/documents/nds/', 'DOCX', '3.1 MB', 'Succeeded'), it('SCEAI_Annual_Review_draft.docx', 's3://sceai-data/documents/nds/drafts/', 'DOCX', '2.9 MB', 'Failed', 'The file is password-protected. Remove the password at the source and upload it again.', false), it('NDS3_Consultation_scan.pdf', 's3://sceai-data/documents/nds/scans/', 'PDF (scanned)', '18.4 MB', 'Failed', 'OCR timed out after 180 s on page 41 of 77.', true)],
          logs: [['08:00:01', 'INFO', '4 objects new or changed (ETag)'], ['08:01:12', 'ERROR', 'SCEAI_Annual_Review_draft.docx: encrypted document (password-protected)'], ['08:03:41', 'ERROR', 'NDS3_Consultation_scan.pdf: OCR timeout on page 41'], ['08:06:03', 'INFO', 'Indexed 238 chunks from 2 documents']], outDs: [], outDocs: ['NDS2_Economic_Diversification.docx', 'SCEAI_Annual_Review_2024.docx'], batch: null },
        { id: 'R-0480', pipe: 'articles_html_ingest', trig: 'Schedule', start: '30 min ago', dur: '9 s', st: 'Succeeded', inN: '0 changed articles', outN: 'No changes', errN: 0, stages: [['API request', 'Succeeded', '2 s', 1, 0, 'updated_since 2026-11-23 23:00'], ['Vector indexing', 'Succeeded', '0 s', 0, 0, 'Nothing to index']], items: [it('/articles?updated_since=…', 'cms.sceai.gov.qa', 'API page', '1 page', 'Succeeded')], logs: [['23:30:00', 'INFO', 'No new or updated articles']], outDs: [], outDocs: [], batch: null },
        { id: 'R-0085', pipe: 'finance_reports_sync', trig: 'Schedule', start: '5 d ago', dur: '4 s', st: 'Failed', inN: '—', outN: '—', errN: 1, stages: [['List files', 'Failed', '4 s', 0, 1, 'Access denied']], items: [], logs: [['02:00:04', 'ERROR', 'Access denied: \\\\fs01.sceai.internal\\finance\\reports']], outDs: [], outDocs: [], batch: null },
      ],
      pub: {
        colls: [
          { id: 'sceai_indicators', ds: ['sceai_indicator_observations', 'sceai_indicator_definitions', 'sceai_strategy_targets'], docs: [] },
          { id: 'sceai_articles', ds: [], docs: ['article_2026-11-12_tourism.html', 'article_2026-11-05_inflation_ar.html'] },
          { id: 'nds_planning_docs', ds: [], docs: ['NDS2_Economic_Diversification.docx', 'SCEAI_Annual_Review_2024.docx', 'SCEAI_Annual_Review_draft.docx'] },
        ],
        datasets: ['sceai_indicator_observations', 'sceai_indicator_definitions', 'sceai_strategy_targets', 'trade_flows_2026q3', 'psa_labour_force_2026_10', 'psa_prices_2026_10', 'psa_trade_2026_10', 'pm_projects', 'pm_milestones', 'fdi_inflows_h1_2026'],
        documents: ['NDS2_Economic_Diversification.docx', 'SCEAI_Annual_Review_2024.docx', 'SCEAI_Annual_Review_draft.docx', 'article_2026-11-12_tourism.html', 'article_2026-11-05_inflation_ar.html', 'Investment_Climate_Brief_2026.pdf'],
      },
      onto: ['Organization', 'Person', 'Sector', 'Project', 'Strategic Objective', 'Indicator'],
      creds: ['sceai_bucket_key', 'oxford_api_key', 'callback_hmac', 'sceai_dwh_reader', 'sceai_cms_client', 'projects_db_reader', 'synapse_sp_secret'],
    },
    econ: {
      sources: [{ id: 'budget_reports_share', type: 'File repository', desc: 'Budget circulars shared by the Ministry of Finance.', cfg: { repo: 'SharePoint document library', path: 'https://mof.sharepoint.com/sites/circulars/Shared Documents' }, auth: 'Microsoft Entra ID application', cred: 'budget_share_secret', st: 'Connected', chk: '5 h ago', impl: 'Implemented', browse: [['Circulars 2026/', 'Folder', '48 files'], ['KPIs/', 'Folder', '1 file']], act: [['5 h ago', 'System', 'Connection check succeeded']] }],
      pipelines: [
        { id: 'circulars_sync', on: true, impl: 'Implemented', desc: 'Budget circulars.', v: { src: 'budget_reports_share', sel: 'Folder / prefix', path: 'Circulars 2026/', pat: '*.pdf', rec: 'No', zip: 'No', which: 'New or changed files only', chg: 'Last-modified timestamp', sSteps: [], uSteps: UNS, chunk: 'By heading · 800 tokens · 100 overlap', colls: ['budget_reports'], trig: 'Schedule', sched: 'Daily 02:00 AST', ev: '' } },
        { id: 'kpi_csv_ingest', on: true, impl: 'Implemented', desc: 'Directorate KPI file.', v: { src: 'budget_reports_share', sel: 'Single file', path: 'KPIs/ea_kpis_2026.csv', pat: '*.csv', rec: 'No', zip: 'No', which: 'New or changed files only', chg: 'Last-modified timestamp', sSteps: STR, uSteps: [], dsName: 'econ_indicator_observations', mode: 'Incremental update (upsert on keys)', keys: 'indicator_id, period', colls: ['econ_indicators'], trig: 'Schedule', sched: 'Daily 02:00 AST', ev: '' } },
      ],
      runs: [{ id: 'R-0058', pipe: 'kpi_csv_ingest', trig: 'Schedule', start: '1 d ago', dur: '22 s', st: 'Succeeded', inN: '1 file', outN: '1,240 records', errN: 0, stages: [['Parse files', 'Succeeded', '3 s', 1, 0, ''], ['Load structured records', 'Succeeded', '9 s', 1240, 0, '']], items: [it('ea_kpis_2026.csv', 'KPIs/', 'CSV', '96 KB', 'Succeeded')], logs: [['02:00:22', 'INFO', 'Loaded 1,240 records']], outDs: ['econ_indicator_observations'], outDocs: [], batch: null }],
      pub: {
        colls: [
          { id: 'econ_indicators', ds: ['econ_indicator_observations'], docs: [] },
          { id: 'budget_reports', ds: [], docs: ['Budget_Circular_2026-07.pdf'] },
        ],
        datasets: ['econ_indicator_observations'],
        documents: ['Budget_Circular_2026-07.pdf'],
      },
      onto: ['Directorate', 'Budget Program'],
      creds: ['budget_share_secret'],
    },
    sandbox: {
      sources: [
        S3('sbx_bucket', 'AI team bucket.', { endpoint: 'https://s3.kap.internal', region: 'me-central-1', bucket: 'sandbox-data', base: '/' }, { auth: 'Access key', cred: 'sbx_bucket_key', st: 'Connected', chk: '1 d ago', impl: 'Implemented', browse: [['public/', 'Folder', '6 objects'], ['confidential/', 'Folder', '3 objects'], ['customers/C001/', 'Folder', '2 objects']], act: [['1 d ago', 'System', 'Connection check succeeded']] }),
        { id: 'sbx_mailbox', type: 'REST API', desc: 'Microsoft Graph access to the C001 correspondence mailbox.', cfg: { url: 'https://graph.microsoft.com/v1.0', test: '/me', headers: '' }, auth: 'Microsoft Entra ID application', cred: 'sbx_graph_secret', st: 'Connected', chk: '1 d ago', impl: 'Planned', browse: [['/users/c001-desk/messages', 'Endpoint', 'GET · paged']], act: [['1 d ago', 'System', 'Connection check succeeded']] },
      ],
      pipelines: [
        { id: 'public_ingest', on: true, impl: 'Implemented', desc: 'Public test data and documents.', v: { src: 'sbx_bucket', sel: 'Folder / prefix', path: 'public/', pat: '*.csv, *.pdf', rec: 'No', zip: 'No', which: 'New or changed files only', chg: 'Object version / ETag', sSteps: STR, uSteps: UNS, chunk: 'By heading · 800 tokens · 100 overlap', dsName: 'sandbox_indicator_observations', mode: 'Full refresh (replace)', keys: '', colls: ['sandbox_indicators', 'sandbox_public_docs'], trig: 'Manual only', sched: '', ev: '' } },
        { id: 'confidential_reindex', on: true, impl: 'Implemented', desc: 'Re-indexes confidential documents.', v: { src: 'sbx_bucket', sel: 'Folder / prefix', path: 'confidential/', pat: '*.docx', rec: 'No', zip: 'No', which: 'All matching files', chg: 'Object version / ETag', sSteps: [], uSteps: UNS, chunk: 'By heading · 800 tokens · 100 overlap', colls: ['sandbox_confidential_docs'], trig: 'Schedule', sched: 'Daily 22:00 AST', ev: '' } },
        { id: 'c001_upload', on: true, impl: 'Planned', desc: 'Customer C001 agreement and transactions.', v: { src: 'sbx_bucket', sel: 'Folder / prefix', path: 'customers/C001/', pat: '*.csv, *.pdf', rec: 'No', zip: 'No', which: 'New or changed files only', chg: 'Object version / ETag', sSteps: STR, uSteps: UNS_E, entTypes: ['Customer', 'Contract'], entConf: '0.80', chunk: 'By heading · 800 tokens · 100 overlap', dsName: 'c001_transactions', mode: 'Incremental update (upsert on keys)', keys: 'txn_id', colls: ['customer_c001'], trig: 'Manual only', sched: '', ev: '' } },
      ],
      runs: [
        { id: 'R-0112', pipe: 'confidential_reindex', trig: 'Schedule', start: '41 min ago', dur: '41 min (running)', st: 'Running', inN: '3 files', outN: '—', errN: 0, stages: [['Text extraction / OCR', 'Succeeded', '2 min', 3, 0, ''], ['Embedding generation', 'Running', '39 min', 63, 0, 'Progress 63%']], items: [it('Model_Risk_Assessment.docx', 's3://sandbox-data/confidential/', 'DOCX', '1.2 MB', 'Running')], logs: [['21:40:00', 'INFO', 'Re-index started'], ['22:19:00', 'WARN', 'Embedding throughput below expected']], outDs: [], outDocs: ['Model_Risk_Assessment.docx'], batch: null },
        { id: 'R-0011', pipe: 'c001_upload', trig: 'Manual · r.haddad', start: '3 d ago', dur: '58 s', st: 'Succeeded', inN: '2 files', outN: '1 dataset · 1 document', errN: 0, stages: [['Route by file type', 'Succeeded', '1 s', 2, 0, ''], ['Load structured records', 'Succeeded', '9 s', 1836, 0, ''], ['Vector indexing', 'Succeeded', '6 s', 28, 0, '']], items: [it('C001_transactions_2026.csv', 's3://sandbox-data/customers/C001/', 'CSV', '210 KB', 'Succeeded'), it('C001_Service_Agreement.pdf', 's3://sandbox-data/customers/C001/', 'PDF', '1.4 MB', 'Succeeded')], logs: [['11:03:58', 'INFO', 'Published c001_transactions and C001_Service_Agreement.pdf']], outDs: ['c001_transactions'], outDocs: ['C001_Service_Agreement.pdf'], batch: null },
      ],
      pub: {
        colls: [
          { id: 'sandbox_indicators', ds: ['sandbox_indicator_observations'], docs: [] },
          { id: 'sandbox_public_docs', ds: [], docs: ['Open_Data_Guide.pdf'] },
          { id: 'sandbox_confidential_docs', ds: [], docs: ['Model_Risk_Assessment.docx'] },
          { id: 'customer_c001', ds: ['c001_transactions'], docs: ['C001_Service_Agreement.pdf', 'C001_Correspondence_2026.eml'] },
        ],
        datasets: ['sandbox_indicator_observations', 'c001_transactions'],
        documents: ['Open_Data_Guide.pdf', 'Model_Risk_Assessment.docx', 'C001_Service_Agreement.pdf', 'C001_Correspondence_2026.eml'],
      },
      onto: ['Customer', 'Contract', 'Account'],
      creds: ['sbx_bucket_key', 'sbx_graph_secret'],
    },
  };
}

/** Session store: create/edit/test/run actions change it like the prototype's `st.ih`. */
export const ingestStore = createStore(ingestInit);
