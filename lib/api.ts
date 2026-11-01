export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: "rider" | "admin";
  email_verified_at: string | null;
  created_at: string;
}

export interface AuthSession {
  user: ApiUser;
  access_token: string;
  token_type: "Bearer";
  expires_at: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost").replace(
  /\/$/,
  "",
);

export async function apiRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
  token?: string,
): Promise<T> {
  const response = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    credentials: "omit",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(data ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (response.status === 204) return undefined as T;
  const payload = await response.json();
  if (!response.ok)
    throw new ApiError(
      payload.message ?? "Unable to complete this request.",
      response.status,
      payload.errors ?? {},
    );
  return payload as T;
}

export const authApi = {
  login: (data: { email: string; password: string; device_name: string }) =>
    apiRequest<{ data: AuthSession }>("/auth/login", "POST", data),
  register: (data: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
    device_name: string;
  }) => apiRequest<{ data: AuthSession }>("/auth/register", "POST", data),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/forgot-password", "POST", { email }),
  resetPassword: (data: {
    email: string;
    token: string;
    password: string;
    password_confirmation: string;
  }) => apiRequest<{ message: string }>("/auth/reset-password", "POST", data),
  logout: (token: string) =>
    apiRequest<void>("/auth/logout", "POST", undefined, token),
};
