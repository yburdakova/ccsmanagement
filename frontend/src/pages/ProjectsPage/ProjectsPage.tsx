// src/pages/ProjectsPage/ProjectsPage.tsx
import { useEffect, useState } from 'react';
import './ProjectsPage.css';
import { apiRequest } from '../../services/apiClient';
import ManagePage from '../../layouts/ManagePageLayout/ManagePageLayout';
import type { ItemTrackingRow, Project, ProjectFormLookups, ProjectFormValue, TaskRow, TeamRow } from '../../types/project.types';
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
  const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [itemTrackingRows, setItemTrackingRows] = useState<ItemTrackingRow[]>([]);

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
        let taskCategories = data.taskCategories ?? [];
        try {
          taskCategories = await apiRequest<ProjectFormLookups['taskCategories']>(
            '/lookups/task-categories'
          );
        } catch (e) {
          console.warn('Task categories lookup failed, falling back to project-form data.', e);
        }
        setLookups({
          ...data,
          taskCategories,
        });
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
    setTeamRows([]);
    setTaskRows([]);
    setItemTrackingRows([]);
  };

  const handleEditClick = async (project: Project) => {
    try {
      setIsEditing(true);
      setIsCreating(false);
      setLoading(true);
      setError(null);

      const detail = await apiRequest<{
        project: ProjectFormValue;
        team: { userId: number; roleId: number }[];
        tasks: {
          taskId: number;
          taskTitle: string;
          categoryId: number | null;
          rolesId: number[];
        }[];
        itemTracking?: {
          statusText: string | null;
          taskIds: number[];
          applyAfterFinish: number | null;
        }[];
      }>(`/projects/${project.id}`);

      setFormValue({
        id: detail.project.id,
        name: detail.project.name,
        type_code: detail.project.type_code,
        project_status_id: detail.project.project_status_id ?? null,
        customer_id: detail.project.customer_id ?? null,
        item_id: detail.project.item_id ?? null,
        unit_id: detail.project.unit_id ?? null,
      });

      setTeamRows(
        detail.team.map((row) => ({
          id: crypto.randomUUID(),
          userId: String(row.userId),
          roleId: String(row.roleId),
        }))
      );

      setTaskRows(
        detail.tasks.map((row) => ({
          id: crypto.randomUUID(),
          taskId: String(row.taskId),
          taskTitle: row.taskTitle,
          categoryId: row.categoryId ? String(row.categoryId) : '',
          rolesId: row.rolesId.map((roleId) => String(roleId)),
        }))
      );

      setItemTrackingRows(
        (detail.itemTracking ?? []).map((row) => ({
          id: crypto.randomUUID(),
          statusText: row.statusText ?? '',
          taskIds: row.taskIds.map((taskId) => String(taskId)),
          statusMoment: row.applyAfterFinish ? 'task_finished' : 'task_started',
        }))
      );
    } catch (e) {
      console.error('Error loading project details:', e);
      setError('Unable to load project details.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setFormValue(emptyFormValue);
    setTeamRows([]);
    setTaskRows([]);
    setItemTrackingRows([]);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload = {
        project: {
          ...formValue,
          project_status_id: formValue.project_status_id ?? null,
          customer_id: formValue.customer_id ?? null,
          item_id: formValue.item_id ?? null,
          unit_id: formValue.unit_id ?? null,
        },
        team: teamRows
          .filter((row) => row.userId && row.roleId)
          .map((row) => ({
            userId: Number(row.userId),
            roleId: Number(row.roleId),
          })),
        tasks: taskRows
          .filter((row) => row.taskTitle.trim() || row.taskId)
          .map((row) => ({
            taskId: row.taskId ? Number(row.taskId) : null,
            taskTitle: row.taskTitle.trim(),
            taskTempId: row.taskId ? null : row.id,
            categoryId: row.categoryId ? Number(row.categoryId) : null,
            rolesId: row.rolesId.map((roleId) => Number(roleId)),
          })),
        itemTracking: itemTrackingRows
          .filter((row) => row.statusText.trim() || row.taskIds.length > 0)
          .map((row) => ({
            statusText: row.statusText.trim(),
            statusMoment: row.statusMoment,
            taskRefs: row.taskIds.map((taskId) =>
              taskId.startsWith('new:')
                ? { taskTempId: taskId.slice(4) }
                : { taskId: Number(taskId) }
            ),
          })),
      };

      if (isEditing && formValue.id) {
        await apiRequest(`/projects/${formValue.id}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        await apiRequest('/projects', {
          method: 'POST',
          body: payload,
        });
      }

      const data = await apiRequest<Project[]>('/projects');
      setProjects(data);
      setIsCreating(false);
      setIsEditing(false);
      setFormValue(emptyFormValue);
      setTeamRows([]);
      setTaskRows([]);
      setItemTrackingRows([]);
    } catch (e) {
      console.error('Error saving project:', e);
      setError('Unable to save project. Please try again later.');
    } finally {
      setLoading(false);
    }
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
          onTeamRowsChange={setTeamRows}
          onTaskRowsChange={setTaskRows}
          initialTeamRows={teamRows}
          initialTaskRows={taskRows}
          initialItemTrackingRows={itemTrackingRows}
          typeOptions={lookups.projectTypes}
          statusOptions={lookups.statuses}
          customerOptions={lookups.customers}
          itemOptions={lookups.items}
          unitOptions={lookups.units}
          userOptions={lookups.users}
          roleOptions={lookups.roles}
          taskOptions={lookups.tasks}
          taskCategoryOptions={lookups.taskCategories}
          itemStatusOptions={lookups.itemStatuses}
          onItemTrackingRowsChange={setItemTrackingRows}
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
