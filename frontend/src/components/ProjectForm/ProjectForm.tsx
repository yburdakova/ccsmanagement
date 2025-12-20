import React, { useState } from 'react';
import type { ProjectFormProps, TaskRow, TeamRow } from '../../types/project.types';
import './ProjectForm.css';

const ProjectForm: React.FC<ProjectFormProps> = ({
    mode,
    value,
    onChange,
    typeOptions,
    statusOptions,
    customerOptions,
    itemOptions,
    unitOptions,
    userOptions,
    roleOptions,
    taskOptions,
}) => {
    const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
    const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
    const [openRolesTaskId, setOpenRolesTaskId] = useState<string | null>(null);

    const handleGeneralChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = e.target;

       if (
            name === 'project_status_id' ||
            name === 'customer_id' ||
            name === 'item_id' ||
            name === 'unit_id'
        ) {
            onChange({ [name]: value === '' ? null : Number(value) });
        } else {
            onChange({ [name]: value });
        }

    };

    const handleAddTeamRow = () => {
        setTeamRows((prev) => [
        ...prev,
        {
            id: crypto.randomUUID(),
            userId: '',
            roleId: '',
        },
        ]);
    };

    const handleTeamFieldChange = (
        rowId: string,
        field: keyof TeamRow,
        fieldValue: string
    ) => {
        setTeamRows((prev) =>
        prev.map((row) =>
            row.id === rowId ? { ...row, [field]: fieldValue } : row
        )
        );
    };

    const handleRemoveTeamRow = (rowId: string) => {
        setTeamRows((prev) => prev.filter((row) => row.id !== rowId));
    };

        
    const handleAddTaskRow = () => {
        setTaskRows((prev) => [
            ...prev,
            {
            id: crypto.randomUUID(),
            taskId: '',
            rolesId: [],
            },
        ]);
    };

    const handleTaskFieldChange = (
    rowId: string,
    field: keyof TaskRow,
    fieldValue: string | string[],
    ) => {
    setTaskRows((prev) =>
        prev.map((row) =>
        row.id === rowId ? { ...row, [field]: fieldValue } : row
        )
    );
    };


const handleTaskRoleToggle = (
    rowId: string,
    roleId: string,
    checked: boolean
) => {
    setTaskRows(prev =>
        prev.map(row => {
            if (row.id !== rowId) return row;

            const updated = new Set(row.rolesId);
            if (checked) updated.add(roleId);
            else updated.delete(roleId);

            return { ...row, roleIds: Array.from(updated) };
        })
    );
};

