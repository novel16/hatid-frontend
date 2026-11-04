import assert from "node:assert/strict";
import test, { afterEach, mock } from "node:test";
import {
  ApiError,
  apiRequest,
  authApi,
  parseStoredSession,
  verifyRiderSession,
  workspacePath,
} from "./api.ts";

afterEach(() => mock.restoreAll());

const credentials = {
  email: "  RIDER@EXAMPLE.TEST ",
  password: "  HatidPassword123  ",
  device_name: "Test browser",
};
const user = {
  id: 1,
  name: "Test Rider",
  email: "rider@example.test",
  role: "rider",
  email_verified_at: null,
  created_at: "2026-11-01T00:00:00Z",
};
const session = {
  user,
  access_token: "test-token",
  token_type: "Bearer",
  expires_at: "2026-12-01T00:00:00Z",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

function captureRequests(...responses: Response[]) {
  const calls: { url: string; options: RequestInit }[] = [];
  mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      calls.push({ url: String(url), options });
      assert.ok(responses.length, "Unexpected extra API request");
      return responses.shift()!;
    },
  );
  return calls;
}

/** Stored JSON is untrusted and may retain only a usable token and its expiry. */
test("tab session parsing rejects malformed or expired data and drops cached identity", () => {
  const candidate = {
    access_token: "stored-token",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  assert.deepEqual(
    parseStoredSession(
      JSON.stringify({ ...candidate, user, password: "secret" }),
    ),
    candidate,
  );
  for (const value of [
    null,
    "bad json",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...candidate, access_token: "" }),
    JSON.stringify({ ...candidate, access_token: "token\r\nInjected" }),
    JSON.stringify({ ...candidate, expires_at: 123 }),
    JSON.stringify({ ...candidate, expires_at: "invalid" }),
    JSON.stringify({ ...candidate, expires_at: new Date(0).toISOString() }),
  ]) {
    assert.equal(parseStoredSession(value), null);
  }
});

/** A restored account must come from the API rather than an identity in browser storage. */
test("rider session verification reloads the user using cookie-free Bearer auth", async () => {
  const candidate = {
    access_token: "stored-token",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  const calls = captureRequests(json({ data: user }));
  assert.deepEqual(await verifyRiderSession(candidate), {
    ...candidate,
    user,
    token_type: "Bearer",
  });
  assert.ok(calls[0].url.endsWith("/auth/me"));
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(
    new Headers(calls[0].options.headers).get("Authorization"),
    "Bearer stored-token",
  );
});

/** Expired tokens must not trigger account requests or grant a workspace session. */
test("expired sessions are rejected before contacting the API", async () => {
  const calls = captureRequests();
  await assert.rejects(
    verifyRiderSession({
      access_token: "expired",
      expires_at: new Date(0).toISOString(),
    }),
    /** The provider uses 401 to discard expired tab credentials. */
    (cause: unknown) => cause instanceof ApiError && cause.status === 401,
  );
  assert.equal(calls.length, 0);
});

/** Admin credentials must never restore access to the rider application. */
test("a verified admin account is rejected by the rider session helper", async () => {
  captureRequests(json({ data: { ...user, role: "admin" } }));
  await assert.rejects(
    verifyRiderSession({
      access_token: "admin",
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }),
    /** Forbidden credentials are discarded rather than treated as a connection failure. */
    (cause: unknown) => cause instanceof ApiError && cause.status === 403,
  );
});

/** Revocation and connectivity stay distinct so the provider can clear or retry appropriately. */
test("session verification preserves invalid-token and connection failure status", async () => {
  const candidate = {
    access_token: "stored-token",
    expires_at: new Date(Date.now() + 60_000).toISOString(),
  };
  captureRequests(json({ message: "Unauthenticated." }, 401));
  await assert.rejects(
    verifyRiderSession(candidate),
    /** An API rejection requires a fresh sign-in. */
    (cause: unknown) => cause instanceof ApiError && cause.status === 401,
  );
  /** Simulate an unavailable API without accepting cached user details. */
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    verifyRiderSession(candidate),
    /** A connection failure must remain retryable, not be mistaken for invalid credentials. */
    (cause: unknown) => cause instanceof ApiError && cause.status === 0,
  );
});

test("login normalizes email while preserving passwords and omitting cookies", async () => {
  const calls = captureRequests(json({ data: session }));
  assert.deepEqual(await authApi.login(credentials), { data: session });
  const call = calls[0];
  assert.ok(call.url.endsWith("/api/v1/auth/login"));
  assert.equal(call.options.method, "POST");
  assert.equal(call.options.credentials, "omit");
  assert.equal(call.options.cache, "no-store");
  assert.deepEqual(JSON.parse(String(call.options.body)), {
    ...credentials,
    email: "rider@example.test",
  });
  assert.equal(new Headers(call.options.headers).get("Authorization"), null);
});

