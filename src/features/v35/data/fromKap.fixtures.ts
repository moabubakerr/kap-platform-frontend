/** Test fixtures shaped from KAP's OpenAPI schemas (CollectionOut, PipelineOut, FileListItem, FileVersionOut, IndicatorObservationOut, EntityTypeOut, AgentOut). */
import { emptyCache, obsKey, type KapCache, type KapCollection, type KapEntityType, type KapFile, type KapObservation, type KapPipeline } from './fromKap';

export const NOW = Date.parse('2026-11-24T12:00:00Z');
export const kColl = (name: string, pipeline: string, o: Partial<KapCollection> = {}): KapCollection => ({
  id: `c-${name}`, name, pipeline_ref: pipeline, connectors: ['sbx_bucket'], sync_strategy: 'unique_name', entity: { enabled: false }, task_priority: null, max_in_flight_tasks: null,
  created_at: '2026-10-01T08:00:00Z', updated_at: '2026-11-20T08:00:00Z', ...o,
});
export const kPipe = (name: string, kind: KapPipeline['kind'], o: Partial<KapPipeline> = {}): KapPipeline => ({ id: `p-${name}`, name, kind, mode: kind === 'indicators' ? 'delta' : null, embedding_model_ref: 'embed_default', stages: [{ name: 'parse', type: 'parser' }, { name: 'embed', type: 'embedding' }], is_active: true, ...o });
export const kFile = (id: string, coll: string, name: string, o: Partial<KapFile> = {}): KapFile => ({
  id, collection_id: `c-${coll}`, connector_id: 'k-1', name, source_path: `/docs/${name}`, state: 'activated', file_type: name.split('.').pop()!, size_bytes: 2048, current_version_number: 2, version_count: 2,
  content_changed_at: '2026-11-22T10:00:00Z', processing_started_at: null, created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-22T10:05:00Z', ...o,
});
export const kObs = (id: string, o: Partial<KapObservation> = {}): KapObservation => ({
  id, indicator: { external_id: 'TST-001', name_en: 'Test growth', name_ar: null, unit: '%', frequency: 'Q', source: 'public_open_data' }, period_type: 'quarter', period_start: '2026-04-01', dimension: 'Qatar',
  value: '3.1', status: 'valid', issues: [], source_file: 'observations_2026.csv', source_row: 12, updated_at: '2026-11-23T12:00:00Z', ...o,
});
export const kType = (name: string, schema: Record<string, unknown>): KapEntityType => ({ id: `e-${name}`, name, description: `${name} entities`, schema, created_at: '2026-09-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z' });

export function fixtureCache(): KapCache {
  const c = emptyCache();
  c.loaded = true;
  c.collections = [kColl('sandbox_indicators', 'indicator_pipeline'), kColl('sandbox_docs', 'docs_pipeline', { connectors: ['sbx_bucket', 'sbx_mail'], entity: { enabled: true, entity_type_ref: 'Customer', boundary: { strategy: 'folder' } } })];
  c.pipelines = [kPipe('indicator_pipeline', 'indicators', { stages: [{ name: 'load_csv', type: 'csv_loader' }] }), kPipe('docs_pipeline', 'document')];
  c.connectors = [{ id: 'k-1', name: 'sbx_bucket', type: 's3' }, { id: 'k-2', name: 'sbx_mail', type: 'imap' }];
  c.agents = [{ id: 'a-1', name: 'sandbox_indicators_agent', collections: ['sandbox_indicators'] }, { id: 'a-2', name: 'sbx_research_agent', collections: ['sandbox_indicators', 'sandbox_docs'] }];
  c.entityTypes = [kType('Customer', { type: 'object', properties: { customer_id: { type: 'string', description: 'C###' }, since: { type: 'string', format: 'date' }, segment: { enum: ['SME', 'Corporate'] }, revenue: { type: 'number' } }, required: ['customer_id'] })];
  c.fileTotal = { 'c-sandbox_docs': 3 };
  c.fileStates = { 'c-sandbox_docs': { failed: 1, busy: 0 } };
  c.obsTotal = { 'c-sandbox_indicators': { total: 520, review: 3 } };
  c.files = {
    f1: kFile('f1', 'sandbox_docs', 'Guide.pdf'),
    f2: kFile('f2', 'sandbox_docs', 'Broken.docx', { state: 'failed_parse', current_version_number: null, version_count: 0 }),
    f3: kFile('f3', 'sandbox_indicators', 'observations_2026.csv', { state: 'loaded', current_version_number: 4 }),
  };
  c.versions = { f1: [{ id: 'v1', version_number: 1, content_sha256: 'aa', size_bytes: 1000, is_current: false, processed_at: '2026-11-02T00:00:00Z', created_at: '2026-11-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z' }, { id: 'v2', version_number: 2, content_sha256: 'bb', size_bytes: 2048, is_current: true, processed_at: null, created_at: '2026-11-22T10:00:00Z', updated_at: '2026-11-22T10:00:00Z' }] };
  c.obs = { 'c-sandbox_indicators': { [obsKey('', 0)]: { items: [kObs('o1'), kObs('o2', { status: 'needs_review', value: null, issues: ['value out of range'], period_type: 'month', period_start: '2026-09-01' })], total: 520 } } };
  return c;
}

