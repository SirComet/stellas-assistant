export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "editor";
  createdAt: string;
}

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  metadata: PageMetadata;
  status: "draft" | "published" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface PageMetadata {
  description?: string;
  keywords?: string[];
  ogImage?: string;
  customCss?: string;
  customJs?: string;
}

export interface Component {
  id: string;
  type: ComponentType;
  props: Record<string, unknown>;
  children?: Component[];
  order: number;
}

export type ComponentType =
  | "hero"
  | "text"
  | "image"
  | "gallery"
  | "cta"
  | "testimonial"
  | "pricing"
  | "contact"
  | "features"
  | "video"
  | "spacer"
  | "divider"
  | "columns"
  | "card"
  | "form";

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
  privateKey?: string;
  password?: string;
  remotePath: string;
  webUrl?: string;
  lastDeployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GitConfig {
  id: string;
  repoUrl: string;
  branch: string;
  token?: string;
  localPath: string;
  autoPush: boolean;
  webhookSecret?: string;
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

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
}

export interface AiSession {
  id: string;
  title: string;
  messages: AiMessage[];
  context?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  total: number;
  page: number;
  limit: number;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  secret?: string;
  events: string[];
  active: boolean;
  createdAt: string;
}

export type LLMProviderType = "gemini" | "openai" | "anthropic" | "grok" | "ollama";

export interface LLMConnection {
  id: string;
  provider: LLMProviderType;
  displayName: string;
  email?: string;
  selectedModel: string;
  isOAuth: boolean;
  createdAt: string;
}

export interface LLMProviderDef {
  id: LLMProviderType;
  name: string;
  description: string;
  authType: "oauth" | "apikey" | "url";
  defaultModel: string;
  models: Array<{ id: string; name: string; note?: string }>;
  oauthScopes?: string[];
  freeTier: boolean;
  freeNote?: string;
}

export interface LLMActiveConfig {
  connectionId: string | null;
  provider: LLMProviderType;
  model: string;
}

export interface LLMChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ContentPost {
  id: string;
  type: "blog" | "case_study";
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage?: string;
  author: string;
  status: "draft" | "published" | "archived";
  publishedAt?: string;
  tags: string[];
  category?: string;
  client?: string;
  challenge?: string;
  solution?: string;
  results?: string;
  testimonial?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SiteService {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon?: string;
  features: string[];
  price?: string;
  duration?: string;
  status: "active" | "archived";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  dueDate?: string;
  status: "pending" | "in_progress" | "done";
  sortOrder: number;
  createdAt: string;
}

export interface ContactActivity {
  id: string;
  contactId: string;
  type: "note" | "email" | "call" | "meeting" | "status_change";
  title: string;
  body: string;
  occurredAt: string;
  createdAt: string;
}

export interface ActivityLogEntry {
  id: string;
  userEmail: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface DODroplet {
  id: number;
  name: string;
  status: string;
  networks: { v4: Array<{ ip_address: string; type: string }> };
  region: { name: string; slug: string };
  size_slug: string;
}
