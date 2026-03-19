const API_BASE = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("stella_token");
}

export function setToken(token: string): void {
  localStorage.setItem("stella_token", token);
}

export function clearToken(): void {
  localStorage.removeItem("stella_token");
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const { params, ...fetchOptions } = options;

  const url = new URL(`${API_BASE}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url.toString(), {
    ...fetchOptions,
    headers,
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  const data = await res.json() as T;
  return data;
}

// Auth
export const auth = {
  login: (email: string, password: string) =>
    request<{ success: boolean; data: { token: string; user: User } }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  register: (data: { email: string; name: string; password: string }) =>
    request<{ success: boolean; data: { token: string; user: User } }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  me: () => request<{ success: boolean; data: User }>("/api/auth/me"),

  setupStatus: () =>
    request<{ success: boolean; data: { needsSetup: boolean } }>("/api/auth/setup-status"),
};

// AI
export const ai = {
  chat: (data: { sessionId?: string; message: string; context?: string }) =>
    request<{ success: boolean; data: { sessionId: string; response: string } }>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generatePage: (prompt: string) =>
    request<{ success: boolean; data: GeneratedPage }>("/api/ai/generate/page", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    }),

  generateCopy: (type: string, context?: string) =>
    request<{ success: boolean; data: { copy: string } }>("/api/ai/generate/copy", {
      method: "POST",
      body: JSON.stringify({ type, context }),
    }),

  sessions: () =>
    request<{ success: boolean; data: AiSessionSummary[] }>("/api/ai/sessions"),

  session: (id: string) =>
    request<{ success: boolean; data: AiSession }>(`/api/ai/sessions/${id}`),

  deleteSession: (id: string) =>
    request<{ success: boolean }>(`/api/ai/sessions/${id}`, { method: "DELETE" }),
};

// Pages
export const pages = {
  list: (params?: { search?: string; limit?: string; offset?: string }) =>
    request<PaginatedResponse<Page>>("/api/pages", { params }),

  get: (id: string) => request<{ success: boolean; data: Page }>(`/api/pages/${id}`),

  create: (data: Partial<Page>) =>
    request<{ success: boolean; data: Page }>("/api/pages", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Page>) =>
    request<{ success: boolean; data: Page }>(`/api/pages/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/api/pages/${id}`, { method: "DELETE" }),

  exportUrl: (id: string) => `${API_BASE}/api/pages/${id}/export`,
};

// CRM
export const crm = {
  contacts: {
    list: (params?: { search?: string }) =>
      request<{ success: boolean; data: Contact[]; total: number }>("/api/crm/contacts", { params }),
    get: (id: string) => request<{ success: boolean; data: Contact }>(`/api/crm/contacts/${id}`),
    create: (data: Partial<Contact>) =>
      request<{ success: boolean; data: Contact }>("/api/crm/contacts", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Contact>) =>
      request<{ success: boolean; data: Contact }>(`/api/crm/contacts/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/crm/contacts/${id}`, { method: "DELETE" }),
  },

  projects: {
    list: () => request<{ success: boolean; data: Project[] }>("/api/crm/projects"),
    create: (data: Partial<Project>) =>
      request<{ success: boolean; data: Project }>("/api/crm/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Project>) =>
      request<{ success: boolean; data: Project }>(`/api/crm/projects/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/crm/projects/${id}`, { method: "DELETE" }),
  },

  stats: () => request<{ success: boolean; data: CrmStats }>("/api/crm/stats"),
  insights: () => request<{ success: boolean; data: { analysis: string } }>("/api/crm/ai-insights"),
};

// Deploy
export const deploy = {
  targets: {
    list: () => request<{ success: boolean; data: DeployTarget[] }>("/api/deploy/targets"),
    get: (id: string) => request<{ success: boolean; data: DeployTarget }>(`/api/deploy/targets/${id}`),
    create: (data: Partial<DeployTarget>) =>
      request<{ success: boolean; data: DeployTarget }>("/api/deploy/targets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<DeployTarget>) =>
      request<{ success: boolean }>(`/api/deploy/targets/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request<{ success: boolean }>(`/api/deploy/targets/${id}`, { method: "DELETE" }),
    test: (id: string) =>
      request<{ success: boolean; data: { success: boolean; message: string; latency?: number } }>(
        `/api/deploy/targets/${id}/test`,
        { method: "POST" }
      ),
    deploy: (id: string, options?: { pageId?: string; postCommand?: string }) =>
      request<{ success: boolean; data: { deploymentId: string } }>(
        `/api/deploy/targets/${id}/deploy`,
        { method: "POST", body: JSON.stringify(options ?? {}) }
      ),
    exec: (id: string, command: string) =>
      request<{ success: boolean; data: { stdout: string; stderr: string; code: number } }>(
        `/api/deploy/targets/${id}/exec`,
        { method: "POST", body: JSON.stringify({ command }) }
      ),
  },

  deployments: {
    list: () => request<{ success: boolean; data: Deployment[] }>("/api/deploy/deployments"),
    get: (id: string) => request<{ success: boolean; data: Deployment }>(`/api/deploy/deployments/${id}`),
  },
};

