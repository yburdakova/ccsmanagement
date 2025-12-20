// src/pages/ProjectsPage/ProjectsPage.tsx
import { useEffect, useState } from 'react';
import './ProjectsPage.css';
import { apiRequest } from '../../services/apiClient';
import ManagePage from '../../layouts/ManagePageLayout/ManagePageLayout';
import type { Project, ProjectFormLookups, ProjectFormValue } from '../../types/project.types';
import ProjectForm from '../../components/ProjectForm/ProjectForm';



const emptyFormValue: ProjectFormValue = {
  name: '',
  type_code: '',
  project_status_id: null,
  customer_id: null,
  item_id: null,
  unit_id: null
};

const ProjectsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formValue, setFormValue] = useState<ProjectFormValue>(emptyFormValue);

  const [lookups, setLookups] = useState<ProjectFormLookups | null>(null);
  const [lookupsLoading, setLookupsLoading] = useState(false);
  const [lookupsError, setLookupsError] = useState<string | null>(null);

  // загрузка проектов
  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await apiRequest<Project[]>('/projects');
        setProjects(data);
      } catch (e) {
        console.error('Error loading projects:', e);
        setError('Unable to load projects. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        setLookupsLoading(true);
        setLookupsError(null);

        const data = await apiRequest<ProjectFormLookups>(
          '/lookups/project-form'
        );
        setLookups(data);
      } catch (e) {
        console.error('Error loading project form lookups:', e);
        setLookupsError('Unable to load form data.');
      } finally {
        setLookupsLoading(false);
      }
    };

    loadLookups();
  }, []);

  const handleAddClick = () => {
    setIsCreating(true);
    setIsEditing(false);
    setFormValue(emptyFormValue);
  };

  const handleEditClick = (project: Project) => {
    setIsEditing(true);
    setIsCreating(false);

    setFormValue({
      id: project.id,
      name: project.name,
      type_code: project.code,
      project_status_id: null,
      customer_id: null,
      item_id: null,
      unit_id: null, 
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setFormValue(emptyFormValue);
  };

  const handleSave = () => {
    console.log('Saving project...', formValue);
  };

  const listSlot = (
    <div className="project-table-wrapper">
      {loading && <div>Loading projects…</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && projects.length === 0 && (
        <div>No projects found.</div>
      )}

      {!loading && !error && projects.length > 0 && (
        <table className="project-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {projects.map((project, index) => (
              <tr key={project.id}>
                <td>{index + 1}</td>
                <td>{project.name}</td>
                <td>{project.code}</td>
                <td>{project.project_status}</td>
                <td>
                  <button
                    type="button"
                    className="btn-icon-small"
                    onClick={() => handleEditClick(project)}
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const formSlot =
    isCreating || isEditing ? (
      lookupsLoading && !lookups ? (
        <div className="form-placeholder">
          <h3>Loading form data…</h3>
        </div>
      ) : lookupsError && !lookups ? (
        <div className="form-placeholder error">
          <h3>Unable to load form data</h3>
          <p>{lookupsError}</p>
        </div>
      ) : lookups ? (
        <ProjectForm
          mode={isCreating ? 'create' : 'edit'}
          value={formValue}
          onChange={(patch) =>
            setFormValue((prev) => ({
              ...prev,
              ...patch,
            }))
          }
          typeOptions={lookups.projectTypes}
          statusOptions={lookups.statuses}
          customerOptions={lookups.customers}
          itemOptions={lookups.items}
          unitOptions={lookups.units}
          userOptions={lookups.users}
          roleOptions={lookups.roles}
          taskOptions={lookups.tasks}
        />
      ) : (
        <div className="form-placeholder">
          <h3>No form data</h3>
        </div>
      )
    ) : (
      <div className="form-placeholder">
        <h3>Select project</h3>
        <p>Please select a project from the list or create a new one.</p>
      </div>
    );

  return (
    <ManagePage
      title="Projects"
      isEditing={isEditing}
      isCreating={isCreating}
      onAdd={handleAddClick}
      onCancel={handleCancel}
      onSave={handleSave}
      listSlot={listSlot}
      formSlot={formSlot}
    />
  );
};

export default ProjectsPage;
