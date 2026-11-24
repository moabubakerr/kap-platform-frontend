import { Cpu, Database } from 'lucide-react';
import type { TickerItem } from '@/mocks/agentsMap';

const ITEM = { display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' } as const;

/** Legend + live ticker (live) or edge-width note (historical). */
export function MapFooter({ live, ticker }: { live: boolean; ticker: TickerItem[] }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '10px 18px',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '9px 12px',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <span style={ITEM}>
        <span style={{ width: 14, height: 14, borderRadius: 4, border: '1px solid var(--border-default)', borderLeft: '3px solid #8A1538', background: '#fff' }} />
        AI agent
      </span>
      <span style={ITEM}>
        <span style={{ width: 14, height: 14, borderRadius: 1, border: '1px solid var(--border-default)', background: 'var(--surface-sunken)' }} />
        Code step
      </span>
      <span style={ITEM}>
        <Database size={16} strokeWidth={1.75} />
        Data store
      </span>
      <span style={ITEM}>
        <Cpu size={14} strokeWidth={1.75} />
        Model
      </span>
      <span style={ITEM}>
        <span style={{ width: 14, height: 14, borderRadius: 3, border: '1.5px dashed #0F766E', background: 'var(--teal-tint)' }} />
        External
      </span>
      <span style={ITEM}>
        <span style={{ width: 16, borderTop: '2px dashed #A8A0A3' }} />
        Fallback
      </span>
      <div style={{ flex: 1 }} />
      {live ? (
        <div aria-label="Messages in flight" style={{ display: 'flex', gap: 14, alignItems: 'center', overflow: 'hidden', minWidth: 0 }}>
          {ticker.map((t) => (
            <span
              key={t.text}
              style={{ ...ITEM, fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--text-body)' }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />
              {t.text}
            </span>
          ))}
        </div>
      ) : (
        <span style={{ whiteSpace: 'nowrap' }}>Edge width = message volume · amber/red = fallback or errors</span>
      )}
    </div>
  );
}
