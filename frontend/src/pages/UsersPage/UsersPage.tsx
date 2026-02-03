
import { useEffect, useMemo, useState } from 'react';
import './UsersPage.css';
import ManagePage from '../../layouts/ManagePageLayout/ManagePageLayout';
import { apiRequest } from '../../services/apiClient';
import type { SystemRole, User } from '../../types/user.types';

type UserFormValue = {
  id?: number;
  first_name: string;
  last_name: string;
  email: string;
  login: string;
  password: string;
  authcode: string;
  system_role: string;
  is_active: boolean;
  is_ccs: boolean;
};

const emptyFormValue: UserFormValue = {
  first_name: '',
  last_name: '',
  email: '',
  login: '',
  password: '',
  authcode: '',
  system_role: '',
  is_active: true,
  is_ccs: false,
};

const UsersPage = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState<UserFormValue>(emptyFormValue);
  const [roles, setRoles] = useState<SystemRole[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    const loadRoles = async () => {
      try {
        const data = await apiRequest<SystemRole[]>('/users/roles');
        setRoles(data);
      } catch (e) {
        console.error('Error loading system roles:', e);
      }
    };

    loadRoles();
  }, []);

  const handleAddClick = () => {
    setIsCreating(true);
    setIsEditing(false);
    setFormError(null);
    setFormValue(emptyFormValue);
  };

  const handleEditClick = (user: User) => {
    setIsEditing(true);
    setIsCreating(false);
    setFormError(null);
    setFormValue({
      id: user.id,
      first_name: user.first_name ?? '',
      last_name: user.last_name ?? '',
      email: user.email ?? '',
      login: user.login ?? '',
      password: user.password ?? '',
      authcode: user.authcode ?? '',
      system_role: String(user.system_role ?? ''),
      is_active: Number(user.is_active) === 1,
      is_ccs: Number(user.is_ccs) === 1,
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setFormError(null);
    setFormValue(emptyFormValue);
  };

  const handleDelete = async (user: User) => {
    const label = [user.first_name, user.last_name].filter(Boolean).join(' ');
    const confirmed = window.confirm(`Delete user ${label || user.login || user.id}?`);
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      await apiRequest(`/users/${user.id}`, { method: 'DELETE' });
      await loadUsers();
    } catch (e) {
      console.error('Error deleting user:', e);
      setError('Unable to delete user.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setFormError(null);
    const payload = {
      first_name: formValue.first_name.trim(),
      last_name: formValue.last_name.trim(),
      email: formValue.email.trim(),
      login: formValue.login.trim(),
      password: formValue.password,
      authcode: formValue.authcode.trim(),
      system_role: formValue.system_role,
      is_active: formValue.is_active ? 1 : 0,
      is_ccs: formValue.is_ccs ? 1 : 0,
    };

    if (
      !payload.first_name ||
      !payload.last_name ||
      !payload.email ||
      !payload.login ||
      !payload.password ||
      !payload.authcode ||
      payload.system_role === ''
    ) {
      setFormError('All fields are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isEditing && formValue.id) {
        await apiRequest(`/users/${formValue.id}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        await apiRequest('/users', {
          method: 'POST',
          body: payload,
        });
      }

      await loadUsers();
      setIsCreating(false);
      setIsEditing(false);
      setFormValue(emptyFormValue);
    } catch (e) {
      console.error('Error saving user:', e);
      setFormError('Unable to save user. Please check the fields.');
    } finally {
      setLoading(false);
    }
  };

  const formTitle = useMemo(
    () => (isEditing ? 'Edit user' : 'Add user'),
    [isEditing]
  );

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
              <th>Email</th>
              <th>Login</th>
              <th>Role</th>
              <th>Status</th>
              <th></th>
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
                  <td>{user.email || '-'}</td>
                  <td>{user.login || '-'}</td>
                  <td>{user.system_role ?? '-'}</td>
                  <td>{Number(user.is_active) === 1 ? 'Active' : 'Inactive'}</td>
                  <td className="users-actions">
                    <button
                      type="button"
                      className="btn-icon-small"
                      onClick={() => handleEditClick(user)}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn-icon-small danger"
                      onClick={() => handleDelete(user)}
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  const formSlot = (
    <div className="users-form">
      <h3>{formTitle}</h3>
      {formError && <div className="users-form__error">{formError}</div>}
      <div className="users-form__grid">
        <div className="users-form__row">
          <label>
            First name
            <input
              type="text"
              value={formValue.first_name}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, first_name: e.target.value }))
              }
            />
          </label>
          <label>
            Last name
            <input
              type="text"
              value={formValue.last_name}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, last_name: e.target.value }))
              }
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={formValue.email}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="users-form__row">
          <label>
            Login
            <input
              type="text"
              value={formValue.login}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, login: e.target.value }))
              }
            />
          </label>
          <label>
            Password
            <input
              type="text"
              value={formValue.password}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, password: e.target.value }))
              }
            />
          </label>
          <label>
            Auth code
            <input
              type="text"
              value={formValue.authcode}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, authcode: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="users-form__row">
          <label>
            System role
            <select
              value={formValue.system_role}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, system_role: e.target.value }))
              }
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={String(role.id)}>
                  {role.name || role.label || role.id}
                </option>
              ))}
            </select>
          </label>
          <label className="users-form__checkbox users-form__checkbox--inline">
            <input
              type="checkbox"
              checked={formValue.is_active}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, is_active: e.target.checked }))
              }
            />
            Active
          </label>
          <label className="users-form__checkbox users-form__checkbox--inline">
            <input
              type="checkbox"
              checked={formValue.is_ccs}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, is_ccs: e.target.checked }))
              }
            />
            Is CCS
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <ManagePage
      title="Users"
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

export default UsersPage;
