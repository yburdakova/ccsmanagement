import { useEffect, useState } from 'react';
import { apiRequest } from '../../services/apiClient';
import type { Project } from '../../types/project.types';
import './InventoryItemsPage.css';

const InventoryItemsPage = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemCategoryId, setItemCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: number; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [itemCount, setItemCount] = useState('1');
  const [items, setItems] = useState<
    {
      id: number;
      code: string;
      label: string;
      statusLabel: string | null;
      createdAt: string;
      updatedAt: string | null;
    }[]
  >([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userId = user?.id ?? null;

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await apiRequest<Project[]>('/projects');
        setProjects(data);
      } catch (e) {
        console.error('Error loading projects:', e);
        setError('Unable to load projects.');
      } finally {
        setLoading(false);
      }
    };

    loadProjects();
  }, []);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        if (!selectedProjectId) {
          setCategories([]);
          setItems([]);
          setItemsError(null);
          return;
        }
        const selectedProject = projects.find(
          (project) => String(project.id) === String(selectedProjectId)
        );
        const typeCode = selectedProject?.code ?? null;
        const query = typeCode ? `?projectTypeCode=${typeCode}` : '';
        const data = await apiRequest<{ id: number; label: string }[]>(
          `/lookups/item-categories${query}`
        );
        setCategories(data);
      } catch (e) {
        console.error('Error loading item categories:', e);
      }
    };

    loadCategories();
  }, [projects, selectedProjectId]);

  useEffect(() => {
    const loadItems = async () => {
      if (!selectedProjectId) {
        return;
      }

      try {
        setItemsLoading(true);
        setItemsError(null);
        const data = await apiRequest<
          {
            id: number;
            code: string;
            label: string;
            statusLabel: string | null;
            createdAt: string;
            updatedAt: string | null;
          }[]
        >(`/items?projectId=${selectedProjectId}`);
        setItems(data);
      } catch (e) {
        console.error('Error loading items:', e);
        setItemsError('Unable to load inventory items.');
      } finally {
        setItemsLoading(false);
      }
    };

    loadItems();
  }, [selectedProjectId]);

  const resetModal = () => {
    setItemCategoryId('');
    setItemCount('1');
  };

  const handleSaveItem = async () => {
    if (!selectedProjectId) {
      setError('Project is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await apiRequest('/items', {
        method: 'POST',
        body: {
          projectId: Number(selectedProjectId),
          categoryId: itemCategoryId ? Number(itemCategoryId) : null,
          userId,
          count: Number(itemCount || 1),
        },
      });
      const data = await apiRequest<
        {
          id: number;
          code: string;
          label: string;
          statusLabel: string | null;
          createdAt: string;
          updatedAt: string | null;
        }[]
      >(`/items?projectId=${selectedProjectId}`);
      setItems(data);
      resetModal();
      setIsModalOpen(false);
    } catch (e) {
      console.error('Error creating inventory item:', e);
      setError('Unable to register inventory item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inventory-items-page">
      <div className="inventory-items-page__header">
        <h2>Inventory Items</h2>
        <button
          type="button"
          className="inventory-items-page__add-btn"
          onClick={() => setIsModalOpen(true)}
          disabled={!selectedProjectId}
        >
          Register Inventory Item
        </button>
      </div>
      <div className="inventory-items-page__selector">
        <label htmlFor="inventory-project-select">Project</label>
        <select
          id="inventory-project-select"
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          disabled={loading}
        >
          <option value="">Select project</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {loading && <span className="inventory-items-page__status">Loading...</span>}
        {error && <span className="inventory-items-page__error">{error}</span>}
      </div>
      {selectedProjectId && (
        <div className="inventory-items-page__table">
          <div className="inventory-items-page__table-header">
            <span>#</span>
            <span>Label</span>
            <span>Code</span>
            <span>Status</span>
            <span>Updated</span>
          </div>
          {itemsLoading && (
            <div className="inventory-items-page__table-row">
              <span>Loading...</span>
            </div>
          )}
          {itemsError && (
            <div className="inventory-items-page__table-row inventory-items-page__table-error">
              {itemsError}
            </div>
          )}
          {!itemsLoading && !itemsError && items.length === 0 && (
            <div className="inventory-items-page__table-row">
              <span>No inventory items yet.</span>
            </div>
          )}
          {!itemsLoading &&
            !itemsError &&
            items.map((item, index) => (
              <div key={item.id} className="inventory-items-page__table-row">
                <span>{index + 1}</span>
                <span>{item.label}</span>
                <span>{item.code}</span>
                <span>{item.statusLabel || 'Registered'}</span>
                <span>
                  {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
        </div>
      )}

      {isModalOpen && (
        <div className="inventory-items-page__modal">
          <div className="inventory-items-page__modal-card">
            <h3>Register Inventory Item</h3>
            {error && <div className="inventory-items-page__error">{error}</div>}
            <label>
              Category
              <select
                value={itemCategoryId}
                onChange={(e) => setItemCategoryId(e.target.value)}
              >
                <option value="">Select category</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Number of items
              <input
                type="number"
                min="1"
                value={itemCount}
                onChange={(e) => setItemCount(e.target.value)}
              />
            </label>
            <div className="inventory-items-page__modal-actions">
              <button
                type="button"
                onClick={handleSaveItem}
                disabled={saving || Number(itemCount || 0) < 1}
              >
                Save
              </button>
              <button
                type="button"
                className="inventory-items-page__cancel-btn"
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
    </div>
  );
};

export default InventoryItemsPage;