const handleRemoveTaskRow = (rowId: string) => {
    setTaskRows(prev => prev.filter(r => r.id !== rowId));

    // Если был открыт dropdown — закрыть
    if (openRolesTaskId === rowId) {
        setOpenRolesTaskId(null);
    }
};


    return (
        <div className="project-form">
        <h3>{mode === 'create' ? 'Create new project' : 'Edit project'}</h3>

        {/* 1. GENERAL INFO */}
            <section className="project-form__section">
            <h4>General info</h4>

            <div className="project-form__grid">
                <div className="project-form__field">
                <label htmlFor="name">Title</label>
                <input
                    id="name"
                    name="name"
                    type="text"
                    value={value.name}
                    onChange={handleGeneralChange}
                />
                </div>

                <div className="project-form__field">
                <label htmlFor="type_code">Type</label>
                <select
                    id="type_code"
                    name="type_code"
                    value={value.type_code}
                    onChange={handleGeneralChange}
                >
                    <option value="">Select type…</option>
                    {typeOptions.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                        {opt.label}
                    </option>
                    ))}
                </select>
                </div>

                <div className="project-form__field">
                <label htmlFor="customer_id">Customer</label>
                <select
                    id="customer_id"
                    name="customer_id"
                    value={value.customer_id ?? ''}
                    onChange={handleGeneralChange}
                >
                    <option value="">No customer</option>
                    {customerOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.name}
                    </option>
                    ))}
                </select>
                </div>

                <div className="project-form__field">
                <label htmlFor="project_status_id">Status</label>
                <select
                    id="project_status_id"
                    name="project_status_id"
                    value={value.project_status_id ?? ''}
                    onChange={handleGeneralChange}
                >
                    <option value="">Select status…</option>
                    {statusOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.label}
                    </option>
                    ))}
                </select>
                </div>

                <div className="project-form__field">
                <label htmlFor="item_id">Item</label>
                <select
                    id="item_id"
                    name="item_id"
                    value={value.item_id ?? ''}
                    onChange={handleGeneralChange}
                >
                    <option value="">No item</option>
                    {itemOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.name}
                    </option>
                    ))}
                </select>
                </div>

                <div className="project-form__field">
                <label htmlFor="unit_id">Unit</label>
                <select
                    id="unit_id"
                    name="unit_id"
                    value={value.unit_id ?? ''}
                    onChange={handleGeneralChange}
                >
                    <option value="">No unit</option>
                    {unitOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                        {opt.name}
                    </option>
                    ))}
                </select>
                </div>
            </div>
            </section>

            {/* 2. TEAM */}
            <section className="project-form__section">
            <div className="project-form__section-header">
                <h4>Team</h4>

                <div className="project-team__actions">
                    <button
                        type="button"
                        className="btn-icon-square"
                        onClick={handleAddTeamRow}
                        title="Add member"
                    >
                        <span className="material-symbols-outlined">group_add</span>
                    </button>
                </div>
            </div>

            {teamRows.length === 0 ? (
                <div className="project-form__hint">
                No team members yet. Click “Add member” to start.
                </div>
            ) : (
                <div className="project-team-rows">
                <div className="project-team-row project-team-row--header">
                    <div>#</div>
                    <div>Member</div>
                    <div>Role</div>
                    <div></div>
                </div>

                {teamRows.map((row, index) => (
                    <div key={row.id} className="project-team-row">
                    <div>{index + 1}</div>

                    <div>
                        <select
                        value={row.userId}
                        onChange={(e) =>
                            handleTeamFieldChange(row.id, 'userId', e.target.value)
                        }
                        >
                        <option value="">Select user…</option>
                        {userOptions.map((u) => (
                            <option key={u.id} value={u.id}>
                            {u.fullName}
                            </option>
                        ))}
                        </select>
                    </div>

                    <div>
                        <select
                        value={row.roleId}
                        onChange={(e) =>
                            handleTeamFieldChange(row.id, 'roleId', e.target.value)
                        }
                        >
                        <option value="">Select role…</option>
                        {roleOptions.map((r) => (
                            <option key={r.id} value={r.id}>
                            {r.label}
                            </option>
                        ))}
                        </select>
                    </div>

                    <div>
                        <button
                        type="button"
                        className="btn-icon-small"
                        onClick={() => handleRemoveTeamRow(row.id)}
                        >
                        <span className="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}
            </section>


            {/* 3. TASKS */}
            <section className="project-form__section">
            <div className="project-form__section-header">
                <h4>Tasks</h4>

                <div className="project-team__actions">
                <button
                    type="button"
                    className="btn-icon-square"
                    onClick={handleAddTaskRow}
                    title="Add task"
                >
                    <span className="material-symbols-outlined">add_task</span>
                </button>
                </div>
            </div>

            {taskRows.length === 0 ? (
                <div className="project-form__hint">
                No tasks added yet. Click “Add task” to start.
                </div>
            ) : (
                <div className="project-task-rows">
                <div className="project-task-row project-task-row--header">
                    <div>#</div>
                    <div>Task</div>
                    <div>Roles</div>
                    <div></div>
                </div>

                {taskRows.map((row, index) => {
                    const selectedLabels =
                    row.rolesId.length === 0
                        ? 'Select roles…'
                        : roleOptions
                            .filter((r) => row.rolesId.includes(String(r.id)))
                            .map((r) => r.label)
                            .join(', ');

                    return (
                    <div key={row.id} className="project-task-row">

                        <div>{index + 1}</div>

                        <div>
                        <select
                            value={row.taskId}
                            onChange={(e) =>
                            handleTaskFieldChange(row.id, 'taskId', e.target.value)
                            }
                        >
                            <option value="">Select task…</option>
                            {taskOptions.map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.description}
                            </option>
                            ))}
                        </select>
                        </div>

                        <div className="roles-select-cell">
                        <button
                            type="button"
                            className="roles-select-trigger"
                            onClick={() =>
                            setOpenRolesTaskId(
                                openRolesTaskId === row.id ? null : row.id
                            )}
                        >
                            <span className="roles-select-label">{selectedLabels}</span>
                            <span className="material-symbols-outlined">
                            arrow_drop_down
                            </span>
                        </button>

                        {openRolesTaskId === row.id && (
                            <div className="roles-select-dropdown">
                            {roleOptions.map((r) => {
                                const id = String(r.id);
                                const checked = row.rolesId.includes(id);

                                return (
                                <label
                                    key={r.id}
                                    className="roles-select-option"
                                >
                                    <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                        handleTaskRoleToggle(
                                        row.id,
                                        id,
                                        e.target.checked
                                        )
                                    }
                                    />
                                    {r.label}
                                </label>
                                );
                            })}
                            </div>
                        )}
                        </div>

                        <div>
                        <button
                            type="button"
                            className="btn-icon-small"
                            onClick={() => handleRemoveTaskRow(row.id)}
                        >
                            <span className="material-symbols-outlined">delete</span>
                        </button>
                        </div>
                    </div>
                    );
                })}
                </div>
            )}
            </section>

        </div>
    );
};

export default ProjectForm;
