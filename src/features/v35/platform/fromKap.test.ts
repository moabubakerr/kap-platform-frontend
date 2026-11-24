import { describe, expect, it } from 'vitest';
import { registryInit } from '@/v35/data/platform';
import { availTo, depRow, depRows } from './build';
import { applyCheck, checkMsg, healthOfCheck, kapCfg, mergeKap, providerFields, toConn, toDep, toKapCreate, toKapPatch, type KapModelProvider, type KapProviderCheck } from './fromKap';

const SID = '0f3c2a1b-1111-4222-8333-944455556666';

const prov = (o: Partial<KapModelProvider> = {}): KapModelProvider => ({
  id: 'p-1',
  name: 'qwen72b',
  model_provider: 'openai-api-compatible',
  model_type: 'chat',
  model_name: 'qwen72b',
  base_url: 'http://vllm:8000/v1',
  params: {},
  config: {},
  api_key: { is_set: true },
  rpm: 60,
  tpm: null,
  max_wait_seconds: 30,
  created_at: '2026-11-01T08:00:00Z',
  updated_at: '2026-11-20T09:30:00Z',
  ...o,
});
const ok: KapProviderCheck = { status: 'ok', checked_at: '2026-11-24T10:00:00Z', detail: 'available', provider_status_code: 200, retry_after_seconds: null };
const empty = { byDep: {}, checks: {} };

describe('KAP model providers → registry', () => {
  it('maps a provider to a live entry assigned to sandbox, with honest defaults', () => {
    const d = toDep(prov(), 'qwen72b');
    expect(d).toMatchObject({ id: 'qwen72b', type: 'LLM', model: 'qwen72b', caps: ['Chat'], status: 'Active', health: 'Not checked', all: false, ten: ['sandbox'], limit: '60 requests / min', req: '—', lat: '—', util: '—', verified: [] });
    expect(toDep(prov({ model_type: 'embedding' }), 'e').caps).toEqual(['Embeddings']);
    expect(toConn(prov())).toMatchObject({ id: 'kapc:openai-api-compatible:http://vllm:8000/v1', n: 'KAP · vllm:8000', type: 'OpenAI-compatible API', auth: 'API key (secret reference in KAP)' });
    expect(toConn(prov({ model_provider: 'azure-openai', config: { auth_method: 'entra_id' }, api_key: { is_set: false } })).auth).toBe('Microsoft Entra ID (managed identity)');
  });

  it('merges providers into the registry: samples stay, live entries are replaced, name clashes get -kap', () => {
    const R = registryInit();
    const a = mergeKap(R, empty, [prov(), prov({ id: 'p-2', name: 'qwen32b-prod', model_name: 'Qwen2.5-32B-Instruct' })]);
    expect(a.next.deps.length).toBe(R.deps.length + 2);
    expect(Object.keys(a.kapm.byDep).sort()).toEqual(['qwen32b-prod-kap', 'qwen72b']);
    expect(a.next.conns.filter((c) => c.id.startsWith('kapc:'))).toHaveLength(1);
    expect(availTo(a.next.deps.find((d) => d.id === 'qwen72b')!, 'sandbox')).toBe(true);
    expect(availTo(a.next.deps.find((d) => d.id === 'qwen72b')!, 'sceai')).toBe(false);
    // reload: provider p-2 is gone (deleted in KAP), checks of remaining providers are kept
    const b = mergeKap(a.next, { ...a.kapm, checks: { 'p-1': ok, 'p-2': ok } }, [prov()]);
    expect(b.next.deps.length).toBe(R.deps.length + 1);
    expect(b.next.deps.find((d) => d.id === 'qwen72b')!.health).toBe('Healthy');
    expect(b.kapm.checks).toEqual({ 'p-1': ok });
    expect(b.next.deps.some((d) => d.id === 'qwen32b-prod')).toBe(true);
    // registry rows and search work for live entries
    expect(depRows(b.next, 'vllm:8000').map((r) => r.d.id)).toEqual(['qwen72b']);
    expect(depRow(b.next, b.next.deps.find((d) => d.id === 'qwen72b')!).availL).toBe('sandbox');
  });

  it('applies a KAP check to the entry', () => {
    const { next } = mergeKap(registryInit(), empty, [prov()]);
    const fail: KapProviderCheck = { status: 'unreachable', checked_at: '2026-11-24T10:00:00Z', detail: 'base_url_unreachable', provider_status_code: null, retry_after_seconds: null };
    const R2 = applyCheck(next, 'qwen72b', prov(), fail);
    expect(R2.deps.find((d) => d.id === 'qwen72b')).toMatchObject({ health: 'Failing', errors: 'Last check: unreachable' });
    expect(checkMsg(fail)).toContain('OUTBOUND_PRIVATE_ALLOWLIST');
    expect(checkMsg(ok)).toContain('passed');
    expect(healthOfCheck('rate_limited')).toBe('Degraded');
    expect(applyCheck(next, 'qwen72b', prov(), ok).deps.find((d) => d.id === 'qwen72b')!.verified).toEqual(['Chat']);
  });

  it('lists the KAP configuration of an entry', () => {
    const cfg = kapCfg(prov({ params: { temperature: 0.2 } }));
    expect(cfg).toContainEqual(['Base URL', 'http://vllm:8000/v1', true]);
    expect(cfg).toContainEqual(['Params', '{"temperature":0.2}', true]);
    expect(cfg).toContainEqual(['Rate limits', '60 requests / min']);
  });
});

