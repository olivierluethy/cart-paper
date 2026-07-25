# CART Paper

A social reading and writing platform. Write multi-page books in a rich editor, publish them or
share a private draft, and — the part that matters — **select a passage on a page and start a
threaded discussion anchored to exactly that line**. Highlight in seven colours, keep private notes
with attachments, resume exactly where you stopped, import a PDF or Word file and annotate it the
same way.

Dark mode only. The aesthetic is a private library at night.

---

## Contents

1. [Test accounts](#test-accounts)
2. [Quick start](#quick-start)
3. [npm scripts](#npm-scripts)
4. [Environment variables](#environment-variables)
5. [Routes](#routes)
6. [Keyboard shortcuts](#keyboard-shortcuts)
7. [Feature guide](#feature-guide)
8. [Private vs public](#private-vs-public)
9. [Where things live](#where-things-live)
10. [Dependencies](#dependencies)
11. [Activating social sign-in](#activating-social-sign-in)
12. [Troubleshooting](#troubleshooting)

---

## Test accounts

`npm run seed` creates three demo readers. **All three use the password `readwrite123`.**

| Email | Handle | Who they are | What they show off |
|---|---|---|---|
| `mira@cartpaper.example` | `@mira` | Wrote *The Lamplighter's Almanac* and *A Field Guide to Forgetting* | **Start here.** Two published books, highlights, a note with attachments, threads, reading history and statistics |
| `tomas@cartpaper.example` | `@tomas` | Wrote *Marginalia* | Highlights across three books, the note that carries a quote + link attachment |
| `odile@cartpaper.example` | `@odile` | Wrote *Salt Lines* | Replies inside anchored threads, a whole-book comment |

> The domain is `cartpaper.example` on purpose — `.example` is the IETF-reserved documentation TLD,
> so the addresses are unmistakably fictional but still pass email validation. (`.test`, `.invalid`
> and `.local` are rejected by the validator.)

Anything published is readable **without signing in at all**. You only need an account to write,
highlight, note, comment, rate or favourite — and the register modal opens inline and resumes
whatever you were doing.

---

## Quick start

```bash
npm run setup && npm run dev
npm run seed          # so the library is not empty
```

`setup` copies `.env.example` → `.env` and builds the images; `dev` starts Postgres, the API and
the web app. Migrations run automatically when the API container boots.

| Service | URL |
|---|---|
| Web app | http://localhost:5173 |
| API | http://localhost:8000 |
| OpenAPI docs | http://localhost:8000/docs |
| Postgres | localhost:5432 (`cart` / `cart`) |

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
| `npm run seed -- --reset` | Wipe the demo data and rebuild it |
| `npm run build` | Production image build (no dev override) |
| `npm run shell:api` | Bash shell inside the API container |
| `npm run shell:db` | `psql` inside the database container |
| `npm run smoke` | Smoke checks: containers up, migrations at head, `/health`, one auth round-trip |

---

## Environment variables

All variables live in `.env` (created from `.env.example`).

### Database

| Variable | Default | Meaning |
|---|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `cart` / `cart` / `cartpaper` | Database credentials |
| `POSTGRES_PORT` | `5432` | Host port for Postgres |
| `DATABASE_URL` | `postgresql+asyncpg://cart:cart@db:5432/cartpaper` | Async SQLAlchemy DSN used by the API |

### API

| Variable | Default | Meaning |
|---|---|---|
| `API_PORT` | `8000` | Host port for the API |
| `SECRET_KEY` | `dev-only-secret-change-me` | Signs JWTs **and** the short-lived OAuth state cookie — change for anything real |
| `ACCESS_TOKEN_MINUTES` | `15` | Access token lifetime |
| `REFRESH_TOKEN_DAYS` | `30` | Refresh token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed origins (credentials are sent) |
| `UPLOAD_DIR` | `/data/uploads` | Container path for uploaded assets (a named volume) |
| `PUBLIC_API_URL` / `PUBLIC_WEB_URL` | localhost | Used to build absolute media, invite and OAuth redirect links |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` | `false` / `lax` | Auth cookie flags; set `secure=true` behind HTTPS |

### Social sign-in (all empty by default)

| Variable | Meaning |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client. Empty ⇒ the button renders disabled and the endpoint answers `501` |
| `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` | Facebook app credentials, same behaviour |
| `OAUTH_REDIRECT_BASE_URL` | Base the provider redirects back to; defaults to `PUBLIC_API_URL` |

See [Activating social sign-in](#activating-social-sign-in).

### Web

| Variable | Default | Meaning |
|---|---|---|
| `WEB_PORT` | `5173` | Host port for the web app |
| `VITE_API_URL` | `http://localhost:8000` | API base URL baked into the frontend |

---

## Routes

| Route | What it is |
|---|---|
| `/` | The public library — search, sort, tag chips, continue reading, finished, favourites |
| `/books/:slug` | Book detail: cover, rating, whole-book comments and every anchored discussion |
| `/read/:slug` | The reader. Select a passage to highlight, note or discuss it |
| `/pdf/:slug` | Fallback reader for imports, over the original file — annotations work here too |
| `/books/:slug/print` | Print view, with an option to append your own highlights and notes |
| `/write` · `/write/:id` | The three-pane writing workspace |
| `/me` · `/u/:handle` | Profile — books, trail, reading, favourites, drafts, statistics |
| `/notifications` | Everything that happened to your books and comments |

---

## Keyboard shortcuts

**Reader** — `←` `→` (also `space`, `PageUp`/`PageDown`) turn pages · `Home`/`End` jump to the ends ·
`Esc` leaves the reader. Pressing "next" on the final page **finishes the book** and opens the
end-of-book screen.

**Editor** — `⌘/Ctrl + S` forces a save · `/` at the start of a line opens the block menu ·
select text for the formatting bubble menu.

**Comments** — `r` replies to the focused comment · `⌘/Ctrl + Enter` posts · `Esc` cancels.

**Note composer** — `⌘/Ctrl + Enter` saves · `Esc` dismisses **without** removing the highlight.

**Page rail** — focus a page and use `Alt + ↑/↓` to reorder without dragging.

**Modals** — focus is trapped, `Esc` closes, focus returns where it came from.

---

## Feature guide

### Reading

Published books are readable signed out. Progress is saved continuously but coalesced (one write
every 2s at most, plus one on unmount and when the tab is hidden), and it is **monotonic** — paging
backwards to re-read a chapter never lowers your saved place. Reopening offers *"continue where you
left off"* rather than jumping you there.

Reaching the last page opens the **end-of-book screen** with your time spent, highlight and note
counts, and Rate / Comment / Read again / Back to library. Finished books then read as finished
everywhere: `Finished on <date> · Read again` on the detail page, their own row in the library, and
a separate list in your profile. *Read again* returns you to page one and keeps everything — the
book stays finished, and every highlight and note survives.

### Annotating

Select any passage for the toolbar: seven highlight colours, then **Note**, **Discuss**, **Copy**
and **Quote**, all with visible labels.

Applying a colour **opens a note composer straight away**, so attaching a private thought is
something you do rather than something you have to discover. Dismissing it keeps the highlight.

Every highlight carries a permanent margin marker — a pencil dot where a note exists, a dashed `+`
where one could. Never hover-only.

### Discussing

Commenting from a selection anchors the thread to that exact line: the passage gets a dotted teal
underline and a margin marker with the message count, and every later reader finds the conversation
there. **Any comment can be replied to at any depth** — each one has its own always-visible
Reply / Edit / Delete row. Nesting indents to three levels, then flattens with a
*"replying to @X"* back-reference. Deleting a comment with replies leaves a `[deleted]` tombstone so
the thread still reads.

### Writing

`/write` is a three-pane workspace: page rail (drag or `Alt + ↑/↓` to reorder), TipTap editor,
settings rail. Autosave is debounced with a visible Saving/Saved state. Images carry their own
placement — alignment, width, text wrap, caption, alt text. Covers get a designer with gradients,
solid colours or an uploaded image and four typographic presets.

Drafts are private. **Invite to preview** issues a link granting read *and comment* access to that
draft — a reader who cannot answer back is just a proofreader.

### Importing

PDF and DOCX. The original file is kept forever, and the conversion reports how many pages came
through cleanly. Below 60% the book offers the **pdf.js fallback reader** over the original — and
that is not a downgrade: the same colours, the same notes, the same anchored discussions, anchored
to page-relative rectangles that survive zoom. Imports always land as **private drafts**.

### Accounts

Registration is one step and signs you in immediately. The password field has a live strength meter
(5 segments, verdict, crack time, one specific suggestion) and a **generator** offering random
strings or memorable passphrases, using `crypto.getRandomValues` only. Accepting one copies it to
the clipboard, tells you to save it, and clears the clipboard after 90 seconds — but only if it
still holds our value.

The meter is advice: the server enforces a 10-character minimum and rejects known-cracked
passwords, and never blocks on a low score.

Profile pictures are optional — initials are a real avatar. You can upload a file or paste a URL;
either way it is cropped in a circular editor and **re-hosted** as a 512×512 WebP, so it can never
break later or leak your readers' IPs to a third-party host.

### Statistics

Reading time is tracked passively — a 15-second heartbeat that only ticks while the tab is focused
and the reader is open. Never shown mid-read. One toggle in Settings hides every statistic from
your profile, and the API enforces that with a 403 rather than trusting the client.

---

## Private vs public

The distinction is stated with an icon, a colour, a position **and** a label, everywhere:

| | Private note | Public discussion |
|---|---|---|
| Icon | pencil / lock | speech bubble |
| Accent | amber | teal |
| Margin | left | right |
| Label | "Private note · only you" | "Public discussion · everyone can see this" |

Highlights and notes are **only ever visible to the reader who made them** — the API filters by
user, and an export contains only your own marks.

---

## Where things live

```
apps/web/src
  app/          router, providers, layout shell, error boundary
  features/     library · reader · editor · comments · notes · profile · auth · notifications · import · print
  components/   shared UI primitives (modal, toast, buttons, book cover, password field, …)
  lib/          api client, hooks, anchor resolution, utils
  styles/       theme tokens, global stylesheet, print stylesheet

apps/api/app
  core/         settings, security, dependencies
  models/       SQLAlchemy 2.0 tables
  schemas/      Pydantic v2 request/response models
  routers/      HTTP surface
  services/     storage, import (pdf/docx), export, anchors, avatars, oauth, stats, notifications
  data/         bundled common-password list
  db/           engine, session, seed
alembic/        migrations
docs/           ARCHITECTURE.md
```

The two files worth reading first are `apps/web/src/lib/anchor.ts` — the three-stage resolution that
lets an annotation survive an edit to the page under it — and
`apps/web/src/features/reader/extensions/Annotations.ts`, which paints annotations as ProseMirror
decorations so the book document itself is never touched.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data model, the anchor format, the
progress/completion model, the annotation privacy model, and what was deliberately deferred.

---

## Dependencies

Beyond the original stack (React 18 · Vite · TypeScript · Tailwind · Framer Motion · TipTap ·
FastAPI · SQLAlchemy 2.0 · Alembic · PostgreSQL 16):

**Web** — `@zxcvbn-ts/core` + `language-common` + `language-en` (password strength, loaded lazily),
`pdfjs-dist` (fallback reader), `lucide-react`, `@tanstack/react-query`.

**API** — `authlib` (OAuth clients), `itsdangerous` (signs the OAuth state cookie),
`weasyprint` (PDF export), `pypdf` + `pdfplumber` (PDF import), `mammoth` (DOCX import),
`pillow` (image and avatar processing), `argon2-cffi`, `pyjwt`.

**Bundled data** — `apps/web/src/features/auth/wordlist.ts` (4096-word passphrase list, exactly 12
bits per word) and `apps/api/app/data/common_passwords.txt` (40k already-cracked passwords).

---

## Activating social sign-in

Both providers are fully built and **off by default**. Filling in credentials is the only step —
no code changes, no migrations.

**Google**

1. Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → Web application.
2. Authorised redirect URI: `http://localhost:8000/auth/oauth/google/callback`.
3. Put the client ID and secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`.

**Facebook**

1. developers.facebook.com → *My Apps* → Create App → add **Facebook Login**.
2. Valid OAuth Redirect URI: `http://localhost:8000/auth/oauth/facebook/callback`.
3. Put the app ID and secret into `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`.

Then `npm run stop && npm run dev`. The buttons stop being disabled on their own — the modals ask
`GET /auth/providers` when they open.

---

## Troubleshooting

**The library is empty.** Run `npm run seed`.

**Two seeded images 404.** They were written outside the container's uploads volume. Re-run
`npm run seed -- --reset` inside Docker.

**"Not configured yet — coming soon" on the social buttons.** Expected: no OAuth credentials are
set. See above.

**A social button does nothing.** It should not exist — an unconfigured provider is rendered
disabled. If a configured one fails, check that the redirect URI registered with the provider
matches `OAUTH_REDIRECT_BASE_URL` exactly.

**Registration rejects your password.** Minimum 10 characters, and passwords on the bundled
cracked-password list are refused. The strength meter never blocks — only those two rules do.

---

## Notes

- There is no test suite, by design. `npm run smoke` covers boot, migrations, `/health` and one
  authenticated round-trip; see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) → Testing.
- Nothing is ever pushed to a remote by the tooling here; the repository is local only.
