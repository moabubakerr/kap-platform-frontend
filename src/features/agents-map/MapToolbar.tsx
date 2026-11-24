import * as React from 'react';
import { Maximize2, Route, ZoomIn, ZoomOut } from 'lucide-react';
import { MODES, type MapMode } from './mapState';

const SW = 1.75;

/** Page header: title, live badge, description and the Live | 1 h | 24 h | 7 d switch. */
export function MapHeader({ mode, inFlight, onMode }: { mode: MapMode; inFlight: number; onMode: (m: MapMode) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 300 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap', flex: 'none' }}>Agents map</h1>
          {mode === 'live' && (
            <span
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--success-fg)',
                background: 'var(--success-bg)',
                padding: '3px 8px',
                borderRadius: 'var(--r-sm)',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }} />
              Live · {inFlight} in flight
            </span>
          )}
        </div>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
          How an Ask AI request moves through the SCEAI pipeline on KAP, step by step. Select any step to inspect it.
        </p>
      </div>
      <div
        role="radiogroup"
        aria-label="Time range"
        style={{ display: 'flex', border: '1px solid var(--border-default)', borderRadius: 'var(--r-card)', overflow: 'hidden', background: 'var(--surface-card)' }}
      >
        {MODES.map((o, i) => {
          const on = mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onMode(o.key)}
              className="focus-visible:shadow-focus focus-visible:outline-none"
              style={{
                whiteSpace: 'nowrap',
                padding: '7px 12px',
                fontSize: 13,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: on ? 'var(--brand)' : 'transparent',
                color: on ? '#fff' : 'var(--text-body)',
                fontWeight: on ? 600 : 400,
                borderLeft: i ? '1px solid var(--border-subtle)' : undefined,
              }}
            >
              {o.key === 'live' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'currentColor' }} />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const ZBTN: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 30, height: 30, cursor: 'pointer', color: 'var(--text-body)' };

/** Map card toolbar: summary, Highlight path, Deprecated v1, zoom group. */
export function MapToolbar({
  highlightPath,
  showDeprecated,
  zoom,
  onHighlight,
  onDeprecated,
  onZoomOut,
  onZoomIn,
  onFit,
}: {
  highlightPath: boolean;
  showDeprecated: boolean;
  zoom: number;
  onHighlight: () => void;
  onDeprecated: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onFit: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontWeight: 600, color: 'var(--text-strong)', whiteSpace: 'nowrap' }}>Ask AI pipeline</span>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>8 AI agents · 8 code steps · 3 models</span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        aria-pressed={highlightPath}
        onClick={onHighlight}
        className="focus-visible:shadow-focus focus-visible:outline-none"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          height: 30,
          padding: '0 10px',
          border: `1px solid ${highlightPath ? 'var(--brand)' : 'var(--border-default)'}`,
          borderRadius: 'var(--r-sm)',
          background: highlightPath ? 'var(--brand-tint)' : 'var(--surface-card)',
          color: highlightPath ? 'var(--brand-strong)' : 'var(--text-body)',
          fontSize: 12.5,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        <Route size={15} strokeWidth={SW} />
        {highlightPath ? 'Highlighting message 7f21a9' : 'Highlight path: none'}
      </button>
      <button
        type="button"
        role="switch"
        aria-checked={showDeprecated}
        onClick={onDeprecated}
        className="focus-visible:shadow-focus focus-visible:outline-none"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          height: 30,
          padding: '0 10px',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--r-sm)',
          background: 'transparent',
          color: 'var(--text-body)',
          fontSize: 12.5,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
        }}
      >
        <span style={{ width: 26, height: 14, borderRadius: 7, background: showDeprecated ? 'var(--brand)' : 'var(--border-strong)', position: 'relative', flex: 'none' }}>
          <span
            style={{ position: 'absolute', top: 2, left: showDeprecated ? 14 : 2, width: 10, height: 10, borderRadius: '50%', background: '#fff', transition: 'left .15s' }}
          />
        </span>
        Deprecated v1
      </button>
      <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 'var(--r-sm)', overflow: 'hidden' }}>
        <button type="button" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out" style={ZBTN} className="hover:bg-surface-hover">
          <ZoomOut size={15} strokeWidth={SW} />
        </button>
        <span
          style={{
            minWidth: 46,
            textAlign: 'center',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            borderLeft: '1px solid var(--border-subtle)',
            borderRight: '1px solid var(--border-subtle)',
            lineHeight: '30px',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button type="button" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in" style={ZBTN} className="hover:bg-surface-hover">
          <ZoomIn size={15} strokeWidth={SW} />
        </button>
        <button
          type="button"
          onClick={onFit}
          title="Fit to view"
          aria-label="Fit to view"
          style={{ ...ZBTN, borderLeft: '1px solid var(--border-subtle)' }}
          className="hover:bg-surface-hover"
        >
          <Maximize2 size={15} strokeWidth={SW} />
        </button>
      </div>
    </div>
  );
}
