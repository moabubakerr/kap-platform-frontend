import { useParams } from 'react-router-dom';
import { useCrumbs } from '@/app/shell/crumbs';
import { ScreenView } from '@/engine/ScreenView';
import { LiveBanner } from '@/v35/live';
import { SOURCE_TABS, sourceScreen } from './build';
import { srcOf } from './logic';
import { pgOfSource } from './pgView';
import { pgCrumb, PgSourceView } from './PgSourceView';
import { useIngest } from './useIngest';

/**
 * Data source detail (route /sources/:sourceId/:tab?): Overview · Connection Settings · Browse / Test · Used by Pipelines · Activity.
 * Live tenant, PostgreSQL source (platform API): connection, tables, datasets; tab `dataset-<id>` opens one dataset.
 */
export default function SourcePage() {
  const { sourceId = '', tab } = useParams();
  const c = useIngest();
  const s = srcOf(c.H, sourceId);
  const pg = pgOfSource(s);
  const model = pg ? null : sourceScreen(c, sourceId, tab, (v) => c.go.source(sourceId, v));
  useCrumbs([sourceId, pg ? pgCrumb(c, tab) : model?.head.tabs ? SOURCE_TABS.find((x) => x.value === model.head.tab)?.label : undefined]);
  if (pg && s) return <PgSourceView c={c} s={s} tab={tab} />;
  return (
    <>
      <LiveBanner live={c.liveState} what="data sources (KAP connectors)" />
      <ScreenView model={model!} />
    </>
  );
}
