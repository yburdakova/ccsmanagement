import { useEffect, useMemo, useState } from 'react';
import './CustomersPage.css';
import ManagePage from '../../layouts/ManagePageLayout/ManagePageLayout';
import { apiRequest } from '../../services/apiClient';
import type { Customer } from '../../types/customer.types';

type CustomerFormValue = {
  id?: number;
  name: string;
  state: string;
  county: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
};

const emptyFormValue: CustomerFormValue = {
  name: '',
  state: '',
  county: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
};

const CustomersPage = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formValue, setFormValue] = useState<CustomerFormValue>(emptyFormValue);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiRequest<Customer[]>('/customers');
      setCustomers(data);
    } catch (e) {
      console.error('Error loading customers:', e);
      setError('Unable to load customers. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const handleAddClick = () => {
    setIsCreating(true);
    setIsEditing(false);
    setFormError(null);
    setFormValue(emptyFormValue);
  };

  const handleEditClick = (customer: Customer) => {
    setIsEditing(true);
    setIsCreating(false);
    setFormError(null);
    setFormValue({
      id: customer.id,
      name: customer.name ?? '',
      state: customer.state ?? '',
      county: customer.county ?? '',
      contact_name: customer.contact_name ?? '',
      contact_email: customer.contact_email ?? '',
      contact_phone: customer.contact_phone ?? '',
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setFormError(null);
    setFormValue(emptyFormValue);
  };

  const handleDelete = async (customer: Customer) => {
    const confirmed = window.confirm(`Delete customer ${customer.name || customer.id}?`);
    if (!confirmed) return;

    try {
      setLoading(true);
      setError(null);
      await apiRequest(`/customers/${customer.id}`, { method: 'DELETE' });
      await loadCustomers();
    } catch (e) {
      console.error('Error deleting customer:', e);
      setError('Unable to delete customer.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setFormError(null);
    const payload = {
      name: formValue.name.trim(),
      state: formValue.state.trim(),
      county: formValue.county.trim(),
      contact_name: formValue.contact_name.trim(),
      contact_email: formValue.contact_email.trim(),
      contact_phone: formValue.contact_phone.trim(),
    };

    if (
      !payload.name ||
      !payload.state ||
      !payload.county ||
      !payload.contact_name ||
      !payload.contact_email ||
      !payload.contact_phone
    ) {
      setFormError('All fields are required.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isEditing && formValue.id) {
        await apiRequest(`/customers/${formValue.id}`, {
          method: 'PUT',
          body: payload,
        });
      } else {
        await apiRequest('/customers', {
          method: 'POST',
          body: payload,
        });
      }

      await loadCustomers();
      setIsCreating(false);
      setIsEditing(false);
      setFormValue(emptyFormValue);
    } catch (e) {
      console.error('Error saving customer:', e);
      setFormError('Unable to save customer. Please check the fields.');
    } finally {
      setLoading(false);
    }
  };

  const formTitle = useMemo(
    () => (isEditing ? 'Edit customer' : 'Add customer'),
    [isEditing]
  );

  const listSlot = (
    <div className="customers-table-wrapper">
      {loading && <div>Loading customers...</div>}
      {error && <div className="error">{error}</div>}

      {!loading && !error && customers.length === 0 && (
        <div>No customers found.</div>
      )}

      {!loading && !error && customers.length > 0 && (
        <table className="customers-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>State</th>
              <th>County</th>
              <th>Contact</th>
              <th>Email</th>
              <th>Phone</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer, index) => (
              <tr key={customer.id ?? `${customer.name}-${index}`}>
                <td>{index + 1}</td>
                <td>{customer.name || '-'}</td>
                <td>{customer.state || '-'}</td>
                <td>{customer.county || '-'}</td>
                <td>{customer.contact_name || '-'}</td>
                <td>{customer.contact_email || '-'}</td>
                <td>{customer.contact_phone || '-'}</td>
                <td className="customers-actions">
                  <button
                    type="button"
                    className="btn-icon-small"
                    onClick={() => handleEditClick(customer)}
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    type="button"
                    className="btn-icon-small danger"
                    onClick={() => handleDelete(customer)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const formSlot = (
    <div className="customers-form">
      <h3>{formTitle}</h3>
      {formError && <div className="customers-form__error">{formError}</div>}
      <div className="customers-form__grid">
        <div className="customers-form__row">
          <label>
            Name
            <input
              type="text"
              value={formValue.name}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, name: e.target.value }))
              }
            />
          </label>
          <label>
            State
            <input
              type="text"
              value={formValue.state}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, state: e.target.value }))
              }
            />
          </label>
          <label>
            County
            <input
              type="text"
              value={formValue.county}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, county: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="customers-form__row">
          <label>
            Contact name
            <input
              type="text"
              value={formValue.contact_name}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, contact_name: e.target.value }))
              }
            />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={formValue.contact_email}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, contact_email: e.target.value }))
              }
            />
          </label>
          <label>
            Contact phone
            <input
              type="text"
              value={formValue.contact_phone}
              onChange={(e) =>
                setFormValue((prev) => ({ ...prev, contact_phone: e.target.value }))
              }
            />
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <ManagePage
      title="Customers"
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

export default CustomersPage;
