import * as React from 'react';
import { Cog, Cpu, Database, FileText, Globe, Layers, MessageSquare, Terminal } from 'lucide-react';
import { AiMark } from '@/components/common/primitives';
import { NODE_W, nodeHeight, type MapNode as MapNodeT, type MapNodeType } from '@/mocks/agentsMap';

const SW = 1.75;

/** Icon for a node (tile on canvas, larger in the drawer). */
export function NodeIcon({ node, size }: { node: Pick<MapNodeT, 'id' | 'type'>; size: number }) {
  const { id, type: t } = node;
  if (t === 'ai') return <AiMark size={size} />;
  if (t === 'code') return id === 'template' ? <FileText size={size} strokeWidth={SW} /> : <Cog size={size} strokeWidth={SW} />;
  if (t === 'queue') return <Layers size={size} strokeWidth={SW} />;
  if (t === 'ext') return <Globe size={size} strokeWidth={SW} />;
  if (t === 'store') return <Database size={size} strokeWidth={SW} />;
  if (t === 'model') return <Cpu size={size} strokeWidth={SW} />;
  return id === 'api' ? <Terminal size={size} strokeWidth={SW} /> : <MessageSquare size={size} strokeWidth={SW} />;
}

export const healthColor = (id: string) => (id === 'oxmcp' ? 'var(--warning)' : id === 'template' ? '#A8A0A3' : 'var(--success)');

function tagFor(id: string, t: MapNodeType) {
  if (id === 'picker' || id === 'template') return 'Fallback';
  if (id === 'followup' || id === 'reader') return 'Side agent';
  if (id === 'pa_local' || id === 'pa_ox') return 'planner_and_executor';
  if (t === 'model') return 'Model';
  if (t === 'ext') return 'External';
  return '';
}

export function MapNode({
  node,
  selected,
  dim,
  active,
  live,
  metric,
  onPick,
}: {
  node: MapNodeT;
  selected: boolean;
  dim: boolean;
  /** Live and carrying traffic. */
  active: boolean;
  live: boolean;
  metric: string;
  onPick: (id: string) => void;
}) {
  const [hover, setHover] = React.useState(false);
  const { id, type: t } = node;
  const ai = t === 'ai';
  const h = nodeHeight(t);
  const tag = tagFor(id, t);
  const fallback = id === 'picker' || id === 'template';

  const baseBorder = selected ? 'var(--brand)' : t === 'model' ? '#C8B49A' : t === 'ext' ? '#0F766E' : 'var(--border-default)';
  const bc = hover ? 'var(--brand)' : baseBorder;
  const bs = t === 'ext' ? 'dashed' : 'solid';
  const bg = t === 'code' || t === 'queue' ? 'var(--surface-sunken)' : t === 'model' ? 'var(--sand-tint)' : t === 'ext' ? 'var(--teal-tint)' : 'var(--surface-card)';
  const ibg = ai ? '#F6E8EC' : t === 'model' || t === 'store' || t === 'ext' ? '#fff' : '#E4DFDD';
  const ifg = ai ? '#8A1538' : t === 'model' ? 'var(--sand-ink)' : t === 'ext' ? '#0F766E' : 'var(--text-muted)';
  const shadow = selected ? '0 0 0 2px var(--brand), 0 4px 12px rgba(31,26,28,.08)' : active ? '0 0 0 3px rgba(138,21,56,.10)' : '0 1px 2px rgba(31,26,28,.05)';
  const mc = live && active ? 'var(--brand)' : (id === 'composer' || id === 'verifier') && !live ? 'var(--warning-fg)' : 'var(--text-muted)';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={node.name}
      onClick={() => onPick(id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPick(id);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: NODE_W,
        minHeight: h,
        background: bg,
        border: `1px ${bs} ${bc}`,
        borderLeft: ai ? `4px solid ${hover ? 'var(--brand)' : '#8A1538'}` : `1px ${bs} ${bc}`,
        borderRadius: ai ? 8 : t === 'code' ? 2 : 8,
        boxShadow: shadow,
        opacity: dim ? 0.3 : 1,
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        transition: 'opacity .2s, box-shadow .2s',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 10px 7px' }}>
        <span
          style={{ width: 26, height: 26, borderRadius: ai ? '50%' : t === 'code' ? 2 : 6, background: ibg, color: ifg, display: 'grid', placeItems: 'center', flex: 'none' }}
        >
          <NodeIcon node={node} size={14} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)', lineHeight: 1.25, flex: 1, minWidth: 0 }}>{node.name}</span>
            <span title={id === 'oxmcp' ? 'Degraded' : 'Healthy'} style={{ width: 7, height: 7, borderRadius: '50%', background: healthColor(id), flex: 'none' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, marginTop: 2 }}>{node.sub}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '0 10px 7px' }}>
        {node.chip && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, padding: '1px 6px', borderRadius: 3, background: '#F6E8EC', color: '#6B0F2B' }}>{node.chip}</span>
        )}
        {tag && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              padding: '1px 6px',
              borderRadius: 3,
              background: fallback ? 'var(--warning-bg)' : 'var(--surface-sunken)',
              color: fallback ? 'var(--warning-fg)' : 'var(--text-muted)',
            }}
          >
            {tag}
          </span>
        )}
      </div>
      <div
        style={{
          marginTop: 'auto',
          padding: '6px 10px',
          borderTop: '1px solid #F0ECEA',
          fontSize: 11,
          color: mc,
          fontWeight: live && active ? 600 : 400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {metric}
      </div>
    </div>
  );
}
