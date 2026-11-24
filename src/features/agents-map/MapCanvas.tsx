import { Layers } from 'lucide-react';
import type { AgentsMapData, MapEdge } from '@/mocks/agentsMap';
import { CANVAS_W, VIEW_H, canvasGeom } from './mapState';
import { MapNode } from './MapNode';
import { MapEdges } from './MapEdges';

const UPPER = { fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' } as const;

export function MapCanvas({
  data,
  live,
  selectedNodeId,
  highlightPath,
  showDeprecated,
  zoom,
  particles,
  liveMetricFor,
  onPick,
}: {
  data: AgentsMapData;
  live: boolean;
  selectedNodeId: string | null;
  highlightPath: boolean;
  showDeprecated: boolean;
  zoom: number;
  particles: boolean;
  liveMetricFor: (id: string, fallback: string) => string;
  onPick: (id: string) => void;
}) {
  const geom = canvasGeom(showDeprecated);
  const hl = new Set(data.highlightIds);
  const act = new Set(data.activeIds);
  const offPath = (id: string) => highlightPath && !hl.has(id);
  const edgeDim = (e: MapEdge) => highlightPath && !(hl.has(e.from) && hl.has(e.to));

  return (
    <div style={{ flex: '999 1 520px', minWidth: 0, position: 'relative', height: VIEW_H, overflow: 'auto', background: '#FCFBFA' }}>
      <div style={{ position: 'relative', width: CANVAS_W, height: geom.h, zoom }}>
        {data.laneBg.map((l) => (
          <div key={l.x} style={{ position: 'absolute', left: l.x, top: 0, width: l.w, height: '100%', background: l.bg, borderRight: '1px solid #F0ECEA' }} />
        ))}

        {/* Platform boundary between Channels and Queue */}
        <div style={{ position: 'absolute', left: 226, top: 0, width: 0, height: '100%', borderLeft: '1.5px dashed #A8A0A3' }} />
        <div
          style={{
            position: 'absolute',
            left: 234,
            top: geom.kapY,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          <Layers size={15} strokeWidth={1.75} />
          Runs on the KAP platform · SCEAI project
        </div>

        {data.lanes.map((l) => (
          <div key={l.n} style={{ position: 'absolute', left: l.x, top: 14, display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <span
              style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 600, color: 'var(--brand)', background: 'var(--brand-tint)', padding: '1px 5px', borderRadius: 3 }}
            >
              {l.n}
            </span>
            <span style={{ ...UPPER, color: 'var(--text-strong)' }}>{l.title}</span>
            {l.meta && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.meta}</span>}
          </div>
        ))}

        {/* "After the answer" group */}
        <div style={{ position: 'absolute', left: 1120, top: 504, width: 470, height: 200, border: '1.5px dashed #C9C2C0', borderRadius: 8, background: 'rgba(255,255,255,.5)' }} />
        <div style={{ position: 'absolute', left: 1132, top: 510, ...UPPER, color: 'var(--text-subtle)' }}>After the answer</div>

        <MapEdges edges={data.edges} height={geom.h} live={live} isDim={edgeDim} particles={particles} />

        {data.labels.map((b) => (
          <span
            key={b.text}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              fontSize: 11,
              fontWeight: 500,
              padding: '2px 7px',
              borderRadius: 'var(--r-sm)',
              background: 'var(--surface-card)',
              border: `1px solid ${b.border}`,
              color: b.color,
              whiteSpace: 'nowrap',
              opacity: offPath(b.node) ? 0.3 : 1,
              transition: 'opacity .2s',
            }}
          >
            {b.text}
          </span>
        ))}

        {data.nodes.map((n) => {
          const active = live && act.has(n.id);
          return (
            <MapNode
              key={n.id}
              node={n}
              selected={selectedNodeId === n.id}
              dim={offPath(n.id)}
              active={active}
              live={live}
              metric={live ? liveMetricFor(n.id, n.liveMetric) : n.histMetric}
              onPick={onPick}
            />
          );
        })}

        {showDeprecated && (
          <>
            <div
              style={{ position: 'absolute', left: 20, top: 860, width: 1570, height: 150, border: '1.5px dashed #C9C2C0', borderRadius: 8, background: 'rgba(240,236,234,.6)' }}
            />
            <div style={{ position: 'absolute', left: 34, top: 868, ...UPPER, color: 'var(--text-subtle)' }}>
              Retired v1 pipeline · replaced because free-form SQL and model arithmetic produced wrong numbers
            </div>
            {data.deprecated.map((d) => (
              <div
                key={d.name}
                style={{
                  position: 'absolute',
                  left: d.x,
                  top: 896,
                  width: 220,
                  padding: '10px 12px',
                  background: 'var(--surface-card)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: '3px solid #A8A0A3',
                  borderRadius: 6,
                  opacity: 0.65,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)', textDecoration: 'line-through' }}>{d.name}</span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: 'var(--neutral-100)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Deprecated
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{d.desc}</div>
                <div style={{ fontSize: 11, color: 'var(--danger-fg)', marginTop: 4 }}>{d.why}</div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
