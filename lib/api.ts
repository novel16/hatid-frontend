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

export interface Credentials {
  email: string;
  password: string;
  device_name: string;
}

export interface NewPassword {
  password: string;
  password_confirmation: string;
}

export type DirectoryKind = "customers" | "sellers";
export type AuthenticatedRequest = <T>(
  path: string,
  method?: string,
  data?: unknown,
) => Promise<T>;

export interface ApiAddress {
  id: number;
  label: string;
  text: string | null;
  latitude: number | null;
  longitude: number | null;
  verified_at: string | null;
  archived_at: string | null;
}

export interface ApiCustomer {
  id: number;
  name: string;
  phone: string | null;
  addresses: ApiAddress[];
  archived_at: string | null;
}

export interface ApiSeller {
  id: number;
  name: string;
  contact: string | null;
  mode: "included" | "excluded";
  fee: number;
  archived_at: string | null;
}

export interface ApiPage<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface DirectoryFilters {
  query: string;
  page: number;
  archived: boolean;
}

/** Builds an encoded, private directory query shared by both management screens. */
export function directoryPath(
  kind: DirectoryKind,
  filters: DirectoryFilters,
): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    per_page: "25",
    archived: filters.archived ? "1" : "0",
  });
  const query = filters.query.trim();
  if (query) params.set("q", query);
  return `/${kind}?${params}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly errors: Record<string, string[]>;

  constructor(
    message: string,
    status: number,
    errors: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function errorMessage(
  error: unknown,
  fallback = "Unable to complete this request.",
): string {
  return error instanceof Error ? error.message : fallback;
}

export function workspacePath(value: string | null): string {
  const base = "https://hatid.invalid";
  try {
    const url = new URL(value ?? "/dashboard", base);
    const authPage =
      /^\/(login|signup|forgot-password|reset-password|welcome)(\/|$)/.test(
        decodeURIComponent(url.pathname),
      );
    return url.origin === base && url.pathname !== "/" && !authPage
      ? url.pathname + url.search + url.hash
      : "/dashboard";
  } catch {
    return "/dashboard";
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
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      credentials: "omit",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "application/json",
        ...(data !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: data !== undefined ? JSON.stringify(data) : undefined,
    });
  } catch {
    throw new ApiError(
      "Couldn’t reach Hatid. Check your connection and try again.",
      0,
    );
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errors: Record<string, string[]> = {};
    if (payload?.errors && typeof payload.errors === "object") {
      for (const [field, messages] of Object.entries(payload.errors)) {
        if (Array.isArray(messages)) {
          errors[field] = messages.filter(
            (message): message is string => typeof message === "string",
          );
        }
      }
    }
    const message =
      response.status >= 500
        ? "Hatid is temporarily unavailable. Please try again."
        : typeof payload?.message === "string"
          ? payload.message
          : "Unable to complete this request.";
    throw new ApiError(message, response.status, errors);
  }

  if (payload === null)
    throw new ApiError(
      "Hatid returned an unreadable response. Please try again.",
      response.status,
    );
  return payload as T;
}

export const authApi = {
  login: (data: Credentials) =>
    apiRequest<{ data: AuthSession }>("/auth/login", "POST", {
      ...data,
      email: normalizeEmail(data.email),
    }),
  register: (data: Credentials & NewPassword & { name: string }) =>
    apiRequest<{ data: AuthSession }>("/auth/register", "POST", {
      ...data,
      name: data.name.trim(),
      email: normalizeEmail(data.email),
    }),
  me: (token: string) =>
    apiRequest<{ data: ApiUser }>("/auth/me", "GET", undefined, token),
  forgotPassword: (email: string) =>
    apiRequest<{ message: string }>("/auth/forgot-password", "POST", {
      email: normalizeEmail(email),
    }),
  resetPassword: (data: NewPassword & { email: string; token: string }) =>
    apiRequest<{ message: string }>("/auth/reset-password", "POST", {
      ...data,
      email: normalizeEmail(data.email),
    }),
  logout: (token: string) =>
    apiRequest<void>("/auth/logout", "POST", undefined, token),
};
