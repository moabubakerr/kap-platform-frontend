import { ChevronRight, Lock, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useBase } from '@/app/shell/AppShell';
import type { AgentsMapData, MapNode, MapNodeType } from '@/mocks/agentsMap';
import { NodeIcon } from './MapNode';
import { VIEW_H } from './mapState';

const KIND: Record<MapNodeType, string> = {
  code: 'Deterministic code step',
  store: 'Data store',
  model: 'Model',
  ch: 'Channel',
  queue: 'Job queue',
  ext: 'External MCP server',
  ai: 'AI agent',
};
const TYPE_KV: Record<MapNodeType, string> = {
  code: 'Code (no model)',
  store: 'Data store',
  model: 'Model endpoint',
  ch: 'Channel',
  queue: 'Job queue',
  ext: 'External · Oxford Economics',
  ai: 'AI agent',
};

/** 7-point sparkline, deterministic per node (as in the prototype). */
const sparkPoints = (id: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((i) => `${i * 50},${40 - (((id.length * 7 + i * 13) % 23) + (i === 6 ? 10 : 0))}`).join(' ');

/** Stats for non-AI nodes, parsed from the 7-day metric line. */
function parsedStats(metric: string): [string, string][] {
  return [
    ['Volume', metric.split(' · ')[0]],
    ['p95', (metric.split('p95 ')[1] || '—').split(' ·')[0]],
    ['Errors', (metric.match(/([\d.]+% errors)/) || ['', '0%'])[1].replace(' errors', '')],
  ];
}

export function MapDrawer({
  data,
  node,
  rangeLabel,
  onSelect,
  onClose,
}: {
  data: AgentsMapData;
  node: MapNode;
  rangeLabel: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const base = useBase();
  const nav = useNavigate();
  const t = node.type;
  const ai = t === 'ai';
  const d = data.details[node.id];
  const kind = d ? d.kind : KIND[t];
  const purpose = d ? d.purpose : node.sub + '.';
  const stats = (d ? d.stats : parsedStats(node.histMetric)).map(([k, v]) => ({
    k,
    v,
    c: /Rejected|Failed|NONE/.test(k) && v !== '0%' ? 'var(--warning-fg)' : 'var(--text-strong)',
  }));
  const kv: { k: string; v: string; mono: boolean }[] = d
    ? d.kv.map(([k, v]) => ({ k, v, mono: k === 'Model' }))
    : [
        { k: 'Type', v: TYPE_KV[t], mono: false },
        { k: 'Detail', v: node.sub, mono: false },
      ];
  const conns = data.edges
    .filter((e) => e.from === node.id || e.to === node.id)
    .map((e) => {
      const other = e.from === node.id ? e.to : e.from;
      return { dir: e.from === node.id ? 'To' : 'From', id: other, name: data.nodes.find((n) => n.id === other)?.name ?? other };
    });

  return (
    <aside
      aria-label={`${node.name} details`}
      style={{ flex: '1 1 330px', minWidth: 0, borderLeft: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', height: VIEW_H, overflow: 'auto' }}
    >
      <div style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', borderBottom: '1px solid var(--border-subtle)' }}>
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: ai ? '50%' : t === 'code' ? 2 : 6,
            background: ai ? '#F6E8EC' : t === 'model' ? 'var(--sand-tint)' : 'var(--surface-sunken)',
            color: ai ? '#8A1538' : t === 'model' ? 'var(--sand-ink)' : 'var(--text-muted)',
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
          }}
        >
          <NodeIcon node={node} size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 14.5 }}>{node.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{kind}</div>
        </div>
        <span
          title={node.id === 'oxmcp' ? 'Degraded' : 'Healthy'}
          style={{ width: 8, height: 8, borderRadius: '50%', background: node.id === 'oxmcp' ? 'var(--warning)' : 'var(--success)', marginTop: 6, flex: 'none' }}
        />
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close panel"
          className="grid flex-none place-items-center rounded-sm text-ink-muted hover:bg-surface-hover hover:text-ink-strong focus-visible:shadow-focus focus-visible:outline-none"
          style={{ width: 30, height: 30, margin: '-4px -6px 0 0' }}
        >
          <X size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16, fontSize: 13 }}>
        <div style={{ color: 'var(--text-body)', lineHeight: 1.55 }}>{purpose}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--r-sm)' }}>
          {stats.map((s, i) => (
            <div key={s.k} style={{ padding: '8px 10px', borderLeft: i ? '1px solid var(--border-subtle)' : undefined }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.k}</div>
              <div style={{ fontWeight: 600, color: s.c, fontSize: 15, whiteSpace: 'nowrap' }}>{s.v}</div>
            </div>
          ))}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
            <span>Calls · last 7 days</span>
            <span style={{ fontWeight: 400 }}>{rangeLabel}</span>
          </div>
          <svg viewBox="0 0 300 48" preserveAspectRatio="none" style={{ width: '100%', height: 48, display: 'block' }} aria-hidden>
            <polyline points={sparkPoints(node.id)} fill="none" stroke="#8A1538" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
            <line x1={0} y1={47} x2={300} y2={47} stroke="#E4DFDD" />
          </svg>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: '8px 12px' }}>
          {kv.map((r) => (
            <div key={r.k} style={{ display: 'contents' }}>
              <span style={{ color: 'var(--text-muted)' }}>{r.k}</span>
              <span style={{ fontFamily: r.mono ? 'var(--font-mono)' : 'var(--font-sans)', fontSize: 12.5, minWidth: 0, overflowWrap: 'anywhere' }}>{r.v}</span>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>Connections</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {conns.map((c) => (
              <button
                key={`${c.dir}-${c.id}`}
                type="button"
                onClick={() => onSelect(c.id)}
                className="flex items-center gap-2 rounded-sm border border-line-subtle text-left hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none"
                style={{ padding: '6px 8px', fontSize: 12.5 }}
              >
                <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28 }}>{c.dir}</span>
                <span style={{ flex: 1, color: 'var(--text-strong)' }}>{c.name}</span>
                <span style={{ display: 'flex', color: 'var(--text-subtle)' }}>
                  <ChevronRight size={14} strokeWidth={1.75} />
                </span>
              </button>
            ))}
          </div>
        </div>

        {d?.prompt && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>System prompt · read-only</span>
              <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 11.5, color: 'var(--text-muted)' }}>
                <Lock size={13} strokeWidth={1.75} />
                v2.4
              </span>
            </div>
            <div
              style={{
                padding: '10px 12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface-sunken)',
                fontFamily: 'var(--font-mono)',
                fontSize: 11.5,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {d.prompt}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: 'auto',
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--surface-sunken)',
        }}
      >
        <Button size="sm" variant="outline" onClick={() => nav(`${base}/conversations`)}>
          Recent conversations
        </Button>
        <Button size="sm" variant="ghost" onClick={() => nav(`${base}/traces/93c7a1f2`)}>
          Sample trace
        </Button>
      </div>
    </aside>
  );
}
