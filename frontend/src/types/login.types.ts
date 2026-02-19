export type LoginResponse = {
  id: number;
  first_name: string;
  last_name: string;
  role: number;
  accessToken?: string | null;
  tokenType?: string | null;
  expiresIn?: string | null;
};
