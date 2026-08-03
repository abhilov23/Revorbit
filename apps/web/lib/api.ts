const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? "http://localhost:3000";
const API_PREFIX = "/api/v1";

export interface ApiError {
  status: number;
  code: string;
  message: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${API_PREFIX}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (response.status === 401 && !init.method && typeof window !== "undefined") {
    window.location.assign("/login");
  }

  if (!response.ok || !body?.success) {
    const error: ApiError = {
      status: response.status,
      code: body?.error?.code ?? "UNKNOWN_ERROR",
      message: body?.error?.message ?? "Request failed",
    };
    throw error;
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

  put<T>(path: string, body: unknown) {
    return request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  del<T>(path: string) {
    return request<T>(path, {
      method: "DELETE",
    });
  },

  postForm<T>(path: string, body: URLSearchParams) {
    return request<T>(path, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  },
};
