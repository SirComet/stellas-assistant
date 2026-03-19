import { sql } from "drizzle-orm";
import {
  text,
  integer,
  sqliteTable,
  real,
} from "drizzle-orm/sqlite-core";

// Users
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "editor", "viewer"] }).notNull().default("editor"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Pages
export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull().default("[]"),
  metadata: text("metadata").notNull().default("{}"),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  template: text("template").default("default"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Contacts (CRM)
export const contacts = sqliteTable("contacts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  company: text("company"),
  role: text("role"),
  status: text("status", { enum: ["lead", "prospect", "client", "inactive"] }).notNull().default("lead"),
  tags: text("tags").notNull().default("[]"),
  notes: text("notes").notNull().default(""),
  source: text("source"),
  avatarUrl: text("avatar_url"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Projects
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  status: text("status", { enum: ["planning", "active", "review", "completed", "paused"] }).notNull().default("planning"),
  clientId: text("client_id").references(() => contacts.id),
  budget: real("budget"),
  startDate: text("start_date"),
  dueDate: text("due_date"),
  tags: text("tags").notNull().default("[]"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Deploy Targets
export const deployTargets = sqliteTable("deploy_targets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(22),
  username: text("username").notNull(),
  authType: text("auth_type", { enum: ["password", "key"] }).notNull().default("key"),
  privateKey: text("private_key"),
  password: text("password"),
  remotePath: text("remote_path").notNull(),
  webUrl: text("web_url"),
  lastDeployedAt: text("last_deployed_at"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Git Configurations
export const gitConfigs = sqliteTable("git_configs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  repoUrl: text("repo_url").notNull(),
  branch: text("branch").notNull().default("main"),
  token: text("token"),
  localPath: text("local_path").notNull(),
  autoPush: integer("auto_push", { mode: "boolean" }).notNull().default(false),
  webhookSecret: text("webhook_secret"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Deployments
export const deployments = sqliteTable("deployments", {
  id: text("id").primaryKey(),
  targetId: text("target_id").notNull().references(() => deployTargets.id),
  status: text("status", { enum: ["pending", "running", "success", "failed"] }).notNull().default("pending"),
  log: text("log").notNull().default(""),
  commitHash: text("commit_hash"),
  triggeredBy: text("triggered_by"),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});

// AI Sessions
export const aiSessions = sqliteTable("ai_sessions", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  messages: text("messages").notNull().default("[]"),
  context: text("context"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Media
export const media = sqliteTable("media", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  altText: text("alt_text"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Settings
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// LLM Connections
export const llmConnections = sqliteTable("llm_connections", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(), // gemini | openai | anthropic | grok | ollama
  displayName: text("display_name").notNull(),
  email: text("email"),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiry: text("token_expiry"),
  apiKey: text("api_key"),
  ollamaUrl: text("ollama_url"),
  selectedModel: text("selected_model").notNull().default(""),
  isOAuth: integer("is_oauth", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Webhooks
export const webhooks = sqliteTable("webhooks", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  secret: text("secret"),
  events: text("events").notNull().default("[]"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Content Posts (blog posts + case studies via type discriminator)
export const contentPosts = sqliteTable("content_posts", {
  id: text("id").primaryKey(),
  type: text("type", { enum: ["blog", "case_study"] }).notNull().default("blog"),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull().default(""),
  featuredImage: text("featured_image"),
  author: text("author").notNull().default("Stella Jimenez"),
  status: text("status", { enum: ["draft", "published", "archived"] }).notNull().default("draft"),
  publishedAt: text("published_at"),
  tags: text("tags").notNull().default("[]"),
  category: text("category"),
  // Case study specific (nullable for blog)
  client: text("client"),
  challenge: text("challenge"),
  solution: text("solution"),
  results: text("results"),
  testimonial: text("testimonial"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Services offered by Stella
export const siteServices = sqliteTable("site_services", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull().default(""),
  icon: text("icon"),
  features: text("features").notNull().default("[]"),
  price: text("price"),
  duration: text("duration"),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Project milestones
export const projectMilestones = sqliteTable("project_milestones", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  dueDate: text("due_date"),
  status: text("status", { enum: ["pending", "in_progress", "done"] }).notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

// Contact activity timeline
export const contactActivities = sqliteTable("contact_activities", {
  id: text("id").primaryKey(),
  contactId: text("contact_id").notNull().references(() => contacts.id),
  type: text("type", { enum: ["note", "email", "call", "meeting", "status_change"] }).notNull().default("note"),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  occurredAt: text("occurred_at").notNull().default(sql`(datetime('now'))`),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

// Platform-wide activity log
export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  userEmail: text("user_email").notNull().default(""),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  resourceName: text("resource_name").notNull().default(""),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});
