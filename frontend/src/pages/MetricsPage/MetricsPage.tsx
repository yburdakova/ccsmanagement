import MetricsView from './MetricsView';
import './MetricsPage.css';

const MetricsPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = Number(user?.id);
  if (!userId) {
    return <div className="metrics-page__error">Missing user session.</div>;
  }
  return <MetricsView userId={userId} title="Metrics" />;
};

export default MetricsPage;
