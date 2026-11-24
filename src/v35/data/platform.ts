/**
 * Platform layer data (session): Model Providers Registry, MCP Registry,
 * tenants, Platform Overview and the tenant dashboards. Ported from the
 * prototype (design-ref-v35/app.js): `regInit` / `mrefInit` / `modelTypes` /
 * `modelCatalog` / `simTests` / `secretsInit` (946–1019), `mcpInit` (4324),
 * `platformOps` (1266), `opsData` alerts (1485), `telemetry` (1543),
 * `overview` (61) and the `more()` dashboard values (548–591).
 *
 * The registry also holds the tenant model defaults (`tDef`), so the tenant
 * "Models" settings and the registry stay consistent, as in the prototype.
 */
import { createStore } from '@/engine/store';

export type TKey = 'sceai' | 'econ' | 'sandbox';
export const TKEYS: TKey[] = ['sceai', 'econ', 'sandbox'];
export const TN: Record<TKey, string> = { sceai: 'SCEAI', econ: 'Economic Affairs', sandbox: 'sandbox' };
export const isTKey = (t: string | null | undefined): t is TKey => !!t && (TKEYS as string[]).includes(t);

// ====================================================================== model registry

export type Health = 'Healthy' | 'Degraded' | 'Failing' | 'Not checked';

export interface Conn {
  id: string;
  n: string;
  type: string;
  ep: string;
  region: string;
  apiver: string;
  auth: string;
  secret: string;
  tls: string;
  timeout: string;
  status: 'Enabled' | 'Disabled';
  health: Health;
  lastOk: string;
  errors: string;
  req: string;
  lat: string;
  util: string;
  by: string;
}

export interface Kill { by: string; at: string; reason: string; ref: string }

export interface Dep {
  id: string;
  type?: string;
  did: string;
  conn: string;
  model: string;
  vendor?: string;
  contract?: string;
  cat: string;
  caps: string[];
  ctx?: string;
  maxOut?: string;
  dims: string;
  params?: Record<string, any>;
  limit: string;
  serving: string;
  status: 'Active' | 'Disabled';
  health: Health;
  lastOk: string;
  errors: string;
  req: string;
  lat: string;
  util: string;
  all: boolean;
  ten: TKey[];
  tpm?: string;
  conc?: string;
  reserve?: string;
  peak?: string;
  verified?: string[];
  kill?: Kill;
}

export type Role = 'agent' | 'chat' | 'embed';
export const ROLES: Role[] = ['agent', 'chat', 'embed'];
export const ROLE: Record<Role, [string, string]> = { agent: ['Default agent model', 'Tool calling'], chat: ['Default chat model', 'Chat'], embed: ['Default embedding model', 'Embeddings'] };

/** [tenant, kind, name, model id or 'default:<role>'] */
export type MRef = [TKey, string, string, string];

export interface Registry {
  conns: Conn[];
  deps: Dep[];
  /** tenant model defaults */
  tDef: Record<TKey, Record<Role, string>>;
  /** model references across the console (agents, collections, pipelines) */
  mref: MRef[];
}

const LIM: Record<string, [string, string, string, string]> = { 'qwen72b-prod': ['400k', '32', '30', '81%'], 'qwen32b-prod': ['600k', '48', '25', '44%'], 'qwen14b-shared': ['300k', '32', '25', '18%'], 'qwen7b-router': ['300k', '48', '20', '35%'], 'embed-prod': ['2M', '64', '20', '12%'], 'bge-m3-match': ['1M', '64', '20', '22%'], 'gpt4o-sandbox': ['150k', '', '30', '34%'], 'partner-llama70b': ['60k', '8', '0', '—'], 'asr-whisper': ['', '8', '0', '21%'] };

type DepIn = Omit<Dep, 'verified' | 'tpm' | 'conc' | 'reserve' | 'peak'>;
const fin = (deps: DepIn[]): Dep[] =>
  deps.map((d) => {
    const l = LIM[d.id];
    const o: Dep = { ...d };
    if (l) [o.tpm, o.conc, o.reserve, o.peak] = l;
    o.verified = d.health === 'Healthy' ? d.caps.slice() : [];
    return o;
  });

