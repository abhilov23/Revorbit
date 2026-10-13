const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000";
const API_PREFIX = "/api/v1";

/**
 * Error thrown for any non-2xx response.
 *
 * Extends `Error` so `instanceof` and `.stack` behave, which the previous plain
 * object literal did not.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  /** True when the session is missing or expired and the user must sign in. */
  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}

/** Raised when the API could not be reached at all. */
export class NetworkError extends Error {
  constructor(message = "Could not reach the Revorbit API.") {
    super(message);
    this.name = "NetworkError";
  }
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

let redirecting = false;

/** Sends the user to sign-in once, when the session turns out to be dead. */
function redirectToLogin(): void {
  if (redirecting || typeof window === "undefined") {
    return;
  }
  redirecting = true;

  const next = window.location.pathname + window.location.search;
  const target =
    next && next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login";

  window.location.assign(target);
}

/**
 * Generates an idempotency key for a mutating request.
 *
 * Sent so a retried POST cannot repeat a side effect that already applied —
 * a dropped connection would otherwise leave the user clicking twice.
 */
function idempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;

  const method = (init.method ?? "GET").toUpperCase();

  // Normalized through `Headers` because `init.headers` may be an array, a
  // Headers instance, or a plain object.
  const headers = new Headers(init.headers);

  headers.set("Content-Type", "application/json");

  if (
    method !== "GET" &&
    method !== "HEAD" &&
    !headers.has("Idempotency-Key")
  ) {
    headers.set("Idempotency-Key", idempotencyKey());
  }

  try {
    response = await fetch(`${API_ORIGIN}${API_PREFIX}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    // A transport failure is surfaced as a distinct error type so pages can
    // tell "the server is down" apart from "the request was rejected".
    throw new NetworkError();
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success) {
    const status = response.status;
    const code = body?.error?.code ?? "UNKNOWN_ERROR";
    const message = body?.error?.message ?? "Request failed";

    if (status === 401) {
      redirectToLogin();
    }

    throw new ApiError(status, code, message);
  }

  return body.data;
}

export const api = {
  get<T>(path: string) {
    return request<T>(path);
  },

  post<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
    });
  },

  put<T>(path: string, body?: unknown) {
    return request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body ?? {}),
    });
  },

  del<T>(path: string) {
    return request<T>(path, {
      method: "DELETE",
    });
  },
};

/** Normalises anything thrown by the client into a message to show the user. */
export function errorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (error instanceof ApiError || error instanceof NetworkError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
