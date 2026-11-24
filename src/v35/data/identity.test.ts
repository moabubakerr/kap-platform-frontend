import { describe, expect, it } from 'vitest';
import { identityStore, RESOURCES } from './identity';

describe('identity data', () => {
  it('holds the prototype service accounts and identity providers', () => {
    const d = identityStore.get();
    expect(d.sas.map((a) => `${a.t}/${a.n}`)).toEqual(['sceai/dashboards-svc', 'sceai/powerbi-prod', 'sceai/etl-nightly', 'econ/budget-sync']);
    expect(d.idps.map((p) => p.st)).toEqual(['Active', 'Active', 'Active', 'Draft']);
    expect(d.dir['Keycloak · kap-admin realm'].ai_team).toEqual(['kap.ops', 'm.alkuwari', 'r.haddad']);
  });

  it('sizes the document inventory like the prototype', () => {
    expect(RESOURCES.sceai.documents).toHaveLength(6 + 90 + 11 + 16);
    expect(RESOURCES.sceai.collections.find((c) => c.id === 'sceai_articles')!.docs).toHaveLength(92);
    expect(RESOURCES.sceai.collections.find((c) => c.id === 'nds_planning_docs')!.docs).toHaveLength(14);
    expect(RESOURCES.econ.collections.find((c) => c.id === 'budget_reports')!.docs).toHaveLength(48);
    expect(RESOURCES.sceai.documents[6].id).toBe('article_2026-11-22_tourism_ar.html');
  });

  it('resets to the initial data', () => {
    identityStore.update((d) => { d.sas = []; });
    identityStore.reset();
    expect(identityStore.get().sas).toHaveLength(4);
  });
});