export function registryInit(): Registry {
  return {
    conns: [
      { id: 'c1', n: 'Internal vLLM Cluster', type: 'vLLM (self-hosted)', ep: 'https://vllm.kap.internal/v1', region: 'On-premise · DC1', apiver: '', auth: 'mTLS client certificate', secret: 'secret/platform/kap/vllm_client_cert', tls: 'Internal CA · kap-ca', timeout: '30', status: 'Enabled', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '2,940 / 24 h', lat: 'p95 1.8 s', util: '62% GPU capacity · gpu-01 … gpu-04', by: 'kap.ops · 211 d ago' },
      { id: 'c2', n: 'Azure OpenAI — UAE North', type: 'Azure OpenAI', ep: 'https://kap-uaen.openai.azure.com', region: 'UAE North', apiver: '2024-10-21', auth: 'Microsoft Entra ID (managed identity)', secret: '', tls: 'Public CA', timeout: '60', status: 'Enabled', health: 'Healthy', lastOk: '4 min ago', errors: '0 in 24 h', req: '310 / 24 h', lat: 'p95 2.4 s', util: '34% of 150k TPM quota', by: 'kap.ops · 30 d ago' },
      { id: 'c3', n: 'Partner LLM API', type: 'OpenAI-compatible API', ep: 'https://api.partner-llm.example/v1', region: '', apiver: '', auth: 'API key', secret: 'secret/platform/kap/partner_llm_key', tls: 'Public CA', timeout: '30', status: 'Enabled', health: 'Failing', lastOk: '6 d ago', errors: '14 TLS timeouts in 24 h', req: '0 / 24 h', lat: '—', util: '—', by: 'kap.ops · 12 d ago' },
      { id: 'c4', n: 'KAP Speech Gateway', type: 'REST API', ep: 'https://speech-gw.kap.internal/v1', region: 'On-premise · DC1', apiver: '', auth: 'Bearer token', secret: 'secret/platform/kap/speech_gw_token', tls: 'Internal CA · kap-ca', timeout: '120', status: 'Enabled', health: 'Healthy', lastOk: '3 min ago', errors: '0 in 24 h', req: '44 / 24 h', lat: 'p95 3.8 s', util: '21% GPU', by: 'kap.ops · 9 d ago' },
    ],
    deps: fin([
      { id: 'qwen72b-prod', did: 'Qwen/Qwen2.5-72B-Instruct', conn: 'c1', model: 'Qwen2.5-72B-Instruct', cat: 'LLM', caps: ['Chat', 'Tool calling', 'Structured output'], ctx: '32,768', maxOut: '8,192', dims: '', limit: '16 concurrent sequences', serving: 'gpu-01, gpu-02 · 2 × A100 80 GB', status: 'Active', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '38 req/min', lat: 'p95 2.1 s', util: '71% GPU', all: false, ten: ['sceai', 'econ'] },
      { id: 'qwen32b-prod', did: 'Qwen/Qwen2.5-32B-Instruct', conn: 'c1', model: 'Qwen2.5-32B-Instruct', cat: 'LLM', caps: ['Chat', 'Tool calling', 'Structured output'], ctx: '32,768', maxOut: '8,192', dims: '', limit: '24 concurrent sequences', serving: 'gpu-03 · 1 × A100 80 GB', status: 'Active', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '24 req/min', lat: 'p95 1.4 s', util: '55% GPU', all: false, ten: ['sceai', 'econ', 'sandbox'] },
      { id: 'qwen14b-shared', did: 'Qwen/Qwen2.5-14B-Instruct', conn: 'c1', model: 'Qwen2.5-14B-Instruct', cat: 'LLM', caps: ['Chat', 'Structured output'], ctx: '32,768', maxOut: '4,096', dims: '', limit: '32 concurrent sequences', serving: 'gpu-04 · shared', status: 'Active', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '6 req/min', lat: 'p95 0.9 s', util: '48% GPU (shared)', all: true, ten: [] },
      { id: 'qwen7b-router', did: 'Qwen/Qwen2.5-7B-Instruct', conn: 'c1', model: 'Qwen2.5-7B-Instruct', cat: 'LLM', caps: ['Chat', 'Structured output'], ctx: '32,768', maxOut: '2,048', dims: '', limit: '48 concurrent sequences', serving: 'gpu-04 · shared', status: 'Active', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '52 req/min', lat: 'p95 0.4 s', util: '48% GPU (shared)', all: false, ten: ['sceai'] },
      { id: 'embed-prod', did: 'Qwen/qwen3-embedding', conn: 'c1', model: 'qwen3-embedding', cat: 'Embedding', caps: ['Embeddings'], ctx: '8,192', maxOut: '', dims: '1024', limit: '64 concurrent requests', serving: 'gpu-04 · shared', status: 'Active', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '12 req/min', lat: 'p95 0.1 s', util: '48% GPU (shared)', all: true, ten: [] },
      { id: 'bge-m3-match', did: 'BAAI/bge-m3', conn: 'c1', model: 'BAAI/bge-m3', cat: 'Embedding', caps: ['Embeddings'], ctx: '8,192', maxOut: '', dims: '1024', limit: '64 concurrent requests', serving: 'gpu-04 · shared', status: 'Active', health: 'Healthy', lastOk: '1 min ago', errors: '0 in 24 h', req: '71 req/min', lat: 'p95 0.1 s', util: '48% GPU (shared)', all: false, ten: ['sceai'] },
      { id: 'gpt4o-sandbox', did: 'gpt-4o-2024-11-20', conn: 'c2', model: 'gpt-4o', cat: 'LLM', caps: ['Chat', 'Tool calling', 'Structured output', 'Vision'], ctx: '128,000', maxOut: '16,384', dims: '', limit: '150k tokens / min', serving: '', status: 'Active', health: 'Healthy', lastOk: '4 min ago', errors: '0 in 24 h', req: '310 / 24 h', lat: 'p95 2.4 s', util: '34% of TPM quota', all: false, ten: ['sandbox'] },
      { id: 'partner-llama70b', did: 'meta-llama/Llama-3.3-70B-Instruct', conn: 'c3', model: 'Llama-3.3-70B-Instruct', cat: 'LLM', caps: ['Chat', 'Tool calling', 'Structured output'], ctx: '128,000', maxOut: '8,192', dims: '', limit: '60 requests / min', serving: '', status: 'Disabled', health: 'Failing', lastOk: '6 d ago', errors: '14 TLS timeouts in 24 h', req: '0 / 24 h', lat: '—', util: '—', all: false, ten: ['sandbox'] },
      { id: 'asr-whisper', type: 'ASR', did: 'whisper-large-v3', conn: 'c4', model: 'whisper-large-v3', vendor: 'OpenAI Whisper (open weights)', contract: 'KAP ASR contract v1 · REST', cat: 'ASR', caps: ['Transcription', 'Language identification'], params: { langs: ['Arabic', 'English'], maxAudio: '60', srate: '16,000' }, dims: '', limit: '8 concurrent streams', serving: 'gpu-04 · shared', status: 'Active', health: 'Healthy', lastOk: '3 min ago', errors: '0 in 24 h', req: '44 / 24 h', lat: 'p95 3.8 s', util: '21% GPU', all: false, ten: ['sceai'] },
    ]),
    tDef: { sceai: { agent: 'qwen32b-prod', chat: 'qwen14b-shared', embed: 'embed-prod' }, econ: { agent: 'qwen72b-prod', chat: 'qwen14b-shared', embed: 'embed-prod' }, sandbox: { agent: 'qwen32b-prod', chat: 'gpt4o-sandbox', embed: 'embed-prod' } },
    mref: [
      ['sceai', 'Agent', 'sceai_indicators_agent', 'qwen72b-prod'], ['sceai', 'Agent', 'sceai_indicators_oxford', 'default:agent'], ['sceai', 'Agent', 'Intent Agent', 'qwen7b-router'], ['sceai', 'Agent', 'Indicator Picker', 'qwen72b-prod'], ['sceai', 'Agent', 'Composer Agent', 'qwen72b-prod'], ['sceai', 'Agent', 'Article Agent', 'qwen72b-prod'], ['sceai', 'Agent', 'Follow-up Agent', 'qwen7b-router'], ['sceai', 'Agent', 'Reader Agent', 'qwen72b-prod'],
      ['sceai', 'Collection', 'sceai_indicators', 'embed-prod'], ['sceai', 'Pipeline', 'docs_docx_ingest', 'embed-prod'], ['sceai', 'Pipeline step', 'Ask AI indicator resolver', 'bge-m3-match'],
      ['econ', 'Agent', 'policy_brief_agent', 'qwen72b-prod'], ['econ', 'Agent', 'budget_variance_agent', 'default:agent'],
      ['sandbox', 'Agent', 'exp_router', 'qwen32b-prod'], ['sandbox', 'Agent', 'vision_experiment', 'gpt4o-sandbox'],
    ],
  };
}

