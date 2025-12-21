import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import './ProductionSheetPage.css';

type TimeSlice = {
  id: number;
  task_id: number | null;
  task_name: string | null;
  task_type: string | null;
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

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
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
    };
    load();
  }, [userId, date]);

  const formatTime = (value: string | null) => {
    if (!value) return '--:--';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '--:--';
    return parsed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="production-sheet">
      <div className="production-sheet__header">
        <h2>Production Sheet</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && (
        <div className="time-table">
          <div className="time-table__row time-table__row--header">
            <div>Task</div>
            <div>Type</div>
            <div>Start</div>
            <div>End</div>
            <div>Duration</div>
            <div></div>
          </div>

          {rows.length === 0 && (
            <div className="time-table__empty">No time slices for this date.</div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="time-table__row">
              <div>{row.task_name || 'Unallocated'}</div>
              <div>{row.task_type || '-'}</div>
              <div>{formatTime(row.start_time)}</div>
              <div>{formatTime(row.end_time)}</div>
              <div>{row.duration ?? 0}</div>
              <div>
                <button type="button" className="note-btn">Note</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductionSheetPage;
