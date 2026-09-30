# SEO Automation – Frontend

React + TypeScript + Vite + Tailwind CSS v4 dashboard for the FastAPI backend in `../backend`.

## Run it

```bash
# 1. Backend (from ../backend, in its virtualenv)
uvicorn app.main:app --port 8000

# 2. Frontend
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The backend has no CORS middleware, so the browser uses same-origin `/api/*`
URLs. In development, Vite proxies those requests to `http://localhost:8000/api/*`.
Change the target with `VITE_BACKEND_URL` (see `.env.example`).

`npm run build` outputs static files to `dist/`. `npm run preview` serves that build
with the same proxy. For a real deployment, put the app and API behind one
reverse proxy that forwards `/api/` to FastAPI, as the root Docker setup does.

## What's in the app

The sidebar's top is a **business switcher**. Each backend website is a business,
named after the `business_name` in its AI profile, or its domain if there's no profile.
Every page is scoped to the selected business under `/c/:websiteId/…`.

### Automatic setup (agents)

When a business is added, the frontend calls the backend agents in order, with
no user clicks: `crawl` (10 pages) → `chunk` → `embed` → `profile` →
`topics/research` (20 topics) → `keywords/research` (DataForSEO) → `topics/score`.
Users only see a progress card. If the tab is closed partway, the remaining agents
resume the next time that business is opened. If an agent fails, setup pauses and
shows **Retry setup**.

**More topics** on Topic Research runs `topics/research` → `keywords/research` →
`topics/score`.

| Page | Backend endpoints |
| --- | --- |
| Business switcher | `GET/POST /api/websites`, `GET /profile` for each business (names) |
| Articles (`/c/:id/articles`) | `GET /api/websites/{id}/articles` |
| Article editor (`/c/:id/articles/:articleId`) | `GET/PUT /api/articles/{id}` |
| Topic Research (`/c/:id/topics`) | `GET /topics`, `POST /topics/{topic_id}/write` |
| Settings → Details (`/c/:id/settings/details`) | website info, `GET /profile` (name, industry, locations, summary) |
| Settings → Brand | `GET /profile` (brand voice, services, audience, USPs, goals, themes, SEO opportunities) |
| Settings → Assets, Integrations, Schedule | UI placeholders ("Yet to come"): no backend yet |

### Notes on the backend's behavior

- The backend only stores `website.status`. The UI works out which agents have
  finished from the profile, topics and scores it gets back, and keeps each agent's
  last result in `localStorage`.
- The agents run as a sequence of requests from the browser, because the backend
  has no single "run everything" endpoint.
- The keyword agent loads every topic for the business, so each run fetches metrics
  for the older topics again. That means extra DataForSEO credits and duplicate
  metric rows.

## Structure

```
src/
  lib/          api client, types, React Query hooks, pipeline state, SEO checks
  components/   app shell, UI primitives, website tabs
  pages/        Home redirect, company/ (Articles, Topic Research, Settings), Article editor
```