export interface ModelType {
  caps: string[];
  fixed?: boolean;
  capL: string;
  langs?: boolean;
  /** [key, label, placeholder, advanced] */
  params: [string, string, string, boolean][];
  conns: string[];
}

const ALLC = ['vLLM (self-hosted)', 'Azure OpenAI', 'OpenAI-compatible API', 'REST API', 'gRPC'];
export const MODEL_TYPES: Record<string, ModelType> = {
  LLM: { caps: ['Chat', 'Tool calling', 'Structured output', 'Vision'], capL: 'Capabilities', params: [['ctx', 'Context window (tokens)', 'e.g. 32,768', true], ['maxOut', 'Max output (tokens)', 'e.g. 8,192', true]], conns: ['vLLM (self-hosted)', 'Azure OpenAI', 'OpenAI-compatible API', 'REST API'] },
  Embedding: { caps: ['Embeddings'], fixed: true, capL: 'Capabilities', params: [['dims', 'Dimensions', 'e.g. 1024', false], ['maxIn', 'Max input (tokens)', 'e.g. 8,192', true]], conns: ['vLLM (self-hosted)', 'Azure OpenAI', 'OpenAI-compatible API', 'REST API'] },
  Reranking: { caps: ['Reranking'], fixed: true, capL: 'Capabilities', params: [['maxDocs', 'Max documents per request', 'e.g. 100', true]], conns: ['vLLM (self-hosted)', 'REST API'] },
  ASR: { caps: ['Transcription', 'Translation to English', 'Diarization', 'Language identification'], capL: 'Operations', langs: true, params: [['maxAudio', 'Max audio length (minutes)', 'e.g. 60', true], ['srate', 'Sample rate (Hz)', 'e.g. 16,000', true]], conns: ['OpenAI-compatible API', 'Azure OpenAI', 'REST API', 'gRPC'] },
  'Speaker biometrics': { caps: ['Verification', 'Identification', 'Enrolment'], capL: 'Operations', params: [['thr', 'Match threshold', 'e.g. 0.75', false], ['samples', 'Enrolment samples', 'e.g. 3', true]], conns: ['REST API', 'gRPC'] },
  Vision: { caps: ['Image description', 'OCR', 'Object detection', 'Classification'], capL: 'Tasks', params: [['maxImg', 'Max image size (MB)', 'e.g. 20', true]], conns: ALLC },
  Other: { caps: ['Prediction', 'Authenticity check', 'Custom operation'], capL: 'Operations', params: [], conns: ['REST API', 'gRPC'] },
};