// Git
export const git = {
  configs: {
    list: () => request<{ success: boolean; data: GitConfig[] }>("/api/git/configs"),
    create: (data: Partial<GitConfig>) =>
      request<{ success: boolean; data: { id: string } }>("/api/git/configs", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    status: (id: string) =>
      request<{ success: boolean; data: GitStatus }>(`/api/git/configs/${id}/status`),
    commits: (id: string) =>
      request<{ success: boolean; data: GitCommit[] }>(`/api/git/configs/${id}/commits`),
    commit: (id: string, data: { message: string; push?: boolean }) =>
      request<{ success: boolean; data: { commit: string } }>(`/api/git/configs/${id}/commit`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    init: (id: string) =>
      request<{ success: boolean }>(`/api/git/configs/${id}/init`, { method: "POST" }),
  },
  github: {
    createRepo: (data: { token: string; name: string; description?: string; isPrivate?: boolean }) =>
      request<{ success: boolean; data: { url: string; cloneUrl: string } }>("/api/git/github/create-repo", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },
};

// Settings
export const settings = {
  get: () => request<{ success: boolean; data: Record<string, string> }>("/api/settings"),
  update: (data: Record<string, string>) =>
    request<{ success: boolean }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// LLM Providers
export const llm = {
  providers: () =>
    request<{ success: boolean; data: LLMProviderDef[] }>("/api/llm/providers"),

  connections: () =>
    request<{ success: boolean; data: LLMConnection[] }>("/api/llm/connections"),

  connect: (data: { provider: string; apiKey?: string; ollamaUrl?: string; selectedModel: string }) =>
    request<{ success: boolean; data: LLMConnection }>("/api/llm/connections", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  disconnect: (id: string) =>
    request<{ success: boolean }>(`/api/llm/connections/${id}`, { method: "DELETE" }),

  getActive: () =>
    request<{ success: boolean; data: LLMActiveConfig }>("/api/llm/active"),

  setActive: (connectionId: string, model: string) =>
    request<{ success: boolean }>("/api/llm/active", {
      method: "PUT",
      body: JSON.stringify({ connectionId, model }),
    }),

  oauthGoogleUrl: () => `${API_BASE}/api/llm/oauth/google/start`,
};

// Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: unknown[];
  metadata: Record<string, unknown>;
  status: "draft" | "published" | "archived";
  template?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  role?: string;
  status: "lead" | "prospect" | "client" | "inactive";
  tags: string[];
  notes: string;
  source?: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "planning" | "active" | "review" | "completed" | "paused";
  clientId?: string;
  budget?: number;
  startDate?: string;
  dueDate?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DeployTarget {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "key";
  remotePath: string;
  webUrl?: string;
  lastDeployedAt?: string;
  hasPassword?: boolean;
  hasKey?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  targetId: string;
  status: "pending" | "running" | "success" | "failed";
  log: string;
  commitHash?: string;
  startedAt: string;
  completedAt?: string;
}

export interface GitConfig {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  localPath: string;
  autoPush: boolean;
  createdAt: string;
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface AiSessionSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiSession extends AiSessionSummary {
  messages: Array<{ role: string; parts: Array<{ text: string }> }>;
}

export interface GeneratedPage {
  html: string;
  css: string;
  components: unknown[];
  suggestions: string[];
}

export interface CrmStats {
  contacts: { total: number; byStatus: Record<string, number> };
  projects: { total: number; byStatus: Record<string, number>; totalBudget: number; activeCount: number };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface LLMProviderDef {
  id: string;
  name: string;
  description: string;
  authType: "oauth" | "apikey" | "url";
  defaultModel: string;
  freeTier: boolean;
  freeNote: string;
  models: Array<{ id: string; name: string; note?: string }>;
}

export interface LLMConnection {
  id: string;
  provider: string;
  displayName: string;
  email?: string;
  selectedModel: string;
  isOAuth: boolean;
  hasCredentials: boolean;
  createdAt: string;
}

export interface LLMActiveConfig {
  connectionId: string | null;
  provider: string;
  model: string;
  displayName: string;
  email?: string;
}
