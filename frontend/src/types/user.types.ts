export type User = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  login: string | null;
  system_role: string | number | null;
  is_active: number | boolean | null;
};
