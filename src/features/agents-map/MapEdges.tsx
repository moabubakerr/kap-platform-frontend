import type { MapEdge } from '@/mocks/agentsMap';
import { CANVAS_W } from './mapState';

const MAROON = '#8A1538';
const TEAL = '#0F766E';

/**
 * SVG edges. Live: active edges maroon (teal for Oxford) with travelling
 * particles, idle edges #CFC8C6. Historical: width = volume, fallback edges
 * amber, external (Oxford) edges red.
 */
export function MapEdges({
  edges,
  height,
  live,
  isDim,
  particles,
}: {
  edges: MapEdge[];
  height: number;
  live: boolean;
  isDim: (e: MapEdge) => boolean;
  particles: boolean;
}) {
  return (
    <svg width={CANVAS_W} height={height} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }} aria-hidden>
      {edges.map((e) => {
        const dim = isDim(e);
        const on = live && e.active && !dim;
        const fb = (e.from === 'resolver' && e.to === 'picker') || (e.from === 'verifier' && e.to === 'template');
        const ext = e.to === 'oxmcp' || e.from === 'oxmcp';
        const w = live ? (on ? 2.5 : 1.5) : e.width;
        const c = live ? (on ? (ext ? TEAL : MAROON) : '#CFC8C6') : fb ? '#B7791F' : ext ? '#C0352B' : '#A8A0A3';
        const dur = (1.2 + (e.d.length % 5) * 0.15).toFixed(2) + 's';
        return (
          <g key={`${e.from}-${e.to}`}>
            <path
              d={e.d}
              fill="none"
              stroke={c}
              strokeWidth={w}
              strokeDasharray={e.dashed ? '6 4' : undefined}
              opacity={dim ? 0.15 : 1}
              strokeLinecap="round"
              style={{ transition: 'opacity .2s' }}
            />
            {on && particles && (
              <circle r={3.5} fill={ext ? TEAL : MAROON}>
                <animateMotion dur={dur} repeatCount="indefinite" path={e.d} />
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}