test("registration trims account identity and preserves both password fields", async () => {
  const calls = captureRequests(json({ data: session }, 201));
  await authApi.register({
    ...credentials,
    name: "  Test Rider ",
    password_confirmation: credentials.password,
  });
  assert.ok(calls[0].url.endsWith("/auth/register"));
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    ...credentials,
    email: "rider@example.test",
    name: "Test Rider",
    password_confirmation: credentials.password,
  });
});

test("recovery and reset share email normalization without altering reset secrets", async () => {
  const calls = captureRequests(
    json({ message: "Sent" }),
    json({ message: "Updated" }),
  );
  await authApi.forgotPassword(credentials.email);
  await authApi.resetPassword({
    email: credentials.email,
    token: "reset-secret",
    password: credentials.password,
    password_confirmation: credentials.password,
  });
  assert.ok(calls[0].url.endsWith("/auth/forgot-password"));
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), {
    email: "rider@example.test",
  });
  assert.ok(calls[1].url.endsWith("/auth/reset-password"));
  assert.deepEqual(JSON.parse(String(calls[1].options.body)), {
    email: "rider@example.test",
    token: "reset-secret",
    password: credentials.password,
    password_confirmation: credentials.password,
  });
});

test("current-user requests use the supplied Bearer token without a request body", async () => {
  const calls = captureRequests(json({ data: user }));
  assert.deepEqual(await authApi.me("test-token"), { data: user });
  assert.ok(calls[0].url.endsWith("/auth/me"));
  assert.equal(calls[0].options.method, "GET");
  assert.equal(
    new Headers(calls[0].options.headers).get("Authorization"),
    "Bearer test-token",
  );
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.body, undefined);
});

test("password change and logout accept empty successful responses", async () => {
  const calls = captureRequests(
    new Response(null, { status: 204 }),
    new Response(null, { status: 204 }),
  );
  const data = {
    current_password: credentials.password,
    password: "AnotherPassword123",
    password_confirmation: "AnotherPassword123",
  };
  assert.equal(
    await apiRequest("/auth/password", "PUT", data, "test-token"),
    undefined,
  );
  assert.equal(await authApi.logout("test-token"), undefined);
  assert.equal(calls[0].options.method, "PUT");
  assert.deepEqual(JSON.parse(String(calls[0].options.body)), data);
  assert.ok(calls[1].url.endsWith("/auth/logout"));
  assert.equal(calls[1].options.method, "POST");
  for (const call of calls)
    assert.equal(
      new Headers(call.options.headers).get("Authorization"),
      "Bearer test-token",
    );
});

test("validation errors retain field messages and discard malformed error entries", async () => {
  captureRequests(
    json(
      {
        message: "Review the fields.",
        errors: {
          email: ["Invalid email.", 42],
          password: { unsafe: "value" },
        },
      },
      422,
    ),
  );
  await assert.rejects(authApi.login(credentials), (cause: unknown) => {
    assert.ok(cause instanceof ApiError);
    assert.equal(cause.status, 422);
    assert.equal(cause.message, "Review the fields.");
    assert.deepEqual(cause.errors, { email: ["Invalid email."] });
    return true;
  });
});

for (const status of [401, 403, 429]) {
  test(`API status ${status} remains available to session handling`, async () => {
    captureRequests(json({ message: "Request rejected." }, status));
    await assert.rejects(
      authApi.me("test-token"),
      (cause: unknown) => cause instanceof ApiError && cause.status === status,
    );
  });
}

test("server failures show a useful message without exposing an HTML response", async () => {
  captureRequests(
    new Response("<html>private server details</html>", { status: 502 }),
  );
  await assert.rejects(authApi.me("test-token"), (cause: unknown) => {
    assert.ok(cause instanceof ApiError);
    assert.equal(cause.status, 502);
    assert.match(cause.message, /temporarily unavailable/);
    assert.doesNotMatch(cause.message, /private server details/);
    return true;
  });
});

test("an unreadable successful response is rejected rather than accepted as a session", async () => {
  captureRequests(new Response("<html>Not JSON</html>"));
  await assert.rejects(
    authApi.login(credentials),
    (cause: unknown) =>
      cause instanceof ApiError && /unreadable response/.test(cause.message),
  );
});

test("network errors have a consistent connection message", async () => {
  mock.method(globalThis, "fetch", async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(
    authApi.login(credentials),
    (cause: unknown) =>
      cause instanceof ApiError &&
      cause.status === 0 &&
      /connection/.test(cause.message),
  );
});

test("return paths preserve internal delivery navigation and reject external or auth destinations", () => {
  assert.equal(
    workspacePath("/deliveries/p1?view=parcels#details"),
    "/deliveries/p1?view=parcels#details",
  );
  for (const value of [
    null,
    "https://example.test",
    "//example.test",
    "javascript:alert(1)",
    "/",
    "/%6Cogin",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/welcome",
  ]) {
    assert.equal(workspacePath(value), "/dashboard");
  }
});
