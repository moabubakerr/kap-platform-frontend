import * as React from 'react';
import { ProjectPage } from '@/app/shell/AppShell';
import { EmptyState, Skeleton } from '@/components/common/primitives';
import { useAgentsMap, useLiveEvents } from '@/api/agentsMap';
import { RANGE_LABEL, VIEW_H, ZOOM_FIT, useReducedMotion, zoomStep, type MapMode } from './mapState';
import { MapHeader, MapToolbar } from './MapToolbar';
import { MapCanvas } from './MapCanvas';
import { MapDrawer } from './MapDrawer';
import { MapFooter } from './MapFooter';

/** Agents map — the Ask AI pipeline on KAP (README §8.2). */
export default function AgentsMapPage() {
  // Client state per README §10.
  const [mode, setMode] = React.useState<MapMode>('live');
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [highlightPath, setHighlightPath] = React.useState(false);
  const [showDeprecated, setShowDeprecated] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);

  const { data, isLoading, isError } = useAgentsMap();
  const live = mode === 'live';
  const liveSnap = useLiveEvents(live);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    if (!selectedNodeId) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedNodeId(null);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [selectedNodeId]);

  const liveMetricFor = React.useCallback(
    (id: string, fallback: string) => (id === 'queue' ? `${liveSnap.inFlight} in flight · ${liveSnap.waiting} waiting` : fallback),
    [liveSnap],
  );

  const selected = data && selectedNodeId ? data.nodes.find((n) => n.id === selectedNodeId) : undefined;

  return (
    <ProjectPage resource="agents">
      <div style={{ padding: '12px 32px 32px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MapHeader mode={mode} inFlight={liveSnap.inFlight} onMode={setMode} />

        {isError ? (
          <EmptyState title="Could not load the agents map" body="The pipeline topology is unavailable. Try again in a moment." />
        ) : (
          <div
            style={{
              background: 'var(--surface-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--r-card)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MapToolbar
              highlightPath={highlightPath}
              showDeprecated={showDeprecated}
              zoom={zoom}
              onHighlight={() => setHighlightPath((v) => !v)}
              onDeprecated={() => setShowDeprecated((v) => !v)}
              onZoomOut={() => setZoom((z) => zoomStep(z, -1))}
              onZoomIn={() => setZoom((z) => zoomStep(z, 1))}
              onFit={() => setZoom(ZOOM_FIT)}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {isLoading || !data ? (
                <div style={{ flex: 1, height: VIEW_H, padding: 16 }}>
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <>
                  <MapCanvas
                    data={data}
                    live={live}
                    selectedNodeId={selectedNodeId}
                    highlightPath={highlightPath}
                    showDeprecated={showDeprecated}
                    zoom={zoom}
                    particles={!reduceMotion}
                    liveMetricFor={liveMetricFor}
                    onPick={setSelectedNodeId}
                  />
                  {selected && (
                    <MapDrawer data={data} node={selected} rangeLabel={RANGE_LABEL[mode]} onSelect={setSelectedNodeId} onClose={() => setSelectedNodeId(null)} />
                  )}
                </>
              )}
            </div>
            <MapFooter live={live} ticker={liveSnap.ticker} />
          </div>
        )}
      </div>
    </ProjectPage>
  );
}
