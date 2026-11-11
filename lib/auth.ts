export const AUTH_COOKIE_NAME = "kh_access_token";

export const BACKEND_API_URL = (
  process.env.BACKEND_API_URL ?? "http://127.0.0.1:8000"
).replace(/\/$/, "");

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  role: {
    code: string;
    name: string;
  };
};
