# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stella's Assistant is an AI-powered web management platform for a consultant (Stella Jimenez). It provides a full-stack admin dashboard for managing her website, CRM, blog content, deployments, and AI interactions — all from one unified interface.

## Setup

```bash
# Install frontend dependencies
cd frontend && npm install

# Install backend dependencies
cd backend && npm install
```

## Development Commands

```bash
# Frontend — Next.js dev server on port 3000
cd frontend && npm run dev

# Backend — Fastify API server on port 4000
cd backend && npm run dev

# Build frontend for production
cd frontend && npm run build

# Lint frontend
cd frontend && npm run lint
```

## Architecture

### Frontend (`/frontend`)

- **Framework**: Next.js 15 (App Router), TypeScript strict mode
- **Styling**: Tailwind CSS with custom design tokens (`globals.css`), Apple+Swiss minimal aesthetic, Stella-gold accent
- **State**: Zustand for auth, UI state (sidebar, AI panel), and builder state
- **Data fetching**: React Query v5 with `request()` helper in `src/lib/api.ts`
- **Animations**: Framer Motion — standard pattern: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`
- **Icons**: lucide-react
- **Toasts**: react-hot-toast

Key layout files:
- `src/components/layout/AppShell.tsx` — wraps every authenticated page, renders Sidebar + AI Panel
- `src/components/layout/Sidebar.tsx` — collapsible nav with admin-gated items
- `src/components/layout/Header.tsx` — page title bar with theme toggle
- `src/components/ai/AiPanel.tsx` — slide-out AI chat panel
- `src/lib/api.ts` — all API calls and TypeScript interfaces
- `src/lib/store.ts` — Zustand stores (auth, UI, builder)
- `src/lib/utils.ts` — cn(), formatDate, formatRelative, getStatusBadgeClass, slugify, etc.

### Backend (`/backend`)

- **Framework**: Fastify 5 with TypeScript
- **Database**: SQLite via Drizzle ORM (`src/db/schema.ts`)
- **Auth**: JWT bearer tokens (bcryptjs for passwords)
- **AI**: Multi-provider LLM integration (Gemini, Ollama, OpenAI, Claude)

Routes:
- `/api/auth/*` — login, register, me, setup-status
- `/api/pages/*` — CRUD + export
- `/api/crm/*` — contacts, projects, milestones, activities, stats, ai-insights
- `/api/content/*` — blog posts, case studies, services
- `/api/admin/*` — users (CRUD), activity log, db-stats
- `/api/deploy/*` — SSH targets, test, deploy, exec, deployments
- `/api/git/*` — configs, status, commits, commit, init, github
- `/api/llm/*` — providers, connections, active, oauth
- `/api/do/*` — DigitalOcean droplets integration
- `/api/settings` — site settings key-value store
- `/api/ai/*` — chat sessions, generate page, generate copy

## Feature List

- **Pages / Builder** — CRUD web pages with CodeMirror HTML/CSS editor, AI generation, preview iframe
- **Content** — Blog posts editor, case study editor (with structured sections), services management
- **CRM Contacts** — Kanban + table views, slide-out detail drawer, activity timeline
- **CRM Projects** — Kanban + table views, slide-out drawer, milestones with checkboxes
- **Deploy** — SSH deploy targets, test connections, one-click deploy, remote shell exec
- **Git** — Repository config, commit & push, history, GitHub repo creation
- **DigitalOcean** — Droplet listing, API token setup
- **Admin** — User management (invite, roles, activate, delete), activity log, database stats
- **AI Assistant** — Persistent chat sessions, page generation, copy generation
- **Settings** — LLM provider connections, site settings, DO API token

## Code Quality Conventions

- JSDoc comments on all exported functions and components (1–2 lines)
- TypeScript strict — no `any` types
- Use `cn()` from `src/lib/utils.ts` for conditional classNames
- All API calls use the `request()` helper from `api.ts`
- Toast notifications on all mutations (success + error)
- Consistent form styling using `.field` CSS class with `<label>` tags
- Motion animations: `initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}`

## Deployment

Hosted on Raspberry Pi at `comet@172.16.106.240` using Docker Compose.

```bash
ssh -i ~/.ssh/stella_pi_ed25519 comet@172.16.106.240
cd ~/stella-assistant && git pull origin main && docker compose build --no-cache && docker compose up -d
```
