import React from 'react';
import './ManagePageLayout.css';
import type { ManagePageProps } from '../../types/layouts.types';

const ManagePage: React.FC<ManagePageProps> = ({
  title,
  isEditing,
  isCreating,
  onAdd,
  onCancel,
  onSave,
  listSlot,
  formSlot
}) => {
  return (
    <div className="manage-page">
      {/* Top Bar */}
      <div className="manage-page__top">
        <h2 className="manage-page__title">{title}</h2>

        <div className="manage-page__actions">
          {!isCreating && !isEditing && (
            <button className="btn btn-icon" onClick={onAdd}>
            <span className="material-symbols-outlined">add_notes</span>
          </button>
          )}

          {(isCreating || isEditing) && (
            <>
              <button className="btn btn-primary" onClick={onSave}>
                <span className="material-symbols-outlined">save</span>
                Save
              </button>

              <button className="btn btn-secondary" onClick={onCancel}>
                <span className="material-symbols-outlined">close</span>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="manage-page__content">
        {isCreating || isEditing ? formSlot : listSlot}
      </div>
    </div>
  );
};

export default ManagePage;