/** Known models and the capabilities they support. */
export const MODEL_CATALOG: Record<string, string[]> = { 'Qwen2.5-72B-Instruct': ['Chat', 'Tool calling', 'Structured output'], 'Qwen2.5-32B-Instruct': ['Chat', 'Tool calling', 'Structured output'], 'Qwen2.5-14B-Instruct': ['Chat', 'Tool calling', 'Structured output'], 'Qwen2.5-7B-Instruct': ['Chat', 'Structured output'], 'qwen3-embedding': ['Embeddings'], 'BAAI/bge-m3': ['Embeddings'], 'bge-reranker-v2-m3': ['Reranking'], 'gpt-4o': ['Chat', 'Tool calling', 'Structured output', 'Vision'], 'gpt-4o-mini': ['Chat', 'Tool calling', 'Structured output', 'Vision'], 'text-embedding-3-large': ['Embeddings'], 'Llama-3.3-70B-Instruct': ['Chat', 'Tool calling', 'Structured output'], 'whisper-large-v3': ['Transcription', 'Translation to English', 'Language identification'], 'ecapa-tdnn-voxceleb': ['Verification', 'Identification', 'Enrolment'], 'paddleocr-v4': ['OCR'], 'Qwen2.5-VL-7B-Instruct': ['Image description', 'OCR', 'Object detection'] };

/** Simulated test results: capabilities the provider reports, and latency. */
export const SIM_TESTS: Record<string, [string[], string]> = { 'Qwen2.5-72B-Instruct': [['Chat', 'Tool calling', 'Structured output'], '2.9 s'], 'Qwen2.5-32B-Instruct': [['Chat', 'Tool calling', 'Structured output'], '1.4 s'], 'Qwen2.5-14B-Instruct': [['Chat', 'Tool calling', 'Structured output'], '0.9 s'], 'Qwen2.5-7B-Instruct': [['Chat', 'Structured output'], '0.4 s'], 'qwen3-embedding': [['Embeddings'], '0.1 s'], 'BAAI/bge-m3': [['Embeddings'], '0.1 s'], 'gpt-4o': [['Chat', 'Tool calling', 'Structured output', 'Vision'], '2.4 s'], 'gpt-4o-mini': [['Chat', 'Tool calling', 'Structured output', 'Vision'], '1.1 s'], 'text-embedding-3-large': [['Embeddings'], '0.3 s'], 'Llama-3.3-70B-Instruct': [['Chat', 'Tool calling', 'Structured output'], '2.2 s'], 'Mistral-Small-24B-Instruct': [['Chat', 'Structured output'], '1.2 s'], 'bge-reranker-v2-m3': [['Reranking'], '0.2 s'], 'whisper-large-v3': [['Transcription', 'Translation to English', 'Language identification'], '3.8 s'], 'ecapa-tdnn-voxceleb': [['Verification', 'Identification', 'Enrolment'], '0.6 s'], 'paddleocr-v4': [['OCR'], '0.9 s'], 'Qwen2.5-VL-7B-Instruct': [['Image description', 'OCR'], '1.6 s'] };

/** Platform secret references: [path, kind, connection key]. */
export const PLATFORM_SECRETS: [string, string, string][] = [
  ['secret/platform/kap/vllm_client_cert', 'Client certificate', 'vllm'],
  ['secret/platform/kap/vllm_bearer_token', 'Bearer token', 'vllm'],
  ['secret/platform/kap/azure_openai_prod_key', 'API key', 'azure'],
  ['secret/platform/kap/azure_openai_uaen_key', 'API key', 'azure'],
  ['secret/platform/kap/partner_llm_key', 'API key', 'oai'],
  ['secret/platform/kap/openai_compat_token', 'Bearer token', 'oai'],
  ['secret/platform/kap/speech_gw_token', 'Bearer token', 'rest'],
  ['secret/platform/kap/biometrics_api_key', 'API key', 'rest'],
  ['secret/platform/kap/grpc_client_cert', 'Client certificate', 'grpc'],
];

/** Connection types: short name, secret key, credentials that need no secret. */
export const CONN_TYPES: Record<string, { s: string; key: string; creds: string[] }> = {
  'vLLM (self-hosted)': { s: 'vLLM', key: 'vllm', creds: ['none'] },
  'Azure OpenAI': { s: 'Azure OpenAI', key: 'azure', creds: ['managed'] },
  'OpenAI-compatible API': { s: 'OpenAI-compatible', key: 'oai', creds: [] },
  'REST API': { s: 'REST', key: 'rest', creds: [] },
  gRPC: { s: 'gRPC', key: 'grpc', creds: ['none'] },
};

export const CONTRACTS: Record<string, string[]> = { LLM: ['KAP Chat contract v1'], Embedding: ['KAP Embedding contract v1'], Reranking: ['KAP Rerank contract v1'], ASR: ['KAP ASR contract v1'], 'Speaker biometrics': ['KAP Speaker Biometrics contract v1'], Vision: ['KAP Vision contract v1'], Other: ['KAP Prediction contract v1', 'KAP Media Authenticity contract v1'] };

