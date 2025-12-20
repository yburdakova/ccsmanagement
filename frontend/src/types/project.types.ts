export interface Project {
  id: number;
  code: string;
  name: string;

  project_type: string | null;
  project_status: string | null;
  item_type: string | null;
  customer_name: string | null;

  created_at: string;
}

export interface ProjectCreateDTO {
  code: string;
  name: string;
  type_id: number;
  item_id: number;
  customer_id: number;
}

export interface ProjectUpdateDTO {
  name?: string;
  type_id?: number;
  item_id?: number;
  customer_id?: number;
  project_status_id?: number;
}

export type ProjectFormValue = {
  id?: number;
  name: string;
  type_code: string;
  project_status_id: number | null;
  customer_id: number | null;
  item_id: number | null;
  unit_id: number | null;  
};

export type ProjectFormLookups = {
  projectTypes: { id: number; code: string; label: string }[];
  statuses: { id: number; label: string }[];
  customers: { id: number; name: string }[];
  items: { id: number; name: string }[];
  units: { id: number; name: string }[];
  users: { id: number; fullName: string }[];
  roles: { id: number; label: string }[];
  tasks: { id: number; description: string }[];
};


export type TypeOption = { code: string; label: string };
export type StatusOption = { id: number; label: string };
export type CustomerOption = { id: number; name: string };
export type ItemOption = { id: number; name: string };
export type UnitOption = { id: number; name: string };
export type UserOption = { id: number; fullName: string };
export type RoleOption = { id: number; label: string };
export type TaskOption = { id: number; description: string };

export type ProjectFormProps = {
  mode: 'create' | 'edit';
  value: ProjectFormValue;
  onChange: (patch: Partial<ProjectFormValue>) => void;

    typeOptions: TypeOption[];
    statusOptions: StatusOption[];
    customerOptions: CustomerOption[];
    itemOptions: ItemOption[];
    unitOptions: UnitOption[];
    userOptions: UserOption[];
    roleOptions: RoleOption[];
    taskOptions: TaskOption[];
};

export type TeamRow = {
  id: string;
  userId: string;
  roleId: string;
};

export type TaskRow = {
  id: string;
  taskId: string;
  rolesId: string[];
};
