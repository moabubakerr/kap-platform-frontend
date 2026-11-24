import { useParams } from 'react-router-dom';
import { IndicatorsView } from './IndicatorsView';

export default function IndicatorDetailPage() {
  const { indicatorId } = useParams();
  return <IndicatorsView code={indicatorId ?? ''} />;
}
