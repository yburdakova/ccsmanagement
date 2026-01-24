
import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import type { Project } from '../../types/project.types';
import './DashboardPage.css';

type StatusSummary = {
  id: number | null;
  label: string;
  count: number;
};

const DashboardPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [statusSummary, setStatusSummary] = useState<StatusSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<Project[]>('/projects');
        setProjects(data);
      } catch (e) {
        console.error('Error loading projects:', e);
        setError('Unable to load projects.');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    const loadSummary = async () => {
      if (!selectedProjectId) {
        setStatusSummary([]);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<StatusSummary[]>(
          `/items/status-summary?projectId=${selectedProjectId}`
        );
        setStatusSummary(data);
      } catch (e) {
        console.error('Error loading status summary:', e);
        setError('Unable to load inventory status summary.');
      } finally {
        setLoading(false);
      }
    };

    loadSummary();
  }, [selectedProjectId]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header">
        <h2>Dashboard</h2>
        <div className="dashboard-page__selector">
          <label htmlFor="dashboard-project-select">Project</label>
          <select
            id="dashboard-project-select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={loading}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="dashboard-page__error">{error}</div>}

      {selectedProjectId && (
        <div className="dashboard-page__summary">
          <div className="dashboard-page__summary-header">
            <span>Status</span>
            <span>Count</span>
          </div>
          {statusSummary.length === 0 && !loading ? (
            <div className="dashboard-page__summary-row">
              <span>No inventory statuses yet.</span>
            </div>
          ) : (
            statusSummary.map((row) => (
              <div key={row.id ?? row.label} className="dashboard-page__summary-row">
                <span>{row.label}</span>
                <span>{row.count}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
