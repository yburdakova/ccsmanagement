import React, { useEffect, useRef, useState } from 'react';
import type { ItemTrackingRow, ProjectFormProps, TaskRow, TeamRow } from '../../types/project.types';
import './ProjectForm.css';

const ProjectForm: React.FC<ProjectFormProps> = ({
    mode,
    value,
    onChange,
    onTeamRowsChange,
    onTaskRowsChange,
    onItemTrackingRowsChange,
    initialTeamRows,
    initialTaskRows,
    initialItemTrackingRows,
    typeOptions,
    statusOptions,
    customerOptions,
    itemOptions,
    unitOptions,
    userOptions,
    roleOptions,
    taskOptions,
    taskCategoryOptions,
    itemStatusOptions,
    taskDataDefinitions,
    onCreateTaskDataDefinition,
}) => {
    const safeTaskOptions = taskOptions ?? [];
    const safeTaskCategoryOptions = taskCategoryOptions ?? [];
    const safeItemStatusOptions = itemStatusOptions ?? [];
    const safeTaskDataDefinitions = taskDataDefinitions ?? [];
    const [teamRows, setTeamRows] = useState<TeamRow[]>([]);
    const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
    const [itemTrackingRows, setItemTrackingRows] = useState<ItemTrackingRow[]>([]);
    const [openRolesTaskId, setOpenRolesTaskId] = useState<string | null>(null);
    const [taskRoleDrafts, setTaskRoleDrafts] = useState<Record<string, string[]>>({});
    const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
    const [openItemTrackingTaskId, setOpenItemTrackingTaskId] = useState<string | null>(null);
    const [itemTrackingTaskDrafts, setItemTrackingTaskDrafts] = useState<Record<string, string[]>>({});
    const [focusedStatusId, setFocusedStatusId] = useState<string | null>(null);
    const syncingTeamRef = useRef(false);
    const syncingTaskRef = useRef(false);
    const lastTeamKeyRef = useRef('');
    const lastTaskKeyRef = useRef('');
    const lastItemTrackingKeyRef = useRef('');

    const getTeamKey = (rows: TeamRow[]) =>
        rows.map((row) => `${row.id}:${row.userId}:${row.roleId}`).join('|');
    const getTaskKey = (rows: TaskRow[]) =>
        rows
            .map(
                (row) =>
                    `${row.id}:${row.taskId}:${row.taskTitle}:${row.categoryId}:` +
                    row.rolesId.join(',') +
                    ':' +
                    (row.taskData || [])
                        .map(
                            (data) =>
                                `${data.id}:${data.dataDefId}:${data.valueType}:${data.value}:${data.isRequired ? 1 : 0}`
                        )
                        .join(',')
            )
            .join('|');
    const getItemTrackingKey = (rows: ItemTrackingRow[]) =>
        rows
            .map(
                (row) =>
                    `${row.id}:${row.statusText}:${row.taskIds.join(',')}:${row.statusMoment}`
            )
            .join('|');

    const itemTrackingTaskOptions = taskRows
        .filter((row) => row.taskTitle.trim() || row.taskId)
        .map((row) => ({
            value: row.taskId ? row.taskId : `new:${row.id}`,
            label: row.taskTitle.trim() || `Task ${row.taskId || ''}`.trim(),
        }));

    useEffect(() => {
        if (!initialTeamRows) return;
        const nextKey = getTeamKey(initialTeamRows);
        if (nextKey === lastTeamKeyRef.current) return;
        const currentKey = getTeamKey(teamRows);
        if (nextKey === currentKey) {
            lastTeamKeyRef.current = nextKey;
            return;
        }
        syncingTeamRef.current = true;
        lastTeamKeyRef.current = nextKey;
        setTeamRows(initialTeamRows);
    }, [initialTeamRows, teamRows]);

    useEffect(() => {
        if (!initialTaskRows) return;
        const nextKey = getTaskKey(initialTaskRows);
        if (nextKey === lastTaskKeyRef.current) return;
        const currentKey = getTaskKey(taskRows);
        if (nextKey === currentKey) {
            lastTaskKeyRef.current = nextKey;
            return;
        }
        syncingTaskRef.current = true;
        lastTaskKeyRef.current = nextKey;
        setTaskRows(initialTaskRows);
    }, [initialTaskRows, taskRows]);

    useEffect(() => {
        if (!initialItemTrackingRows) return;
        const nextKey = getItemTrackingKey(initialItemTrackingRows);
        if (nextKey === lastItemTrackingKeyRef.current) return;
        const currentKey = getItemTrackingKey(itemTrackingRows);
        if (nextKey === currentKey) {
            lastItemTrackingKeyRef.current = nextKey;
            return;
        }
        lastItemTrackingKeyRef.current = nextKey;
        setItemTrackingRows(initialItemTrackingRows);
    }, [initialItemTrackingRows, itemTrackingRows]);

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
            taskTitle: '',
            categoryId: '',
            rolesId: [],
            taskData: [],
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

    const handleTaskDataAddRow = (rowId: string) => {
        setTaskRows((prev) =>
            prev.map((row) =>
                row.id === rowId
                    ? {
                        ...row,
                        taskData: [
                            ...row.taskData,
                            {
                                id: crypto.randomUUID(),
                                dataDefId: '',
                                valueType: '',
                                value: '',
                                isRequired: false,
                            },
                        ],
                    }
                    : row
            )
        );
    };

    const handleTaskDataRemoveRow = (taskRowId: string, dataRowId: string) => {
        setTaskRows((prev) =>
            prev.map((row) =>
                row.id === taskRowId
                    ? { ...row, taskData: row.taskData.filter((data) => data.id !== dataRowId) }
                    : row
            )
        );
    };

    const handleTaskDataDefinitionChange = async (
        taskRowId: string,
        dataRowId: string,
        nextDefId: string
    ) => {
        if (nextDefId === '__new__') {
            if (!onCreateTaskDataDefinition) return;
            const label = window.prompt('New definition label:');
            if (!label) return;
            const valueType = window.prompt(
                'Value type (int, decimal, varchar, text, bool, date, datetime, customer_id, json):',
                'varchar'
            );
            if (!valueType) return;
            const key = window.prompt('Key (optional):', label.toLowerCase().replace(/[^a-z0-9]+/g, '_'));

            const created = await onCreateTaskDataDefinition({
                label,
                key: key || '',
                valueType,
            });
            if (!created) return;
            nextDefId = String(created.id);
        }

        const def = safeTaskDataDefinitions.find((entry) => String(entry.id) === nextDefId);
        setTaskRows((prev) =>
            prev.map((row) => {
                if (row.id !== taskRowId) return row;
                return {
                    ...row,
                    taskData: row.taskData.map((data) =>
                        data.id === dataRowId
                            ? {
                                ...data,
                                dataDefId: nextDefId,
                                valueType: def?.valueType || data.valueType,
                                value: '',
                                isRequired: data.isRequired ?? false,
                            }
                            : data
                    ),
                };
            })
        );
    };

    const handleTaskDataRequiredChange = (
        taskRowId: string,
        dataRowId: string,
        checked: boolean
    ) => {
        setTaskRows((prev) =>
            prev.map((row) =>
                row.id === taskRowId
                    ? {
                          ...row,
                          taskData: row.taskData.map((data) =>
                              data.id === dataRowId ? { ...data, isRequired: checked } : data
                          ),
                      }
                    : row
            )
        );
    };

    const handleTaskInputChange = (rowId: string, nextTitle: string) => {
        setFocusedTaskId(rowId);
        const normalizedTitle = nextTitle.trim().toLowerCase();
        const match = safeTaskOptions.find(
            (t) => t.description.trim().toLowerCase() === normalizedTitle
        );

        setTaskRows((prev) =>
            prev.map((row) => {
                if (row.id !== rowId) return row;

                const nextTaskId = match ? String(match.id) : '';
                const shouldResetCategory = normalizedTitle.length === 0;
                const shouldUpdateCategory =
                    match && (row.taskId !== nextTaskId || row.categoryId === '');

                return {
                    ...row,
                    taskId: nextTaskId,
                    taskTitle: nextTitle,
                    categoryId: shouldResetCategory
                        ? ''
                        : shouldUpdateCategory
                        ? match?.categoryId
                            ? String(match.categoryId)
                            : ''
                        : row.categoryId,
                };
            })
        );
    };

    const handleStatusInputChange = (rowId: string, nextStatus: string) => {
        setFocusedStatusId(rowId);
        setItemTrackingRows((prev) =>
            prev.map((row) =>
                row.id === rowId ? { ...row, statusText: nextStatus } : row
            )
        );
    };

    const handleStatusSuggestionSelect = (rowId: string, suggestion: string) => {
        handleStatusInputChange(rowId, suggestion);
        setFocusedStatusId(null);
    };

    const handleTaskSuggestionSelect = (rowId: string, description: string) => {
        handleTaskInputChange(rowId, description);
        setFocusedTaskId(null);
    };


const handleTaskRoleToggle = (
    rowId: string,
    roleId: string,
    checked: boolean
) => {
    setTaskRoleDrafts((prev) => {
        const current = prev[rowId] ?? [];
        const updated = new Set(current);
        if (checked) updated.add(roleId);
        else updated.delete(roleId);
        return { ...prev, [rowId]: Array.from(updated) };
    });
};

    const handleRemoveTaskRow = (rowId: string) => {
        setTaskRows(prev => prev.filter(r => r.id !== rowId));
        setTaskRoleDrafts((prev) => {
            const { [rowId]: _removed, ...rest } = prev;
        return rest;
    });

    // Если был открыт dropdown — закрыть
    if (openRolesTaskId === rowId) {
        setOpenRolesTaskId(null);
    }
    };

    const handleAddItemTrackingRow = () => {
        setItemTrackingRows((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                statusText: '',
                taskIds: [],
                statusMoment: 'task_finished',
            },
        ]);
    };

    const handleItemTrackingFieldChange = (
        rowId: string,
        field: keyof ItemTrackingRow,
        fieldValue: string
    ) => {
        setItemTrackingRows((prev) =>
            prev.map((row) =>
                row.id === rowId ? { ...row, [field]: fieldValue } : row
            )
        );
    };

    const handleItemTrackingTaskToggle = (rowId: string, taskId: string, checked: boolean) => {
        setItemTrackingTaskDrafts((prev) => {
            const current = prev[rowId] ?? [];
            const updated = new Set(current);
            if (checked) updated.add(taskId);
            else updated.delete(taskId);
            return { ...prev, [rowId]: Array.from(updated) };
        });
    };

    const handleOpenItemTrackingTasks = (rowId: string) => {
        setOpenItemTrackingTaskId((prev) => {
            const next = prev === rowId ? null : rowId;
            if (next) {
                setItemTrackingTaskDrafts((drafts) => ({
                    ...drafts,
                    [rowId]: drafts[rowId] ?? itemTrackingRows.find((r) => r.id === rowId)?.taskIds ?? [],
                }));
            }
            return next;
        });
    };

    const handleApplyItemTrackingTasks = (rowId: string) => {
        setItemTrackingRows((prev) =>
            prev.map((row) =>
                row.id === rowId
                    ? { ...row, taskIds: itemTrackingTaskDrafts[rowId] ?? [] }
                    : row
            )
        );
        setOpenItemTrackingTaskId(null);
    };

    const handleRemoveItemTrackingRow = (rowId: string) => {
        setItemTrackingRows((prev) => prev.filter((row) => row.id !== rowId));
        setItemTrackingTaskDrafts((prev) => {
            const { [rowId]: _removed, ...rest } = prev;
            return rest;
        });
        if (openItemTrackingTaskId === rowId) {
            setOpenItemTrackingTaskId(null);
        }
    };


