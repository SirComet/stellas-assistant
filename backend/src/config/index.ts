import { config as dotenvConfig } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenvConfig({ path: path.resolve(__dirname, "../../.env") });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optional("NODE_ENV", "development"),
  port: parseInt(optional("PORT", "4000"), 10),
  host: optional("HOST", "0.0.0.0"),

  jwt: {
    secret: optional("JWT_SECRET", "stella-assistant-super-secret-jwt-key-change-in-prod"),
    expiresIn: optional("JWT_EXPIRES_IN", "7d"),
  },

  database: {
    url: optional("DATABASE_URL", path.resolve(__dirname, "../../data/stella.db")),
  },

  gemini: {
    apiKey: optional("GEMINI_API_KEY", ""),
    model: optional("GEMINI_MODEL", "gemini-2.0-flash-exp"),
  },

  cors: {
    origin: optional("CORS_ORIGIN", "http://localhost:3000"),
  },

  builds: {
    outputDir: optional("BUILDS_DIR", path.resolve(__dirname, "../../builds")),
  },

  uploads: {
    dir: optional("UPLOADS_DIR", path.resolve(__dirname, "../../uploads")),
    maxSizeMb: parseInt(optional("UPLOADS_MAX_MB", "50"), 10),
  },

  git: {
    defaultAuthorName: optional("GIT_AUTHOR_NAME", "Stella's Assistant"),
    defaultAuthorEmail: optional("GIT_AUTHOR_EMAIL", "assistant@stellajimenez.com"),
  },
} as const;

export type Config = typeof config;