export const ASR_LANGS = ['Arabic', 'English', 'French', 'Russian'];

export const registryStore = createStore<Registry>(registryInit);

// ====================================================================== MCP registry

export interface McpTool { n: string; d: string; fx: string }
export interface McpServer {
  n: string;
  /** 'platform' (shared) or the owner tenant */
  own: 'platform' | TKey;
  vendor: string;
  up: string;
  dest: string;
  auth: string;
  secret: string;
  cls: string;
  pii: string;
  fx: string;
  timeout: string;
  rate: string;
  retries: string;
  disc: string;
  status: 'Enabled' | 'Disabled';
  susp?: boolean;
  health: Health;
  lastOk: string;
  p95: string;
  note?: string;
  ten: TKey[];
  by: string;
  tools: McpTool[];
}
export interface McpRegistry {
  servers: McpServer[];
  /** tools of each server enabled in a tenant */
  tenTools: Partial<Record<TKey, Record<string, string[]>>>;
  /** shared servers a tenant removed */
  optOut: Partial<Record<TKey, Record<string, boolean>>>;
  /** agent → granted tools ('server:tool', 'kap:<native tool>') */
  grants: Partial<Record<TKey, Record<string, string[]>>>;
}

const T = (n: string, d: string, fx?: string): McpTool => ({ n, d, fx: fx || 'Read-only' });

export function mcpInit(): McpRegistry {
  return {
    servers: [
      { n: 'doc_converter', own: 'platform', vendor: 'docling-mcp 1.4 · document conversion MCP server', up: 'http://docling-mcp.mcp.svc:8000/mcp', dest: 'docling-mcp.mcp.svc:8000', auth: 'mTLS', secret: 'secret/platform/kap/docling_cert', cls: 'L2 · Restricted', pii: 'Masked', fx: 'Read-only', timeout: '60', rate: '30 / min', retries: '1', disc: 'Automatic', status: 'Enabled', health: 'Healthy', lastOk: '1 min ago', p95: '0.8 s', ten: ['sceai', 'sandbox'], by: 'm.alkuwari · 30 d ago', tools: [T('extract_tables', 'Tables from PDF and DOCX reports'), T('convert_pdf', 'PDF to structured text with layout')] },
      { n: 'web_fetch', own: 'platform', vendor: 'mcp-server-fetch 2.1 · web fetch MCP server', up: 'http://fetch-mcp.mcp.svc:8000/mcp', dest: '6 public domains (allowlist)', auth: 'None', secret: '', cls: 'L0 · Public', pii: 'Not allowed', fx: 'Read-only', timeout: '15', rate: '20 / min', retries: '0', disc: 'Manual', status: 'Disabled', health: 'Not checked', lastOk: '—', p95: '—', ten: [], by: 'm.alkuwari · 12 d ago', tools: [T('fetch', 'Fetch a public web page as text')] },
      { n: 'oxford_economics', own: 'sceai', vendor: 'Oxford Economics MCP server · SCEAI subscription', up: 'https://services.oxfordeconomics.com/mcp', dest: 'services.oxfordeconomics.com:443', auth: 'API key', secret: 'secret/tenants/sceai/kap/oxford_api_key', cls: 'L0 · Public', pii: 'Not allowed', fx: 'Read-only', timeout: '30', rate: '60 / min', retries: '2', disc: 'Automatic', status: 'Enabled', susp: false, health: 'Degraded', lastOk: '18 min ago', p95: '2.6 s', note: '2 × 502 in 24 h', ten: [], by: 'sceai_admin · 41 d ago', tools: [T('EconomicData', 'Macro data series by country and indicator'), T('EconomicAnalysis', 'Forecasts and narrative analysis'), T('CountryRisk', 'Country risk scores')] },
      { n: 'sceai_indicator_tools', own: 'sceai', vendor: 'SCEAI indicator MCP server · implementation partner', up: 'http://sceai-tools.sceai.svc:8080/mcp', dest: 'sceai-tools.sceai.svc:8080', auth: 'OAuth2 client credentials', secret: 'secret/tenants/sceai/kap/sceai_tools_client', cls: 'L1 · Internal', pii: 'Not allowed', fx: 'Read-only', timeout: '20', rate: '120 / min', retries: '2', disc: 'Automatic', status: 'Enabled', susp: false, health: 'Healthy', lastOk: '2 min ago', p95: '0.4 s', ten: [], by: 'r.haddad · 96 d ago', tools: [T('find_indicator', 'Resolve an indicator by name, alias or code'), T('actual_vs_target', 'Compare actual against target'), T('get_status', 'On-track / off-track by target'), T('top_movers', 'Largest positive and negative changes'), T('get_narratives', 'Narrative commentary')] },
      { n: 'sceai_dwh_mcp', own: 'sceai', vendor: 'Data warehouse MCP server · read-only views', up: 'http://dwh-mcp.data.svc:8000/mcp', dest: 'dwh-mcp.data.svc:8000', auth: 'mTLS', secret: 'secret/tenants/sceai/kap/dwh_mcp_cert', cls: 'L2 · Restricted', pii: 'Masked', fx: 'Read-only', timeout: '60', rate: '30 / min', retries: '1', disc: 'Manual', status: 'Enabled', susp: false, health: 'Healthy', lastOk: '3 d ago', p95: '—', ten: [], by: 'sceai_admin · 3 d ago', tools: [T('describe_table', 'Columns and types of a published table'), T('run_sql_readonly', 'Read-only SQL over published views')] },
    ],
    tenTools: { sceai: { doc_converter: ['extract_tables'], web_fetch: [], oxford_economics: ['EconomicData', 'EconomicAnalysis'], sceai_indicator_tools: ['find_indicator', 'actual_vs_target', 'get_status', 'top_movers', 'get_narratives'], sceai_dwh_mcp: ['describe_table', 'run_sql_readonly'] }, sandbox: { doc_converter: ['extract_tables', 'convert_pdf'] } },
    optOut: {},
    grants: {
      sceai: {
        sceai_indicators_agent: ['kap:hybrid_search', 'kap:numeric_lookup', 'kap:compare', 'kap:trend', 'sceai_indicator_tools:find_indicator', 'sceai_indicator_tools:actual_vs_target', 'sceai_indicator_tools:get_status', 'sceai_indicator_tools:top_movers', 'sceai_indicator_tools:get_narratives'],
        sceai_indicators_oxford: ['kap:hybrid_search', 'kap:numeric_lookup', 'kap:compare', 'kap:trend', 'sceai_indicator_tools:find_indicator', 'sceai_indicator_tools:actual_vs_target', 'sceai_indicator_tools:get_narratives', 'oxford_economics:EconomicData', 'oxford_economics:EconomicAnalysis'],
        'Article Agent': ['kap:hybrid_search', 'kap:document_get', 'doc_converter:extract_tables'],
        'Intent Agent': ['kap:translate'], 'Indicator Picker': ['sceai_indicator_tools:find_indicator'], 'Composer Agent': ['kap:compare'], 'Follow-up Agent': [], 'Reader Agent': ['kap:document_get'],
      },
      sandbox: { exp_router: ['doc_converter:extract_tables', 'doc_converter:convert_pdf'] },
    },
  };
}