const handleOpenRoles = (rowId: string) => {
    setOpenRolesTaskId((prev) => {
        const next = prev === rowId ? null : rowId;
        if (next) {
            setTaskRoleDrafts((drafts) => ({
                ...drafts,
                [rowId]: drafts[rowId] ?? taskRows.find(r => r.id === rowId)?.rolesId ?? [],
            }));
        }
        return next;
    });
};

const handleApplyTaskRoles = (rowId: string) => {
    setTaskRows((prev) =>
        prev.map((row) =>
            row.id === rowId
                ? { ...row, rolesId: taskRoleDrafts[rowId] ?? [] }
                : row
        )
    );
    setOpenRolesTaskId(null);
};

    useEffect(() => {
        if (syncingTeamRef.current) {
            syncingTeamRef.current = false;
            return;
        }
        onTeamRowsChange?.(teamRows);
    }, [teamRows, onTeamRowsChange]);

    useEffect(() => {
        if (syncingTaskRef.current) {
            syncingTaskRef.current = false;
            return;
        }
        onTaskRowsChange?.(taskRows);
    }, [taskRows, onTaskRowsChange]);

    useEffect(() => {
        const mergedRows = itemTrackingRows.map((row) => {
            const draft = itemTrackingTaskDrafts[row.id];
            return draft ? { ...row, taskIds: draft } : row;
        });
        onItemTrackingRowsChange?.(mergedRows);
    }, [itemTrackingRows, itemTrackingTaskDrafts, onItemTrackingRowsChange]);

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
                No tasks added yet. Click "Add task" to start.
                </div>
            ) : (
                <div className="project-task-rows">
                <div className="project-task-row project-task-row--header">
                    <div>#</div>
                    <div>Task</div>
                    <div>Category</div>
                    <div>Roles</div>
                    <div></div>
                </div>

                {taskRows.map((row, index) => {
                    const selectedLabels =
                    row.rolesId.length === 0
                        ? 'Select roles...'
                        : roleOptions
                            .filter((r) => row.rolesId.includes(String(r.id)))
                            .map((r) => r.label)
                            .join(', ');

                    const normalizedSearch = row.taskTitle.trim().toLowerCase();
                    const taskSuggestions = normalizedSearch
                        ? safeTaskOptions
                            .map((t) => ({
                                ...t,
                                matchIndex: t.description.toLowerCase().indexOf(normalizedSearch),
                            }))
                            .filter((t) => t.matchIndex !== -1)
                            .sort(
                                (a, b) =>
                                    a.matchIndex - b.matchIndex ||
                                    a.description.localeCompare(b.description)
                            )
                            .slice(0, 20)
                        : [];
                    const showSuggestions =
                        focusedTaskId === row.id && taskSuggestions.length > 0;

                    return (
                    <React.Fragment key={row.id}>
                    <div className="project-task-row">

                        <div>{index + 1}</div>

                        <div>
                        <div className="project-task-autocomplete">
                            <input
                                type="text"
                                className="project-task-input"
                                placeholder="Task title"
                                value={row.taskTitle}
                                onChange={(e) => handleTaskInputChange(row.id, e.target.value)}
                                onFocus={() => setFocusedTaskId(row.id)}
                                onBlur={() =>
                                    setFocusedTaskId((prev) => (prev === row.id ? null : prev))
                                }
                            />
                            {showSuggestions && (
                                <div className="project-task-suggestions">
                                    {taskSuggestions.map((task) => (
                                        <button
                                            key={task.id}
                                            type="button"
                                            className="project-task-suggestion"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleTaskSuggestionSelect(row.id, task.description);
                                            }}
                                        >
                                            {task.description}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        </div>

                        <div>
                        <select
                            value={row.categoryId}
                            onChange={(e) =>
                                handleTaskFieldChange(row.id, 'categoryId', e.target.value)
                            }
                        >
                            <option value="">Select category...</option>
                            {safeTaskCategoryOptions.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.name}
                            </option>
                            ))}
                        </select>
                        </div>

                        <div className="roles-select-cell">
                        <button
                            type="button"
                            className="roles-select-trigger"
                            onClick={() => handleOpenRoles(row.id)}
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
                                const checked = (taskRoleDrafts[row.id] ?? row.rolesId).includes(id);

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
                            <div className="roles-select-actions">
                                <button
                                    type="button"
                                    className="roles-select-done"
                                    onClick={() => handleApplyTaskRoles(row.id)}
                                >
                                    Done
                                </button>
                            </div>
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

                    {(row.taskId || row.taskTitle.trim()) && (
                        <div className="project-task-data">
                            <div className="project-task-data__header">
                                <span>Task data</span>
                                <button
                                    type="button"
                                    className="btn-icon-square"
                                    onClick={() => handleTaskDataAddRow(row.id)}
                                    title="Add task data"
                                >
                                    <span className="material-symbols-outlined">add</span>
                                </button>
                            </div>
                            {row.taskData.length === 0 ? (
                                <div className="project-form__hint">
                                    No task data yet. Click "Add task data" to start.
                                </div>
                            ) : (
                                <div className="project-task-data__rows">
                                    {row.taskData.map((dataRow) => {
                                        return (
                                            <div key={dataRow.id} className="project-task-data__row">
                                                <select
                                                    value={dataRow.dataDefId || ''}
                                                    onChange={(e) =>
                                                        handleTaskDataDefinitionChange(
                                                            row.id,
                                                            dataRow.id,
                                                            e.target.value
                                                        )
                                                    }
                                                >
                                                    <option value="">Select definition...</option>
                                                    {safeTaskDataDefinitions.map((def) => (
                                                        <option key={def.id} value={def.id}>
                                                            {def.label}
                                                        </option>
                                                    ))}
                                                    <option value="__new__">+ Add new definition...</option>
                                                </select>

                                                <label>
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(dataRow.isRequired)}
                                                        onChange={(e) =>
                                                            handleTaskDataRequiredChange(
                                                                row.id,
                                                                dataRow.id,
                                                                e.target.checked
                                                            )
                                                        }
                                                    />
                                                    Required
                                                </label>

                                                <button
                                                    type="button"
                                                    className="btn-icon-small"
                                                    onClick={() => handleTaskDataRemoveRow(row.id, dataRow.id)}
                                                >
                                                    <span className="material-symbols-outlined">delete</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                    </React.Fragment>
                    );
                })}
                </div>
            )}
            </section>

{/* 4. ITEM TRACKING */}
            <section className="project-form__section">
            <div className="project-form__section-header">
                <h4>Item Tracking</h4>

                <div className="project-team__actions">
                <button
                    type="button"
                    className="btn-icon-square"
                    onClick={handleAddItemTrackingRow}
                    title="Add item tracking"
                >
                    <span className="material-symbols-outlined">add</span>
                </button>
                </div>
            </div>

            {itemTrackingRows.length === 0 ? (
                <div className="project-form__hint">
                No item tracking rows yet. Click "Add item tracking" to start.
                </div>
            ) : (
                <div className="item-tracking-rows">
                <div className="item-tracking-row item-tracking-row--header">
                    <div>#</div>
                    <div>Status</div>
                    <div>Task</div>
                    <div>Status moment</div>
                    <div></div>
                </div>

                {itemTrackingRows.map((row, index) => (
                    <div key={row.id} className="item-tracking-row">
                    <div>{index + 1}</div>

                    <div>
                        <div className="project-task-autocomplete">
                        <input
                            type="text"
                            className="project-task-input"
                            placeholder="Status"
                            value={row.statusText}
                            onChange={(e) => handleStatusInputChange(row.id, e.target.value)}
                            onFocus={() => setFocusedStatusId(row.id)}
                            onBlur={() =>
                                setFocusedStatusId((prev) => (prev === row.id ? null : prev))
                            }
                        />
                        {focusedStatusId === row.id &&
                            row.statusText.trim() &&
                            safeItemStatusOptions.filter((status) =>
                                (status.label || status.name || '')
                                    .toLowerCase()
                                    .includes(row.statusText.trim().toLowerCase())
                            ).length > 0 && (
                                <div className="project-task-suggestions">
                                    {safeItemStatusOptions
                                        .map((status) => {
                                            const label = status.label || status.name || '';
                                            return {
                                                ...status,
                                                displayLabel: label,
                                                matchIndex: label
                                                    .toLowerCase()
                                                    .indexOf(row.statusText.trim().toLowerCase()),
                                            };
                                        })
                                        .filter((status) => status.matchIndex !== -1)
                                        .sort(
                                            (a, b) =>
                                                a.matchIndex - b.matchIndex ||
                                                a.displayLabel.localeCompare(b.displayLabel)
                                        )
                                        .slice(0, 20)
                                        .map((status) => (
                                            <button
                                                key={status.id}
                                                type="button"
                                                className="project-task-suggestion"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    handleStatusSuggestionSelect(
                                                        row.id,
                                                        status.displayLabel
                                                    );
                                                }}
                                            >
                                                {status.displayLabel}
                                            </button>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <div className="roles-select-cell">
                        <button
                            type="button"
                            className="roles-select-trigger"
                            onClick={() => handleOpenItemTrackingTasks(row.id)}
                        >
                            <span className="roles-select-label">
                            {row.taskIds.length === 0
                                ? 'Select tasks...'
                                : itemTrackingTaskOptions
                                    .filter((task) => row.taskIds.includes(task.value))
                                    .map((task) => task.label)
                                    .join(', ')}
                            </span>
                            <span className="material-symbols-outlined">
                            arrow_drop_down
                            </span>
                        </button>

                        {openItemTrackingTaskId === row.id && (
                            <div className="roles-select-dropdown">
                            {itemTrackingTaskOptions.map((task) => {
                                const id = task.value;
                                const checked = (itemTrackingTaskDrafts[row.id] ?? row.taskIds).includes(id);
                                return (
                                <label key={task.value} className="roles-select-option">
                                    <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                        handleItemTrackingTaskToggle(row.id, id, e.target.checked)
                                    }
                                    />
                                    {task.label}
                                </label>
                                );
                            })}
                            <div className="roles-select-actions">
                                <button
                                    type="button"
                                    className="roles-select-done"
                                    onClick={() => handleApplyItemTrackingTasks(row.id)}
                                >
                                    Done
                                </button>
                            </div>
                            </div>
                        )}
                        </div>
                    </div>

                    <div>
                        <select
                        value={row.statusMoment}
                        onChange={(e) =>
                            handleItemTrackingFieldChange(row.id, 'statusMoment', e.target.value)
                        }
                        >
                        <option value="task_started">Task started</option>
                        <option value="task_finished">Task finished</option>
                        </select>
                    </div>

                    <div>
                        <button
                        type="button"
                        className="btn-icon-small"
                        onClick={() => handleRemoveItemTrackingRow(row.id)}
                        >
                        <span className="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                    </div>
                ))}
                </div>
            )}
            </section>

        </div>
    );
};

export default ProjectForm;
