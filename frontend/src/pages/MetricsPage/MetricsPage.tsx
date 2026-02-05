import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import './MetricsPage.css';

type MetricRow = {
  id: number;
  task_id: number | null;
  task_name: string | null;
  project_name: string | null;
  date?: string | null;
  start_time: string | null;
  end_time: string | null;
  duration: number | null;
  pages: number | null;
  pagesPerMinute: number | null;
};

const MetricsPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = user?.id;
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
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRows = useCallback(async () => {
    if (!userId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<MetricRow[]>(
        `/time-tracking/metrics?userId=${userId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
      );
      setRows(data);
    } catch (e) {
      console.error('Error loading metrics:', e);
      setError('Unable to load metrics.');
    } finally {
      setLoading(false);
    }
  }, [userId, dateFrom, dateTo]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

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
    <div className="metrics-page__datetime">
      <div className="metrics-page__datetime-time">{formatTime(timeValue)}</div>
      <div className="metrics-page__datetime-date">{dateValue}</div>
    </div>
  );

  const formatPagesPerMinute = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return '-';
    return value.toFixed(2);
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

  return (
    <div className="metrics-page">
      <div className="metrics-page__header">
        <h2>Metrics</h2>
        <div className="metrics-page__actions">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
          <div className="metrics-page__presets">
            <button
              type="button"
              className={`metrics-page__btn metrics-page__preset ${activePreset === 'today' ? 'metrics-page__preset--active' : ''}`}
              onClick={applyPresetToday}
              disabled={loading}
            >
              Today
            </button>
            <button
              type="button"
              className={`metrics-page__btn metrics-page__preset ${activePreset === 'week' ? 'metrics-page__preset--active' : ''}`}
              onClick={applyPresetCurrentWeek}
              disabled={loading}
            >
              Current week
            </button>
            <button
              type="button"
              className={`metrics-page__btn metrics-page__preset ${activePreset === 'month' ? 'metrics-page__preset--active' : ''}`}
              onClick={applyPresetCurrentMonth}
              disabled={loading}
            >
              Current month
            </button>
          </div>
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div className="metrics-page__error">{error}</div>}

      {!loading && !error && (
        <div className="time-table metrics-table">
          <div className="time-table__row time-table__row--header">
            <div>Task</div>
            <div>Project</div>
            <div>Start</div>
            <div>End</div>
            <div>Duration</div>
            <div>Pages/Min</div>
          </div>

          {rows.length === 0 && (
            <div className="time-table__empty">No metrics for this date.</div>
          )}

          {rows.map((row) => (
            <div key={row.id} className="time-table__row">
              <div>{row.task_name || '-'}</div>
              <div>{row.project_name || '-'}</div>
              <div>{renderDateTimeCell(row.start_time, formatRowDate(row))}</div>
              <div>{renderDateTimeCell(row.end_time, formatRowDate(row))}</div>
              <div>{formatDuration(row.duration)}</div>
              <div>{formatPagesPerMinute(row.pagesPerMinute)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MetricsPage;
