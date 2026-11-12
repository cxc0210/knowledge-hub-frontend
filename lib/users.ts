export type UserListItem = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  role: {
    code: string;
    name: string;
  };
  status: number;
  email_verified_at: string | null;
  last_login_at: string | null;
  password_changed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserListResponse = {
  items: UserListItem[];
  page: number;
  size: number;
  total: number;
  pages: number;
};
