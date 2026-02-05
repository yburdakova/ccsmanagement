import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import './ProductionSheetPage.css';

type TimeSlice = {
  id: number;
  activity_id: number | null;
  project_id: number | null;
  task_id: number | null;
  date?: string | null;
  activity_name?: string | null;
  activity_description?: string | null;
  task_name: string | null;
  task_type: string | null;
  project_name: string | null;
  note: string | null;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
};

type Props = {
  userId: number;
  title?: string;
  headerControls?: ReactNode;
  enableRowSelection?: boolean;
  onDeleteSelectedRows?: (ids: number[]) => Promise<void>;
  onUpdateRow?: (
    id: number,
    patch: {
      startDate: string;
      startTime: string;
      endDate: string;
      endTime: string | null;
      note: string | null;
    }
  ) => Promise<void>;
};

const ProductionSheetView = ({
  userId,
  title = 'Production Sheet',
  headerControls,
  enableRowSelection = false,
  onDeleteSelectedRows,
  onUpdateRow,
}: Props) => {
  const formatDateInputValue = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const current = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayBasedIndex = (current.getDay() + 6) % 7; // Monday=0 ... Sunday=6
    const start = new Date(current);
    start.setDate(current.getDate() - mondayBasedIndex);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: formatDateInputValue(start), end: formatDateInputValue(end) };
  };

  const getCurrentMonthRange = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatDateInputValue(start), end: formatDateInputValue(end) };
  };

  const today = useMemo(() => formatDateInputValue(new Date()), []);
  const initialWeek = useMemo(() => getCurrentWeekRange(), []);
  const [dateFrom, setDateFrom] = useState(initialWeek.start);
  const [dateTo, setDateTo] = useState(initialWeek.end);
  const [rows, setRows] = useState<TimeSlice[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newActivityId, setNewActivityId] = useState('4');
  const [newNote, setNewNote] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(today);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
  const [isEditEntryOpen, setIsEditEntryOpen] = useState(false);
  const [editEntryStartDate, setEditEntryStartDate] = useState('');
  const [editEntryStartTime, setEditEntryStartTime] = useState('');
  const [editEntryEndDate, setEditEntryEndDate] = useState('');
  const [editEntryEndTime, setEditEntryEndTime] = useState('');
  const [editEntryNote, setEditEntryNote] = useState('');

  const activityOptions = [
    { id: 9, label: 'Set-Up/Shout-Down' },
    { id: 10, label: 'Travelling' },
    { id: 11, label: 'Technical Delay' },
    { id: 7, label: 'Clean Up' },
    { id: 6, label: 'Training' },
    { id: 4, label: 'Other' },
  ];

  const loadRows = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<TimeSlice[]>(
        `/time-tracking?userId=${userId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      setRows(data);
    } catch (e) {
      console.error('Error loading time tracking:', e);
      setError('Unable to load time tracking.');
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    if (!enableRowSelection) return;
    setSelectedRowIds((prev) => {
      if (prev.size === 0) return prev;
      const visible = new Set(rows.map((r) => r.id));
      const next = new Set<number>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
      }
      return next;
    });
  }, [rows, enableRowSelection]);

  const allVisibleSelected =
    enableRowSelection && rows.length > 0 && selectedRowIds.size === rows.length;

  const anySelected = enableRowSelection && selectedRowIds.size > 0;

  const toggleSelectAllVisible = () => {
    if (!enableRowSelection) return;
    setSelectedRowIds((prev) => {
      if (rows.length === 0) return prev;
      if (prev.size === rows.length) return new Set();
      return new Set(rows.map((r) => r.id));
    });
  };

  const toggleSelectRow = (rowId: number) => {
    if (!enableRowSelection) return;
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!enableRowSelection || !onDeleteSelectedRows) return;
    const ids = Array.from(selectedRowIds);
    if (ids.length === 0) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected row(s)?`);
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      await onDeleteSelectedRows(ids);
      setSelectedRowIds(new Set());
      await loadRows();
    } catch (e) {
      console.error('Error deleting selected rows:', e);
      setError('Unable to delete selected rows.');
    } finally {
      setLoading(false);
    }
  };

  const selectedRowForEdit =
    enableRowSelection && selectedRowIds.size === 1
      ? rows.find((r) => r.id === Array.from(selectedRowIds)[0]) ?? null
      : null;

  const toDateInputValue = (value: string | null | undefined) => {
    const raw = String(value ?? '').trim();
    if (!raw) return '';
    const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const [, yyyy, mm, dd] = isoDateMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return '';
    const yyyy = String(parsed.getFullYear());
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const formatTimeInputValue = (value: string | null) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const hours = String(parsed.getHours()).padStart(2, '0');
    const minutes = String(parsed.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const openEntryEditor = () => {
    if (!selectedRowForEdit) return;
    const dateValue = toDateInputValue(selectedRowForEdit.date);
    setEditEntryStartDate(dateValue);
    setEditEntryStartTime(formatTimeInputValue(selectedRowForEdit.start_time));
    setEditEntryEndDate(dateValue);
    setEditEntryEndTime(formatTimeInputValue(selectedRowForEdit.end_time));
    setEditEntryNote(selectedRowForEdit.note ?? '');
    setIsEditEntryOpen(true);
  };

  const closeEntryEditor = () => {
    setIsEditEntryOpen(false);
    setEditEntryStartDate('');
    setEditEntryStartTime('');
    setEditEntryEndDate('');
    setEditEntryEndTime('');
    setEditEntryNote('');
  };

  const handleSaveEntryEdit = async () => {
    if (!selectedRowForEdit || !onUpdateRow) return;
    if (!editEntryStartDate || !editEntryEndDate) {
      setError('Start date and end date are required.');
      return;
    }
    if (!editEntryStartTime) {
      setError('Start time is required.');
      return;
    }
    if (editEntryEndTime && editEntryEndTime <= editEntryStartTime) {
      setError('End time must be after start time.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onUpdateRow(selectedRowForEdit.id, {
        startDate: editEntryStartDate,
        startTime: editEntryStartTime,
        endDate: editEntryEndDate,
        endTime: editEntryEndTime.trim() ? editEntryEndTime : null,
        note: editEntryNote.trim() || null,
      });
      closeEntryEditor();
      await loadRows();
    } catch (e) {
      console.error('Error updating entry:', e);
      setError('Unable to update entry.');
    } finally {
      setLoading(false);
    }
  };

  const applyPresetToday = () => {
    setDateFrom(today);
    setDateTo(today);
  };

  const applyPresetCurrentWeek = () => {
    const range = getCurrentWeekRange();
    setDateFrom(range.start);
    setDateTo(range.end);
  };

  const applyPresetCurrentMonth = () => {
    const range = getCurrentMonthRange();
    setDateFrom(range.start);
    setDateTo(range.end);
  };

  const activePreset = useMemo(() => {
    if (dateFrom === today && dateTo === today) return 'today';
    const week = getCurrentWeekRange();
    if (dateFrom === week.start && dateTo === week.end) return 'week';
    const month = getCurrentMonthRange();
    if (dateFrom === month.start && dateTo === month.end) return 'month';
    return null;
  }, [dateFrom, dateTo, today]);

  const formatTime = (value: string | null) => {
    if (!value) return '--:--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--:--';
    return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatRowDate = (row: { date?: string | null }) => {
    const raw = String(row.date ?? '').trim();
    if (!raw) return '-';

    // Handle "YYYY-MM-DD" and ISO strings like "YYYY-MM-DDTHH:mm:ss.sssZ" without leaking the time part.
    const isoDateMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoDateMatch) {
      const [, yyyy, mm, dd] = isoDateMatch;
      return `${mm}/${dd}/${yyyy}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return raw;
    const mm = String(parsed.getMonth() + 1).padStart(2, '0');
    const dd = String(parsed.getDate()).padStart(2, '0');
    const yyyy = String(parsed.getFullYear());
    return `${mm}/${dd}/${yyyy}`;
  };

  const renderDateTimeCell = (timeValue: string | null, dateValue: string) => (
    <div className="production-sheet__datetime">
      <div className="production-sheet__datetime-time">{formatTime(timeValue)}</div>
      <div className="production-sheet__datetime-date">{dateValue}</div>
    </div>
  );

  const toTitleCase = (value: string) =>
    value
      .replace(/[_-]+/g, ' ')
      .trim()
      .split(/\s+/g)
      .filter(Boolean)
      .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');

  const getTaskLabel = (row: TimeSlice) => {
    if (row.activity_id !== 2) {
      if (row.activity_name === 'unallocated') return 'Unallocated';
      if (row.activity_description) return row.activity_description;
      if (row.activity_name) return toTitleCase(row.activity_name);
    }
    if (row.activity_id === 3) return 'Break';
    if (row.activity_id === 1) return 'Lunch';
    if (row.activity_id === 5) return 'Meeting';
    if (row.activity_id === 8) return 'Administration';
    if (row.activity_id === 9) return 'Set-Up/Shout-Down';
    if (row.activity_id === 10) return 'Travelling';
    if (row.activity_id === 11) return 'Technical Delay';
    if (row.activity_id === 7) return 'Clean Up';
    if (row.activity_id === 6) return 'Training';
    if (row.activity_id === 4) return 'Unallocated';
    return row.task_name || 'Unallocated';
  };

  const totalWorkMinutes = useMemo(
    () =>
      rows.reduce((sum, row) => {
        if (row.activity_id === 1) return sum;
        const minutes = Number(row.duration);
        return sum + (Number.isFinite(minutes) ? minutes : 0);
      }, 0),
    [rows]
  );

  const formatTotalTime = (minutes: number) => {
    if (!Number.isFinite(minutes)) return '00:00';
    const rounded = Math.round(minutes);
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const formatDuration = (minutesValue: number | null) => {
    const minutes = Number(minutesValue);
    if (!Number.isFinite(minutes) || minutes <= 0) return '0 min';
    const rounded = Math.round(minutes);
    if (rounded < 60) return `${rounded} min`;
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return `${hours}:${String(mins).padStart(2, '0')}`;
  };

  const timeStats = useMemo(() => {
    const totals = new Map<string, number>();
    let totalMinutes = 0;

    for (const row of rows) {
      if (row.activity_id === 1) continue;
      const minutes = Number(row.duration);
      if (!Number.isFinite(minutes) || minutes <= 0) continue;

      let bucket = 'Other';
      if (row.activity_id === 2) {
        bucket = row.task_name?.trim() || row.task_type?.trim() || 'Task';
      } else if (row.activity_name === 'unallocated') {
        bucket = 'Unallocated';
      } else if (row.activity_description) {
        bucket = row.activity_description;
      } else if (row.activity_name) {
        bucket = toTitleCase(row.activity_name);
      } else {
        bucket = getTaskLabel(row);
      }

      totalMinutes += minutes;
      totals.set(bucket, (totals.get(bucket) || 0) + minutes);
    }

    if (totalMinutes <= 0) return [];

    return Array.from(totals.entries())
      .map(([label, minutes]) => ({
        label,
        minutes,
        percent: (minutes / totalMinutes) * 100,
      }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [rows]);

  const resetModal = () => {
    setNewTaskDate(today);
    setNewStartTime('');
    setNewEndTime('');
    setNewActivityId('4');
    setNewNote('');
  };

  const handleAddTask = async () => {
    if (!userId || !newStartTime || !newEndTime || !newActivityId) {
      setError('Start time, end time, and type are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await apiRequest('/time-tracking', {
        method: 'POST',
        body: {
          userId,
          date: newTaskDate,
          activityId: Number(newActivityId),
          startTime: newStartTime,
          endTime: newEndTime,
          note: newNote.trim() || null,
        },
      });
      resetModal();
      setIsModalOpen(false);
      await loadRows();
    } catch (e) {
      console.error('Error adding time tracking entry:', e);
      const message =
        e instanceof Error &&
        (e.message.includes('overlaps') || e.message.includes('Conflict'))
          ? 'Time range overlaps an existing entry.'
          : 'Unable to add time entry.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const openNoteEditor = (row: TimeSlice) => {
    setEditingNoteId(row.id);
    setEditingNoteValue(row.note ?? '');
  };

  const closeNoteEditor = () => {
    setEditingNoteId(null);
    setEditingNoteValue('');
  };

  const handleSaveNote = async () => {
    if (!editingNoteId) return;
    try {
      setLoading(true);
      setError(null);
      await apiRequest(`/time-tracking/${editingNoteId}/note`, {
        method: 'PUT',
        body: {
          note: editingNoteValue.trim() || null,
        },
      });
      closeNoteEditor();
      await loadRows();
    } catch (e) {
      console.error('Error saving note:', e);
      setError('Unable to save note.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="production-sheet">
      <div className="production-sheet__header">
        <h2>{title}</h2>
        <div className="production-sheet__meta">
          <span>{dateFrom === dateTo ? dateFrom : `${dateFrom} — ${dateTo}`}</span>
          <span>Total work time: {formatTotalTime(totalWorkMinutes)}</span>
        </div>
        <div className="production-sheet__actions">
          {headerControls}
          <input
            type="date"
            className="production-sheet__control"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            className="production-sheet__control"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <div className="production-sheet__presets">
            <button
              type="button"
              className={`note-btn production-sheet__preset ${activePreset === 'today' ? 'production-sheet__preset--active' : ''}`}
              onClick={applyPresetToday}
              disabled={loading}
            >
              Today
            </button>
            <button
              type="button"
              className={`note-btn production-sheet__preset ${activePreset === 'week' ? 'production-sheet__preset--active' : ''}`}
              onClick={applyPresetCurrentWeek}
              disabled={loading}
            >
              Current week
            </button>
            <button
              type="button"
              className={`note-btn production-sheet__preset ${activePreset === 'month' ? 'production-sheet__preset--active' : ''}`}
              onClick={applyPresetCurrentMonth}
              disabled={loading}
            >
              Current month
            </button>
          </div>
          <button
            type="button"
            className="note-btn"
            onClick={() => setIsModalOpen(true)}
          >
            Add Task
          </button>
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && timeStats.length > 0 && (
        <div className="production-sheet__stats">
          {timeStats.map((stat) => (
            <div key={stat.label} className="production-sheet__tile">
              <div className="production-sheet__tile-title">{stat.label}</div>
              <div className="production-sheet__tile-value">{Math.round(stat.percent)}%</div>
              <div className="production-sheet__tile-sub">{formatDuration(stat.minutes)}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className={`time-table ${enableRowSelection ? 'time-table--selectable' : ''}`}>
          {enableRowSelection && anySelected && (
            <div className="production-sheet__bulk-actions">
              <button
                type="button"
                className="note-btn production-sheet__bulk-btn"
                onClick={openEntryEditor}
                disabled={loading || selectedRowIds.size !== 1 || !onUpdateRow}
              >
                Edit
              </button>
              <button
                type="button"
                className="note-btn production-sheet__bulk-btn production-sheet__bulk-btn--danger"
                onClick={handleBulkDelete}
                disabled={loading}
              >
                Delete
              </button>
            </div>
          )}
          <div className="time-table__row time-table__row--header">
            <div>Task</div>
            <div>Project</div>
            <div>Start</div>
            <div>End</div>
            <div>Duration</div>
            <div>Note</div>
            <div></div>
            {enableRowSelection && (
              <div className="time-table__select">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
              </div>
            )}
          </div>

          {rows.length === 0 && (
            <div className="time-table__empty">No time slices for this date.</div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="time-table__row">
              <div>{getTaskLabel(row)}</div>
              <div>{row.project_name || '-'}</div>
              <div>{renderDateTimeCell(row.start_time, formatRowDate(row))}</div>
              <div>{renderDateTimeCell(row.end_time, formatRowDate(row))}</div>
              <div>{formatDuration(row.duration)}</div>
              <div>{row.note?.trim() || '-'}</div>
              <div>
                <button
                  type="button"
                  className="note-btn note-btn--icon"
                  aria-label="Edit note"
                  onClick={() => openNoteEditor(row)}
                >
                  <span className="material-symbols-outlined">edit</span>
                </button>
              </div>
              {enableRowSelection && (
                <div className="time-table__select">
                  <input
                    type="checkbox"
                    aria-label="Select row"
                    checked={selectedRowIds.has(row.id)}
                    onChange={() => toggleSelectRow(row.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isEditEntryOpen && selectedRowForEdit && (
        <div className="production-sheet__modal">
          <div className="production-sheet__modal-card">
            <h3>Edit time entry</h3>
            <label>
              Start date
              <input
                type="date"
                value={editEntryStartDate}
                onChange={(e) => setEditEntryStartDate(e.target.value)}
              />
            </label>
            <label>
              Start time
              <input
                type="time"
                value={editEntryStartTime}
                onChange={(e) => setEditEntryStartTime(e.target.value)}
              />
            </label>
            <label>
              End date
              <input
                type="date"
                value={editEntryEndDate}
                onChange={(e) => setEditEntryEndDate(e.target.value)}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={editEntryEndTime}
                onChange={(e) => setEditEntryEndTime(e.target.value)}
              />
            </label>
            <label>
              Note
              <textarea
                value={editEntryNote}
                onChange={(e) => setEditEntryNote(e.target.value)}
                rows={3}
              />
            </label>
            <div className="production-sheet__modal-actions">
              <button type="button" className="note-btn" onClick={handleSaveEntryEdit} disabled={loading}>
                Save
              </button>
              <button
                type="button"
                className="note-btn production-sheet__modal-cancel"
                onClick={closeEntryEditor}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="production-sheet__modal">
          <div className="production-sheet__modal-card">
            <h3>Add Task</h3>
            {error && <div className="production-sheet__modal-error">{error}</div>}
            <label>
              Date
              <input
                type="date"
                value={newTaskDate}
                onChange={(e) => setNewTaskDate(e.target.value)}
              />
            </label>
            <label>
              Start time
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
              />
            </label>
            <label>
              End time
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
              />
            </label>
            <label>
              Type
              <select
                value={newActivityId}
                onChange={(e) => setNewActivityId(e.target.value)}
              >
                {activityOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Note
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
            </label>
            <div className="production-sheet__modal-actions">
              <button type="button" className="note-btn" onClick={handleAddTask}>
                Save
              </button>
              <button
                type="button"
                className="note-btn production-sheet__modal-cancel"
                onClick={() => {
                  resetModal();
                  setIsModalOpen(false);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {editingNoteId !== null && (
        <div className="production-sheet__modal">
          <div className="production-sheet__modal-card">
            <h3>Edit Note</h3>
            <label>
              Note
              <textarea
                value={editingNoteValue}
                onChange={(e) => setEditingNoteValue(e.target.value)}
                rows={3}
              />
            </label>
            <div className="production-sheet__modal-actions">
              <button type="button" className="note-btn" onClick={handleSaveNote}>
                Save
              </button>
              <button
                type="button"
                className="note-btn production-sheet__modal-cancel"
                onClick={closeNoteEditor}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionSheetView;
