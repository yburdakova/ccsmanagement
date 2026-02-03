
import { useEffect, useState } from 'react';
import './UsersPage.css';
import ManagePage from '../../layouts/ManagePageLayout/ManagePageLayout';
import { apiRequest } from '../../services/apiClient';
import type { User } from '../../types/user.types';

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<User[]>('/users');
        setUsers(data);
      } catch (e) {
        console.error('Error loading users:', e);
        setError('Unable to load users. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, []);

  const listSlot = (
    <div className="users-table-wrapper">
      {loading && <div>Loading users...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && users.length === 0 && (
        <div>No users found.</div>
      )}

      {!loading && !error && users.length > 0 && (
        <table className="users-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Login</th>
              <th>Role</th>
              <th>Status</th>
            </tr>
          </thead>

          <tbody>
            {users.map((user, index) => {
              const fullName = [user.first_name, user.last_name]
                .filter(Boolean)
                .join(' ')
                .trim();
              return (
                <tr key={user.id ?? `${user.login}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{fullName || '-'}</td>
                  <td>{user.login || '-'}</td>
                  <td>{user.system_role ?? '-'}</td>
                  <td>{Number(user.is_active) === 1 ? 'Active' : 'Inactive'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <ManagePage
      title="Users"
      isEditing={false}
      isCreating={false}
      showAdd={false}
      onAdd={() => {}}
      onCancel={() => {}}
      onSave={() => {}}
      listSlot={listSlot}
      formSlot={null}
    />
  );
};

export default UsersPage;