/** Credentials selectable in the MCP server form. */
export const MCP_SECRETS: Record<string, string[]> = { platform: ['secret/platform/kap/docling_cert', 'secret/platform/kap/mcp_shared_token'], sceai: ['secret/tenants/sceai/kap/oxford_api_key', 'secret/tenants/sceai/kap/sceai_tools_client', 'secret/tenants/sceai/kap/dwh_mcp_cert', 'secret/tenants/sceai/kap/hr_directory_token'] };
/** Tools a known endpoint returns on discovery. */
export const MCP_DISCOVERY: Record<string, [string, string][]> = { 'http://hr-mcp.hr.svc:8000/mcp': [['lookup_employee', 'Employee record by ID (masked)'], ['org_unit', 'Organisation unit and reporting line']], 'https://api.worldbank.org/mcp': [['wb_indicator', 'World Bank indicator series'], ['wb_country', 'Country metadata']] };

export const mcpRegStore = createStore<McpRegistry>(mcpInit);

// ====================================================================== tenants and platform overview

export type TenantStatus = 'Healthy' | 'At limit' | 'Degraded' | 'Internal' | 'Provisioning';
export type Period = '24h' | '7d' | '30d';

export interface TenantRec {
  k: string;
  n: string;
  d: string;
  st: TenantStatus;
  u: number;
  a: number;
  c: number;
  j: number;
  inf: number;
  max: number;
  r: Record<Period, number>;
  f: Record<Period, number>;
  created: string;
  issue: string;
  /** platform screen that explains the issue */
  go: string;
  /** provisioning checklist of a tenant created in this session */
  prov?: string[];
}

export function tenantsInit(): TenantRec[] {
  // kap.agent max in-flight per tenant comes from the platform allocation (pcfgInit.alloc)
  return [
    { k: 'sceai', n: 'SCEAI', d: 'Supreme Council for Economic Affairs and Investment', st: 'At limit', u: 7, a: 8, c: 1, j: 14, inf: 3, max: 3, r: { '24h': 74, '7d': 508, '30d': 2120 }, f: { '24h': 3, '7d': 21, '30d': 88 }, created: '142 d ago', issue: 'kap.agent at limit · 3 / 3 in flight · 1 waiting', go: 'pSched' },
    { k: 'econ', n: 'Economic Affairs', d: 'Economic Affairs directorate', st: 'Healthy', u: 9, a: 2, c: 3, j: 31, inf: 1, max: 3, r: { '24h': 63, '7d': 412, '30d': 1760 }, f: { '24h': 1, '7d': 8, '30d': 31 }, created: '118 d ago', issue: '', go: '' },
    { k: 'sandbox', n: 'sandbox', d: 'AI team experiments', st: 'Degraded', u: 6, a: 4, c: 3, j: 12, inf: 2, max: 4, r: { '24h': 39, '7d': 270, '30d': 1090 }, f: { '24h': 3, '7d': 18, '30d': 71 }, created: '31 d ago', issue: 'kap.pipeline re-index slow · 41 min elapsed', go: 'pQueues' },
    { k: 'default', n: 'Default', d: 'Internal system tenant', st: 'Internal', u: 0, a: 0, c: 0, j: 0, inf: 0, max: 0, r: { '24h': 0, '7d': 0, '30d': 0 }, f: { '24h': 0, '7d': 0, '30d': 0 }, created: '211 d ago', issue: '', go: '' },
  ];
}

