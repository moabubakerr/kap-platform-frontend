import type { SegState } from '@/mocks/data';

export const SEG_COLOR: Record<SegState, string> = { o: 'var(--success)', w: 'var(--warning)', f: 'var(--danger)', '-': 'var(--border-subtle)' };
export const SEG_LABEL: Record<SegState, string> = { o: 'Succeeded', w: 'Warning', f: 'Failed', '-': 'Not reached' };

/** Per-step segment strip used in run tables. */
export function RunSegments({ segs }: { segs: SegState[] }) {
  return (
    <div className="flex gap-[3px]">
      {segs.map((s, i) => (
        <span key={i} title={SEG_LABEL[s]} className="h-[5px] w-4 rounded-[2px]" style={{ background: SEG_COLOR[s] }} />
      ))}
    </div>
  );
}
