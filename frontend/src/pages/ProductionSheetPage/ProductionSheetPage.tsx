import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import './ProductionSheetPage.css';

type TimeSlice = {
  id: number;
  activity_id: number | null;
  project_id: number | null;
  task_id: number | null;
  task_name: string | null;
  task_type: string | null;
  project_name: string | null;
  note: string | null;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
};

const ProductionSheetPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = user?.id;
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<TimeSlice[]>([]);
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
        `/time-tracking?userId=${userId}&date=${date}`
      );
      setRows(data);
    } catch (e) {
      console.error('Error loading time tracking:', e);
      setError('Unable to load time tracking.');
    } finally {
      setLoading(false);
    }
  }, [userId, date]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const formatTime = (value: string | null) => {
    if (!value) return '--:--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--:--';
    return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getTaskLabel = (row: TimeSlice) => {
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
        <h2>Production Sheet</h2>
        <div className="production-sheet__meta">
          <span>{date}</span>
          <span>Total work time: {formatTotalTime(totalWorkMinutes)}</span>
        </div>
        <div className="production-sheet__actions">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
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

      {!loading && !error && (
        <div className="time-table">
          <div className="time-table__row time-table__row--header">
            <div>Task</div>
            <div>Project</div>
            <div>Start</div>
            <div>End</div>
            <div>Duration</div>
            <div>Note</div>
            <div></div>
          </div>

          {rows.length === 0 && (
            <div className="time-table__empty">No time slices for this date.</div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="time-table__row">
              <div>{getTaskLabel(row)}</div>
              <div>{row.project_name || '-'}</div>
              <div>{formatTime(row.start_time)}</div>
              <div>{formatTime(row.end_time)}</div>
              <div>{row.duration ?? 0}</div>
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
            </div>
          ))}
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

export default ProductionSheetPage;
