import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import type { User } from '../../types/user.types';
import ProductionSheetView from '../ProductionSheetPage/ProductionSheetView';

const userLabel = (user: User) =>
  [user.first_name, user.last_name].filter(Boolean).join(' ') ||
  user.login ||
  String(user.id);

const ProductionSheetsPage = () => {
  const currentUser = JSON.parse(localStorage.getItem('user') || 'null');
  const currentUserId = Number(currentUser?.id) || null;

  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(currentUserId);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        setUsersError(null);
        const data = await apiRequest<User[]>('/users');
        const activeUsers = data.filter((u) => Number(u.is_active) === 1);
        setUsers(activeUsers);
      } catch (e) {
        console.error('Error loading users for production sheets:', e);
        setUsersError('Unable to load users.');
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  const resolvedUserId = useMemo(() => {
    if (selectedUserId) return selectedUserId;
    if (users.length === 0) return null;
    const currentIsActive = currentUserId && users.some((u) => u.id === currentUserId);
    if (currentIsActive) return currentUserId;
    return users[0].id;
  }, [selectedUserId, users, currentUserId]);

  useEffect(() => {
    if (!selectedUserId && resolvedUserId) {
      setSelectedUserId(resolvedUserId);
    }
  }, [selectedUserId, resolvedUserId]);

  const headerControls = (
    <select
      aria-label="User"
      className="production-sheet__control production-sheet__user-select"
      value={resolvedUserId ?? ''}
      onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
      disabled={loadingUsers || users.length === 0}
    >
      <option value="" disabled>
        Select user...
      </option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {userLabel(u)}
        </option>
      ))}
    </select>
  );

  if (usersError) {
    return <div className="error active">{usersError}</div>;
  }

  if (!resolvedUserId) {
    return (
      <div className="production-sheet">
        <div className="production-sheet__header">
          <h2>Production Sheets</h2>
        </div>
        {loadingUsers ? <div>Loading...</div> : <div>No active users.</div>}
      </div>
    );
  }

  return (
    <ProductionSheetView
      userId={resolvedUserId}
      title="Production Sheets"
      headerControls={headerControls}
      enableRowSelection
      onDeleteSelectedRows={async (ids) => {
        await apiRequest('/time-tracking/bulk-delete', {
          method: 'POST',
          body: { ids },
        });
      }}
      onUpdateRow={async (id, patch) => {
        await apiRequest(`/time-tracking/${id}`, {
          method: 'PUT',
          body: patch,
        });
      }}
    />
  );
};

export default ProductionSheetsPage;
