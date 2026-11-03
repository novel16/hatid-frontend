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

export type StoredAuthSession = Pick<
  AuthSession,
  "access_token" | "expires_at"
>;

/** Accept only usable tab credentials; stored user identities are never trusted. */
export function parseStoredSession(
  value: string | null,
): StoredAuthSession | null {
  try {
    const candidate = JSON.parse(value ?? "null");
    if (
      !candidate ||
      typeof candidate.access_token !== "string" ||
      !candidate.access_token ||
      /\s/.test(candidate.access_token) ||
      typeof candidate.expires_at !== "string" ||
      !(Date.parse(candidate.expires_at) > Date.now())
    )
      return null;
    return {
      access_token: candidate.access_token,
      expires_at: candidate.expires_at,
    };
  } catch {
    return null;
  }
}

/** Login and refresh both require an unexpired token and an API-verified rider. */
export async function verifyRiderSession(
  candidate: StoredAuthSession,
): Promise<AuthSession> {
  if (!(Date.parse(candidate.expires_at) > Date.now())) {
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  const { data: user } = await authApi.me(candidate.access_token);
  if (user.role !== "rider") {
    throw new ApiError(
      "This account does not have rider access. Please sign in again.",
      403,
    );
  }
  if (!(Date.parse(candidate.expires_at) > Date.now())) {
    throw new ApiError("Your session has expired. Sign in again.", 401);
  }
  return {
    access_token: candidate.access_token,
    expires_at: candidate.expires_at,
    token_type: "Bearer",
    user,
  };
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
