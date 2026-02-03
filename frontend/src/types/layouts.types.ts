import React from 'react';

export type ManagePageProps = {
  title: string;
  isEditing: boolean;
  isCreating: boolean;
  onAdd: () => void;
  onCancel: () => void;
  onSave: () => void;
  showAdd?: boolean;
  listSlot: React.ReactNode;
  formSlot: React.ReactNode | null;
};
