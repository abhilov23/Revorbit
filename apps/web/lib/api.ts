import {
  demoRepositories,
  demoReviewDetail,
  demoReviews,
} from "@/lib/demo-workspace";

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

interface DemoRepository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  settings: {
    enabled: boolean;
    model: string;
    maxFiles: number;
    security?: boolean;
    performance?: boolean;
    bestPractices?: boolean;
  };
}

interface DemoWorkspace {
  repositories: DemoRepository[];
}

const DEMO_STORAGE_KEY = "revorbit-demo-workspace";
const DEMO_UNHANDLED = Symbol("demo-unhandled");
let demoModeActive = false;

export function isDemoModeActive() {
  return demoModeActive;
}

function initialDemoWorkspace(): DemoWorkspace {
  return {
    repositories: demoRepositories.map((repository) => ({
      ...repository,
      settings: { ...repository.settings },
    })),
  };
}

function readDemoWorkspace(): DemoWorkspace {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DemoWorkspace>;
      if (Array.isArray(parsed.repositories)) {
        return { repositories: parsed.repositories as DemoRepository[] };
      }
    }
  } catch {
    return initialDemoWorkspace();
  }
  return initialDemoWorkspace();
}

function saveDemoWorkspace(workspace: DemoWorkspace) {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    return;
  }
}

const availableRepositories = [
  { githubId: 1001, fullName: "acme/storefront", owner: "acme", name: "storefront", defaultBranch: "main" },
  { githubId: 1002, fullName: "acme/platform-api", owner: "acme", name: "platform-api", defaultBranch: "main" },
  { githubId: 1003, fullName: "acme/ops-dashboard", owner: "acme", name: "ops-dashboard", defaultBranch: "develop" },
  { githubId: 1004, fullName: "acme/mobile-app", owner: "acme", name: "mobile-app", defaultBranch: "main" },
];

function demoResponse<T>(path: string, init: RequestInit): T | typeof DEMO_UNHANDLED {
  const method = (init.method ?? "GET").toUpperCase();
  const normalizedPath = path.replace(/\/$/, "");
  const workspace = readDemoWorkspace();
  const body = typeof init.body === "string"
    ? JSON.parse(init.body) as Record<string, unknown>
    : {};

  if (method === "GET" && normalizedPath === "/auth/me") {
    return {
      user: {
        id: "sample-user",
        name: "Alex Morgan",
        email: "alex@example.com",
        login: "alexmorgan",
        avatarUrl: null,
        githubId: null,
      },
    } as T;
  }

  if (method === "POST" && normalizedPath === "/auth/logout") return undefined as T;

  if (method === "GET" && normalizedPath === "/github/app") {
    return {
      id: 987654,
      slug: "revorbit-demo",
      name: "Revorbit Demo",
      htmlUrl: "https://github.com/apps/revorbit-demo",
      installUrl: null,
    } as T;
  }

  if (method === "GET" && normalizedPath === "/github/installations") {
    return [
      {
        id: "demo-installation-acme",
        githubId: 100,
        accountLogin: "acme",
        accountType: "Organization",
        repositories: availableRepositories.map((repository) => ({
          ...repository,
          connected: workspace.repositories.some((item) => item.fullName === repository.fullName),
        })),
      },
    ] as T;
  }

  if (method === "GET" && normalizedPath === "/repositories") {
    return workspace.repositories as T;
  }

  const repositoryMatch = normalizedPath.match(/^\/repositories\/([^/]+)$/);
  if (repositoryMatch && method === "GET") {
    const repository = workspace.repositories.find((item) => item.id === repositoryMatch[1]);
    return (repository ? {
      ...repository,
      settings: {
        security: true,
        performance: false,
        bestPractices: true,
        ...repository.settings,
      },
    } : DEMO_UNHANDLED) as T | typeof DEMO_UNHANDLED;
  }

  const repositorySettingsMatch = normalizedPath.match(/^\/repositories\/([^/]+)\/settings$/);
  if (repositorySettingsMatch && method === "PUT") {
    const repositories = workspace.repositories.map((repository) =>
      repository.id === repositorySettingsMatch[1]
        ? { ...repository, settings: { ...repository.settings, ...body } }
        : repository,
    );
    const updated = repositories.find((repository) => repository.id === repositorySettingsMatch[1]);
    if (!updated) return DEMO_UNHANDLED;
    saveDemoWorkspace({ repositories });
    return updated as T;
  }

  if (repositoryMatch && method === "DELETE") {
    const repositories = workspace.repositories.filter((repository) => repository.id !== repositoryMatch[1]);
    if (repositories.length === workspace.repositories.length) return DEMO_UNHANDLED;
    saveDemoWorkspace({ repositories });
    return undefined as T;
  }

  if (method === "POST" && normalizedPath === "/repositories/connect") {
    const available = availableRepositories.find((repository) => repository.githubId === body.githubId);
    if (!available) return DEMO_UNHANDLED;
    const existing = workspace.repositories.find((repository) => repository.fullName === available.fullName);
    if (existing) return existing as T;
    const repository: DemoRepository = {
      id: `demo-${available.owner}-${available.name}`,
      fullName: available.fullName,
      owner: available.owner,
      name: available.name,
      defaultBranch: available.defaultBranch,
      settings: { enabled: true, model: "Claude 3.7 Sonnet", maxFiles: 30 },
    };
    saveDemoWorkspace({ repositories: [...workspace.repositories, repository] });
    return repository as T;
  }

  if (method === "GET" && normalizedPath === "/reviews") return demoReviews as T;

  const reviewMatch = normalizedPath.match(/^\/reviews\/([^/]+)$/);
  if (reviewMatch && method === "GET") {
    if (reviewMatch[1] === demoReviewDetail.id) return demoReviewDetail as T;
    const review = demoReviews.find((item) => item.id === reviewMatch[1]);
    if (!review) return DEMO_UNHANDLED;
    return {
      ...demoReviewDetail,
      ...review,
      summary: "This sample review highlights actionable changes and suggested fixes for the pull request.",
      comments: [],
    } as T;
  }

  return DEMO_UNHANDLED;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ORIGIN}${API_PREFIX}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch {
    const mock = demoResponse<T>(path, init);
    if (mock !== DEMO_UNHANDLED) {
      demoModeActive = true;
      return mock;
    }
    throw new Error("Request failed");
  }

  if (response.status === 204) {
    if (path === "/auth/logout") demoModeActive = false;
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !body?.success) {
    if (response.status === 401) {
      const mock = demoResponse<T>(path, init);
      if (mock !== DEMO_UNHANDLED) {
        demoModeActive = true;
        return mock;
      }
    }

    if (response.status === 401 && !init.method && typeof window !== "undefined") {
      window.location.assign("/login");
    }

    const error: ApiError = {
      status: response.status,
      code: body?.error?.code ?? "UNKNOWN_ERROR",
      message: body?.error?.message ?? "Request failed",
    };
    throw error;
  }

  if (["/auth/me", "/auth/login", "/auth/signup"].includes(path)) {
    demoModeActive = false;
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
