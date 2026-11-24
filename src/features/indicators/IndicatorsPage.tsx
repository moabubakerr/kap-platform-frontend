import { IndicatorsView } from './IndicatorsView';
import { INDICATOR_LIST } from '@/mocks/catalogue';

/** List view opens on the first indicator, as in the design. */
export default function IndicatorsPage() {
  return <IndicatorsView code={INDICATOR_LIST[0]} />;
}