describe('KAP model provider bodies', () => {
  const form = (o: Record<string, unknown> = {}) => ({ name: 'qwen-chat', prov: 'OpenAI-compatible API', mt: 'Chat', model: 'qwen72b', url: 'http://vllm:8000/v1', auth: 'API key', be: 'vault', sid: SID, sver: '1', rpm: '', tpm: '200000', wait: '30', ...o });

  it('builds the create body with a secret reference', () => {
    expect(toKapCreate(form())).toEqual({
      body: { name: 'qwen-chat', model_provider: 'openai-api-compatible', model_type: 'chat', settings: { model_name: 'qwen72b', base_url: 'http://vllm:8000/v1', api_key: { $secret: { backend: 'vault', secret_id: SID, version: '1' } } }, max_wait_seconds: 30, tpm: 200000 },
    });
    expect(toKapCreate(form({ name: 'Bad Name' }))).toHaveProperty('err');
    expect(toKapCreate(form({ sid: '' }))).toEqual({ err: 'Enter the key secret id (a UUID of an existing secret).' });
    expect(toKapCreate(form({ rpm: '0' }))).toHaveProperty('err');
    expect(toKapCreate(form({ prov: 'Azure OpenAI', url: 'https://x.openai.azure.com/' }))).toHaveProperty('err');
    const az = toKapCreate(form({ prov: 'Azure OpenAI', url: 'https://kap.openai.azure.com/openai/v1', auth: 'Microsoft Entra ID (workload identity)', sid: '', sver: '' }));
    expect(az).toEqual({ body: expect.objectContaining({ model_provider: 'azure-openai', config: { auth_method: 'entra_id' }, settings: { model_name: 'qwen72b', base_url: 'https://kap.openai.azure.com/openai/v1' } }) });
  });

  it('builds a patch body with only the changes; an empty key keeps the current one', () => {
    const p = prov();
    expect(toKapPatch(p, form({ name: 'qwen72b', sid: '', sver: '', rpm: '60', tpm: '' }))).toEqual({ body: {} });
    expect(toKapPatch(p, form({ name: 'qwen72b', sid: '', sver: '', rpm: '', tpm: '', url: 'http://gateway:4000/v1', wait: '60' }))).toEqual({ body: { settings: { base_url: 'http://gateway:4000/v1' }, rpm: null, max_wait_seconds: 60 } });
    expect(toKapPatch(p, form({ name: 'qwen72b', rpm: '60', tpm: '' }))).toEqual({ body: { settings: { api_key: { $secret: { backend: 'vault', secret_id: SID, version: '1' } } } } });
  });

  it('edit form locks provider and model type', () => {
    const f = providerFields(prov());
    expect(f.find((x) => 'k' in x && x.k === 'prov')).toMatchObject({ type: 'text', ro: true, val: 'OpenAI-compatible API' });
    expect(providerFields(null)[0]).toMatchObject({ type: 'note' });
  });
});
