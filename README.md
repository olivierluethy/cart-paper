# CART Paper

A social reading and writing platform. Write multi-page books in a rich editor, publish them or
share a private draft, and — the part that matters — **select a passage on a page and start a
threaded discussion anchored to exactly that line**. Highlight in seven colours, keep private notes
with attachments, resume exactly where you stopped, import a PDF or Word file and annotate it the
same way.

Dark mode only. The aesthetic is a private library at night.

---

## Quick start

```bash
npm run setup && npm run dev
```

That is the whole thing. `setup` copies `.env.example` → `.env` and builds the images; `dev` starts
Postgres, the API and the web app. Migrations run automatically when the API container boots.

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |
| Postgres | localhost:5432 (`cart` / `cart`) |

Then, so the app is not empty:

```bash
npm run seed
```

That creates three demo users and four published books with real multi-page content, images,
highlights and a couple of anchored discussion threads. Every seeded account uses the password
`readwrite123`; sign in as `mira@cartpaper.example` to see a populated profile.

### Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose version`)
- Node 18+ — only to run the npm scripts; all real work happens inside containers
- Ports 5173, 8000 and 5432 free

---

## npm scripts

| Script | What it does |
|---|---|
| `npm run setup` | Create `.env` from the example, build all images |
| `npm run dev` | Start db + api + web in the foreground (hot reload on both) |
| `npm run dev:detached` | Same, in the background |
| `npm run stop` | Stop the stack |
| `npm run reset` | Stop, **destroy volumes** (database + uploads), rebuild |
| `npm run logs` | Follow logs from all services |
| `npm run migrate` | Apply migrations manually (`alembic upgrade head`) |
| `npm run makemigration -- "message"` | Autogenerate a new migration |
| `npm run seed` | Load demo users, books, highlights and discussions |
| `npm run build` | Production image build (no dev override) |
| `npm run shell:api` | Bash shell inside the API container |
| `npm run shell:db` | `psql` inside the database container |
| `npm run smoke` | Smoke checks: containers up, migrations at head, `/health`, one auth round-trip |

---

## Environment

All variables live in `.env` (created from `.env.example`).

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `cart` / `cart` / `cartpaper` | Database credentials |
| `POSTGRES_PORT` | `5432` | Host port for Postgres |
| `DATABASE_URL` | `postgresql+asyncpg://cart:cart@db:5432/cartpaper` | Async SQLAlchemy DSN used by the API |
| `API_PORT` | `8000` | Host port for the API |
| `SECRET_KEY` | `dev-only-secret-change-me` | JWT signing key — **change for anything real** |
| `ACCESS_TOKEN_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_DAYS` | `30` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins (credentials are sent) |
| `UPLOAD_DIR` | `/data/uploads` | Container path for uploaded assets (a named volume) |
| `PUBLIC_API_URL` / `PUBLIC_WEB_URL` | localhost | Used to build absolute media and invite links |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax` | Auth cookie flags; set `secure=true` behind HTTPS |
| `WEB_PORT` | `5173` | Host port for the web app |
| `VITE_API_URL` | `http://localhost:8000` | API base URL baked into the frontend |

---

## Routes

| Route | What it is |
|---|---|
| `/` | The public library — search, sort, tag chips, continue reading, favourites |
| `/books/:slug` | Book detail: cover, rating, whole-book comments and every anchored discussion |
| `/read/:slug` | The reader. Select a passage to highlight, note or discuss it |
| `/pdf/:slug` | Fallback reader for imports, over the original file — annotations work here too |
| `/books/:slug/print` | Print view, with an option to append your own highlights and notes |
| `/write` · `/write/:id` | The three-pane writing workspace |
| `/me` · `/u/:handle` | Profile — books, trail, currently reading, favourites, drafts, statistics |
| `/notifications` | Everything that happened to your books and comments |

Keyboard in the reader: `←` `→` (or `space`, `PageUp`/`PageDown`) to turn pages, `Home`/`End` to
jump, `Esc` to leave. In the editor, `⌘/Ctrl+S` forces a save and `/` opens the block menu.

## Where things live

```
apps/web/src
  app/          router, providers, layout shell
  features/     library · reader · editor · comments · notes · profile · auth · notifications · import
  components/   shared UI primitives (modal, toast, buttons, book cover, …)
  lib/          api client, hooks, anchor resolution, utils
  styles/       theme tokens + global stylesheet

apps/api/app
  core/         settings, security, dependencies
  models/       SQLAlchemy 2.0 tables
  schemas/      Pydantic v2 request/response models
  routers/      HTTP surface
  services/     storage, import (pdf/docx), export, anchors, stats, notifications
  db/           engine, session, seed
alembic/        migrations (baseline + increments)
docs/           ARCHITECTURE.md
```

The two files worth reading first are `apps/web/src/lib/anchor.ts` — the three-stage resolution
that lets an annotation survive an edit to the page under it — and
`apps/web/src/features/reader/extensions/Annotations.ts`, which paints those annotations as
ProseMirror decorations so the book document itself is never touched.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, the anchor format that makes
passage-anchored discussion work, and what was deliberately deferred.

---

## Notes

- Published books are readable without an account. Writing, commenting, rating, highlighting,
  favouriting and notes require one — the register modal opens inline and the action resumes after
  signup.
- Drafts are private to their author until published; "invite to preview" issues a share link that
  grants read + comment access to that draft only.
- Imported PDFs and DOCX files always land as **private drafts**. Nothing uploaded is ever
  auto-published. The original file is kept forever; if the conversion is poor, `/pdf/:slug` reads
  it directly and highlighting, notes and anchored discussions all still work there.
- Reading time is tracked passively — a 15-second heartbeat that only ticks while the tab is
  focused and the reader is open. It is never shown mid-read, and one toggle in Settings hides
  every statistic from your profile.
- There is no test suite, by design. `npm run smoke` covers boot, migrations, `/health` and one
  authenticated round-trip; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → Testing.