export const tenantsStore = createStore<TenantRec[]>(tenantsInit);

/** Installation facts (pcfgInit.info). */
export const INSTALL = { hosting: 'On-premise · Kubernetes · DC1', release: '2026.11.1', released: '9 d ago', maint: 'Friday 02:00–04:00 AST', maintNote: 'Announced to tenant administrators; does not pause scheduled jobs', licenseUntil: '31 Dec 2027' };

export interface OpsAlert { id: string; sev: 'Critical' | 'Warning' | 'Info'; comp: string; issue: string; st: string; last: string }
/** Open and acknowledged alerts (opsData.alerts). */
export const OPS_ALERTS: OpsAlert[] = [
  { id: 'A-1207', sev: 'Warning', comp: 'kap.agent queue · SCEAI', issue: 'SCEAI at its kap.agent concurrency limit; 1 job waiting', st: 'Open', last: '4 min ago' },
  { id: 'A-1206', sev: 'Critical', comp: 'SIEM forwarder', issue: 'No heartbeat for 47 min; audit events are queued locally', st: 'Open', last: '1 min ago' },
  { id: 'A-1203', sev: 'Warning', comp: 'MCP server oxford_economics · SCEAI', issue: 'Returned 502 twice in 24 h', st: 'Open', last: '18 min ago' },
  { id: 'A-1201', sev: 'Warning', comp: 'kap.pipeline · sandbox', issue: 'Re-index running 41 min; expected about 15 min', st: 'Acknowledged', last: '2 min ago' },
  { id: 'A-1198', sev: 'Info', comp: 'Model serving · gpu-03', issue: 'Node unavailable; capacity reduced', st: 'Recovered', last: '3 h ago' },
];

