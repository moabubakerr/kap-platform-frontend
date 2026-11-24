import { LiveBanner, type Live } from '@/v35/live';

/** Live-data banner above an Agents hub page (sandbox only). */
export function AgentsLiveBanner({ live, what = 'agents' }: { live: Live; what?: string }) {
  if (!live.on) return null;
  return (
    <div className="max-w-[1440px] px-8 pt-3">
      <LiveBanner live={live} what={what} />
    </div>
  );
}
