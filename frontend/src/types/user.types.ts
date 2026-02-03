export type User = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  login: string | null;
  password?: string | null;
  authcode?: string | null;
  system_role: string | number | null;
  is_active: number | boolean | null;
  is_ccs?: number | boolean | null;
};

export type SystemRole = {
  id: number;
  name: string;
  label?: string | null;
};