/** Agent request series per period (platformOps SERIES). */
export const ACTIVITY_SERIES: Record<Period, { l: string[]; v: number[] }> = {
  '24h': { l: ['00', '02', '04', '06', '08', '10', '12', '14', '16', '18', '20', '22'], v: [4, 2, 3, 6, 18, 26, 22, 24, 21, 17, 19, 14] },
  '7d': { l: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'], v: [152, 168, 140, 181, 196, 210, 193] },
  '30d': { l: ['25 Oct', '', '', '', '', '30 Oct', '', '', '', '', '4 Nov', '', '', '', '', '9 Nov', '', '', '', '', '14 Nov', '', '', '', '', '19 Nov', '', '', '', '23 Nov'], v: [128, 132, 119, 141, 150, 98, 92, 155, 162, 158, 149, 171, 104, 99, 166, 172, 181, 175, 169, 120, 112, 178, 190, 185, 152, 168, 140, 181, 196, 205] },
};
export const PERIOD_JOBS: Record<Period, { jobs: number; pjobs: number; pfail: number }> = { '24h': { jobs: 57, pjobs: 9, pfail: 1 }, '7d': { jobs: 389, pjobs: 61, pfail: 4 }, '30d': { jobs: 1642, pjobs: 254, pfail: 14 } };
export const PERIOD_LABEL: Record<Period, string> = { '24h': '24 h', '7d': '7 days', '30d': '30 days' };

// ====================================================================== tenant dashboards

/** Tenant identity (prototype TN map): name, description, initials, icon colours. */
export const TENANT_META: Record<string, [string, string, string, string, string]> = {
  sceai: ['SCEAI', 'Economic Affairs and Investment', 'SC', '#F6E8EC', '#8A1538'],
  econ: ['Economic Affairs', 'Economic Affairs directorate · sample tenant', 'EA', 'var(--surface-sunken)', 'var(--text-body)'],
  sandbox: ['sandbox', 'AI team experiments · sample tenant', 'SB', 'var(--surface-sunken)', 'var(--text-body)'],
  default: ['Default', 'Internal system tenant', 'DF', 'var(--surface-sunken)', 'var(--text-body)'],
};

/** KPI cards of the sample tenants (otKpi). */
export const OTHER_KPI: Record<'econ' | 'sandbox', [string, string, string][]> = {
  econ: [['Agents', '2', 'policy_brief_agent, budget_variance_agent'], ['Jobs today', '31', '91.0% succeeded'], ['Collections', '3', 'Budget reports · circulars · KPIs'], ['Users', '9', '3 groups'], ['Languages', 'ar, en', 'Default: Arabic']],
  sandbox: [['Agents', '4', 'Experiments'], ['Jobs today', '12', '78.4% succeeded'], ['Collections', '3', 'public, confidential, eval sets'], ['Users', '6', 'AI team'], ['Languages', 'en, ar, fr, ru', 'Default: English']],
};

/** SCEAI dashboard (overview()). Link targets are prototype screen keys. */
export const SCEAI_DASH = {
  week: '13 – 19 Nov 2026 · compared with the previous week',
  questions: { cur: [64, 67, 50, 75, 82, 88, 82], prev: [52, 58, 47, 61, 66, 70, 66], days: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'] },
  routes: [['SCEAI indicators', 61, '#8A1538'], ['Articles', 18, '#C8B49A'], ['Oxford Economics', 10, '#0F766E'], ['Chat / out of scope', 11, '#A8A0A3']] as [string, number, string][],
  time: { p50: [3.4, 3.3, 3.5, 3.2, 3.1, 3.0, 3.1], p95: [4.4, 4.2, 4.5, 4.0, 4.1, 3.8, 3.9] },
  fbWhy: [['Not answered (template)', 2], ['Wrong indicator', 2], ['Wrong period', 1], ['Wrong source', 1], ['Too long', 1]] as [string, number][],
  actions: [['Ask a test question', 'convs'], ['Upload documents', 'uData'], ['Run ingestion', 'iPipes'], ['Create agent', 'wizard'], ['Create user', 'users'], ['Schedule report', 'reports']] as [string, string][],
  /** [name, value, detail, icon tone, health colour, screen] */
  res: [['Agents', '8', '6 Ask AI · 2 indicator agents', 'lt', 'var(--success)', 'agents'], ['Sessions', '508', 'This week · 38% Arabic', 'lt', 'var(--success)', 'convs'], ['Structured datasets', '10', '3 updated today', 'sd', 'var(--success)', 'sData'], ['Collections', '1', '8,104 observations · 12 docs', 'sd', 'var(--success)', 'collections'], ['Pipelines', '2', '1 partial run this week', 'nt', 'var(--warning)', 'pipelines'], ['AI Agent Tools', '3', 'Tenant MCP servers · Oxford degraded', 'tl', 'var(--warning)', 'mcp'], ['Users', '7', '5 groups · 3 service accounts', 'nt', 'var(--success)', 'users'], ['Scheduled reports', '4', 'Next: Sunday 07:00', 'nt', 'var(--success)', 'reports']] as [string, string, string, string, string, string][],
  /** [severity, title, detail, tags, when, link label, screen] */
  att: [
    ['critical', 'Two jobs hit the 180 s timeout', 'Both were waiting on Oxford Economics. The answers fell back to local data only.', ['2 jobs', 'sceai_indicators_oxford'], '2 h ago', 'Open trace', 'trace'],
    ['warning', 'Oxford Economics is slow and failing more often', '8 of 51 calls returned 502 this week. Oxford questions take 2.6 s longer than others.', ['51 questions affected', 'MCP'], '18 min ago', 'Check connection', 'mcp'],
    ['warning', 'Six indicators have weak Arabic coverage', 'Arabic questions about them need the Indicator Picker three times more often.', ['6 indicators', 'Business entities'], '1 d ago', 'Open entities', 'entities'],
  ] as [string, string, string, string[], string, string, string][],
  /** [name, metric, metric label, status, ok, detail, icon, screen, sparkline] */
  health: [
    ['Ask AI pipeline', '97.9%', 'verified', 'Healthy', true, 'p95 3.9 s', 'Workflow', 'map', [97.2, 97.6, 97.4, 98.0, 97.8, 98.1, 97.9]],
    ['kap.agent queue', '6/8', 'in flight', 'Busy', false, '1 waiting', 'Layers', 'map', [3, 4, 6, 5, 7, 8, 6]],
    ['Oxford MCP', '16%', 'errors', 'Degraded', false, 'p95 2.6 s', 'Plug', 'mcp', [4, 6, 5, 12, 9, 18, 16]],
    ['Registered models', '62%', 'capacity', 'Healthy', true, '3 in use', 'Cpu', 'agents', [48, 55, 60, 72, 81, 66, 62]],
    ['Pipelines', '6 h', 'since last run', 'Healthy', true, '8,104 rows', 'Database', 'pipelines', [1, 1, 1, 1, 0.8, 1, 1]],
  ] as [string, string, string, string, boolean, string, string, string, number[]][],
};

/** Default (system) tenant overview. */
export const DEFAULT_TENANT = {
  kpi: [['Service identities', '3', 'kap_system, kap_scheduler, kap_ingest_svc'], ['Customer users', '0', 'Cannot be assigned'], ['Agents', '0', 'Runs no workloads'], ['Business data', 'None', 'Holds no collections']] as [string, string, string][],
  users: [['kap_system', 'Platform service · migrations and health checks', '2 min ago'], ['kap_scheduler', 'Runs scheduled reports and pipeline triggers', '6 h ago'], ['kap_ingest_svc', 'Executes ingestion on kap.pipeline', '6 h ago']] as [string, string, string][],
  queues: [['kap.agent · max in-flight', '3'], ['kap.agent · task priority', '3'], ['kap.pipeline · max in-flight', '2'], ['Job timeout', '180 s'], ['Tool-call limit', '15'], ['Request limit', '20']] as [string, string][],
  tenants: [['SCEAI', 'Supreme Council for Economic Affairs and Investment', 'Created 142 d ago', 'sceai'], ['Economic Affairs', 'Economic Affairs directorate', 'Created 118 d ago', 'econ'], ['sandbox', 'AI team sandbox', 'Created 31 d ago', 'sandbox']] as [string, string, string, string][],
};
