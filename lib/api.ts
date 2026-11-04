import type {
  FeeMode,
  ParcelStatus,
  PaymentMethod,
  Pricing,
} from "./prototype/types";
import type { PaginationState } from "./pagination";

export interface AccountPreferences {
  deliveryAlerts: boolean;
  collectionAlerts: boolean;
  compactView: boolean;
}

export type Vehicle = "motorcycle" | "bicycle" | "car";

export interface ApiRequestOptions {
  responseType?: "json" | "blob";
  signal?: AbortSignal;
}

export interface SettingsUpdate {
  name?: string;
  phone?: string | null;
  vehicle?: Vehicle;
  preferences?: Partial<AccountPreferences>;
}

export interface ApiToken {
  id: number;
  name: string;
  is_current: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface DirectoryFilters extends PaginationState {
  query: string;
  archived: boolean;
}

/** Encodes account directory search and server pagination without accepting an owner from the client. */
export function directoryPath(
  kind: "customers" | "sellers",
  filters: DirectoryFilters,
): string {
  const params = new URLSearchParams({
    page: String(filters.page),
    per_page: String(filters.perPage),
    archived: filters.archived ? "1" : "0",
  });
  const query = filters.query.trim();
  if (query) params.set("q", query);
  return `/${kind}?${params}`;
}

export interface NewBatch {
  name: string;
  start: string;
  end: string;
}

export interface ApiBatch extends NewBatch {
  id: number;
  period: "current" | "previous" | "upcoming";
  created_at: string;
}

export interface BatchPage extends PaginatedResponse<ApiBatch> {
  current_week: NewBatch;
}

export interface NewCustomer {
  name: string;
  phone: string | null;
  address: { label: string; text: string | null };
}

export interface ApiAddress {
  id: number;
  label: string;
  text: string | null;
  latitude: number | null;
  longitude: number | null;
  verified_at: string | null;
  gps_accuracy: number | null;
  gps_captured_at: string | null;
  location_corrected: boolean;
  location_version: number;
  archived_at: string | null;
}

export interface ApiCustomer {
  id: number;
  name: string;
  phone: string | null;
  addresses: ApiAddress[];
  archived_at: string | null;
}

export interface NewSeller {
  name: string;
  contact: string | null;
  mode: FeeMode;
  fee: number;
}

export interface ApiSeller extends NewSeller {
  id: number;
  archived_at: string | null;
}

export interface NewParcel {
  operation_id: string;
  batch_id: number;
  customer_id: number;
  address_id: number;
  seller_id: number;
  description: string;
  note: string;
  quote: number;
  fee: number;
  mode: FeeMode;
  expected_method: PaymentMethod;
  override_reason?: string;
}

export interface ApiParcel {
  id: number;
  reference: string;
  description: string;
  note: string | null;
  customer: { id: number; name: string; phone: string | null };
  address: ApiAddress;
  seller: { id: number; name: string };
  batch: { id: number; name: string; start: string; end: string };
  pricing: Pricing;
  expected_method: PaymentMethod;
  override_reason: string | null;
  status: ParcelStatus;
  retry_at: string | null;
  receipt: {
    method: PaymentMethod;
    amount: number;
    reference: string | null;
    confirmed_at: string;
  } | null;
  attempts?: {
    id: number;
    outcome: ParcelStatus;
    note: string;
    retry_at: string | null;
    at: string;
  }[];
  created_at: string;
}

export interface ApiDelivery {
  key: string;
  customer: ApiParcel["customer"];
  address: ApiParcel["address"];
  parcels: ApiParcel[];
}

export interface MapCandidate extends ApiDelivery {
  duration_seconds: number | null;
  distance_meters: number | null;
}

export interface MapOverview {
  vehicle: Vehicle | null;
  configured: boolean;
  quota: { used: number; limit: number; window: "rolling_24h" };
  candidates: MapCandidate[];
  compared_count: number;
  estimated_at: string | null;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  vehicle: Vehicle | null;
  preferences: AccountPreferences;
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

/** Reuse actionable field errors across account forms, with the normal connection fallback. */
export function validationMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return Object.values(error.errors).flat().join(" ") || error.message;
  }
  return errorMessage(error);
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

/** Share cookie-free JSON/binary transport, cancellation and sanitized errors across every account request. */
export async function apiRequest<T>(
  path: string,
  method = "GET",
  data?: unknown,
  token?: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method,
      credentials: "omit",
      cache: "no-store",
      signal: options.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
      headers: {
        Accept:
          options.responseType === "blob" ? "image/png" : "application/json",
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
  if (response.ok && options.responseType === "blob") {
    if (
      !response.headers
        .get("Content-Type")
        ?.toLowerCase()
        .startsWith("image/png")
    ) {
      throw new ApiError(
        "Hatid returned an unreadable map tile. Please try again.",
        response.status,
      );
    }
    return (await response.blob()) as T;
  }
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
      // A successful status without its body cannot confirm whether a mutation committed.
      0,
    );
  return payload as T;
}

export const authApi = {
  login: (data: Credentials) =>
    apiRequest<{ data: AuthSession }>("/auth/login", "POST", {
      ...data,
      email: normalizeEmail(data.email),
    }),
  /** Signup passes the rider's explicit vehicle; Laravel validates the allowed choices. */
  register: (
    data: Credentials & NewPassword & { name: string; vehicle?: Vehicle },
  ) =>
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
