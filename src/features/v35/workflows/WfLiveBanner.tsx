import { WF_FEATURE_MISSING } from '@/api/platformWf';
import type { WfHub } from './useWorkflows';

/** Strip above the workflow pages on the live tenant: where workflows come from, or what is missing. */
export function WfLiveBanner({ c }: { c: WfHub }) {
  const L = c.live;
  if (!L) return null;
  const tone = L.missing ? 'bg-warning-bg text-warning-fg' : L.error ? 'bg-danger-bg text-danger-fg' : 'bg-info-bg text-info';
  const text = L.missing
    ? WF_FEATURE_MISSING
    : L.error
      ? `Could not load workflows from the platform API: ${L.error}`
      : L.loading
        ? 'Loading workflows from the platform API…'
        : 'Live: workflows are stored and run by the platform. Agent steps run as real KAP jobs; tests in the designer are real runs.';
  return (
    <div className="max-w-[1440px] px-8 pt-3">
      <div className={`flex items-center gap-3 rounded-sm px-3 py-2 text-[13px] ${tone}`}>
        <span className="flex-1">{text}</span>
        <button type="button" className="font-medium underline" onClick={() => void L.reload()}>
          Refresh
        </button>
      </div>
    </div>
  );
}
