# CART Paper — architecture

## Shape

Three containers, one command.

```
web (vite/react)  ──HTTP + httpOnly cookies──▶  api (fastapi)  ──asyncpg──▶  db (postgres 16)
                                                     │
                                                     └── /data/uploads (volume, served at /media)
```

- **web** — React 18 + Vite + TypeScript, Tailwind (dark only), Framer Motion, TipTap, pdf.js.
- **api** — FastAPI on Python 3.12, SQLAlchemy 2.0 async, Alembic, Pydantic v2, WeasyPrint.
- **db** — PostgreSQL 16. `jsonb` carries ProseMirror documents, anchors, cover designs and
  conversion reports.

Migrations run from the API container's entrypoint before uvicorn starts, so a fresh clone is
schema-correct the moment it boots.

---

## The anchor — the thing everything else hangs off

Highlights, private notes, passage-anchored comments and reading positions all store the same
locator:

```json
{
  "page_id": "uuid",
  "from": 128,
  "to": 245,
  "quote": "the exact selected text",
  "prefix": "~40 chars before",
  "suffix": "~40 chars after",
  "pdf": { "page": 3, "rects": [[x, y, w, h]] }
}
```

Resolution runs three stages (`apps/web/src/lib/anchor.ts`) and **never throws**:

1. **Positions.** Treat `from`/`to` as ProseMirror positions and check the text there still equals
   `quote`. Cheap, exact, correct while the page is unchanged.
2. **Context re-location.** Otherwise, flatten the page to plain text with a char-index →
   document-position map, collapse whitespace on both sides (so re-wrapping a paragraph cannot
   orphan a note), and search for `prefix + quote + suffix`, then `prefix + quote`, then
   `quote + suffix`, then `quote`. Ties are broken by distance from the original offset.
3. **Orphan.** If the quote is gone the annotation is marked orphaned: it disappears from the text
   but stays in the sidebar with its quote, so nobody silently loses a note or a discussion.

The `pdf` branch carries page-relative rectangles as **fractions of the page box**, so a highlight
in the fallback reader survives zoom, a different device and a re-render at another scale.

Two consequences worth stating plainly:

- **The reader renders a read-only ProseMirror document, not HTML.** That is what makes a browser
  selection convertible to positions (`posAtDOM`) and stored anchors resolvable back to a range.
- **Annotations are ProseMirror decorations, never marks.** The book document is never modified,
  so two readers on the same page each see their own marks over identical text, and an author's
  edit cannot corrupt a reader's annotations.

---

## Data model

Fifteen tables (`apps/api/app/models/`). Enums are stored as `VARCHAR` + `CHECK`
(`native_enum=False`) so adding a value later is an ordinary `ALTER`.

| Table | Notes |
|---|---|
| `users` | `handle` is unique and drives `/u/{handle}`. `reading_settings` is jsonb; `stats_visible` gates the statistics API with a 403, not just the UI. |
| `books` | `slug` unique for public routes. `front_cover` / `back_cover` are jsonb designs. `published_at` is set once and kept across re-publishes. |
| `pages` | `content` is a ProseMirror document, verbatim. Ordered by `index`. |
| `book_assets` | Uploaded images. Rasters are re-encoded on ingest (max 2400px, metadata dropped). |
| `book_invites` | Preview links into a **draft**; token, optional email and expiry, revocable, counts opens. |
| `favorites`, `ratings` | Composite primary keys; `ratings` also carries a 1–5 check constraint. |
| `comments` | `anchor` null ⇒ book-level. `thread_id` is denormalised so a thread is one indexed read. Soft delete only when replies exist. |
| `highlights` | Per user per book; seven colours. |
| `notes` | Rich text (jsonb), optionally hung off a highlight. |
| `note_attachments` | `link` · `image` · `quote` · `file`. |
| `reading_progress` | One row per user per book; the resume point. |
| `reading_sessions` | Written by the 15s heartbeat; the source of every statistic. |
| `notifications` | `comment_reply` · `book_comment` · `book_rating` · `invite_accepted`. |
| `imported_documents` | Keeps the original file forever plus a conversion report. |

---

## API overview

Everything is on the API host (`http://localhost:8000`); full schema at `/docs`.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register` (creates **and** signs in), `/auth/login`, `/auth/logout`, `/auth/refresh`, `GET|PATCH /auth/me`, `PATCH /auth/me/reading-settings`, `POST /auth/forgot-password` (stub) |
| Library | `GET /books` (`q`, `tag`, `sort`, paging), `GET /books/tags`, `GET /books/mine`, `POST /books`, `GET|PATCH|DELETE /books/{ref}` |
| Pages | `GET /books/{ref}/pages`, `/pages/full`, `POST /books/{ref}/pages`, `/pages/reorder`, `/pages/{id}/duplicate`, `GET|PATCH|DELETE /books/{ref}/pages/{id}` |
| Assets | `POST|GET /books/{ref}/assets`, `DELETE /assets/{id}`, `GET /media/{key}` |
| Publishing | `POST /books/{ref}/publish` · `/unpublish`, `GET|POST /books/{ref}/invites`, `DELETE /invites/{id}`, `POST /invites/{token}/accept` |
| Reading | `GET|PUT /books/{ref}/progress`, `POST /books/{ref}/heartbeat`, `GET /reading/continue` |
| Annotations | `GET|POST /books/{ref}/highlights`, `PATCH|DELETE /highlights/{id}`, `GET|POST /books/{ref}/notes`, `PATCH|DELETE /notes/{id}`, `POST /notes/{id}/attachments[/file]`, `DELETE /note-attachments/{id}` |
| Discussion | `GET|POST /books/{ref}/comments` (`scope=all\|book\|page`), `GET /comments/{id}/thread`, `PATCH|DELETE /comments/{id}` |
| Ratings | `GET|PUT|DELETE /books/{ref}/rating` |
| Favourites | `POST|DELETE /books/{ref}/favorite`, `GET /favorites` |
| Notifications | `GET /notifications`, `/unread-count`, `POST /notifications/read`, `/{id}/read` |
| Profile | `GET /users/{handle}`, `/comments`, `/stats`, `GET /users/me/trail` |
| Import | `POST /imports`, `GET /imports`, `GET /imports/{id}` |
| Export | `GET /books/{ref}/export.pdf?marks=` |

**Access rules.** Published books are readable anonymously. A draft returns **404, not 403**, to
anyone without the author's session or a valid invite token — an unlisted draft should not be
discoverable. Invite tokens travel as `?invite=` or `X-Cart-Invite`.

---

## Decisions taken while building

Recorded here as the brief asked, mostly where it left a choice open.

| Decision | Why |
|---|---|
| Frontend calls the API at `VITE_API_URL` rather than through a Vite proxy | Keeps the API exactly where the brief puts it. `localhost:5173` → `localhost:8000` is same-site, so `SameSite=Lax` cookies are still sent; CORS is configured with credentials. |
| The reader is a read-only ProseMirror document | Identical rendering to the editor, and it is the only way to map a browser selection to stable positions. See *The anchor* above. |
| Block styles (callout/epigraph/verse) and the S/M/L scale are attributes, not node types | A flatter document means fewer positions shift when an author restyles a paragraph, so existing highlights and discussions stay attached. |
| A reply inherits its parent's `page_id` and `anchor` | A whole thread stays anchored to the passage even when the reply was written from the sidebar. |
| `published_at` is set once | Re-publishing after an unpublish should not rewrite history. |
| Only a *first* rating notifies the author | Changing your mind is not news. |
| Print and export are light-on-white | The night palette is right on a screen and wrong on paper. |
| An export contains only the caller's own marks | It is a personal copy, not somebody else's annotations. |
| `requirements.txt` alongside `pyproject.toml` | Docker caches the dependency layer independently of the source tree; `pyproject.toml` reads its dependency list from the same file. |
| Surface colour read as `#171613` with a translucent variant | The brief's `#17161340` is an 8-digit hex (colour + 25% alpha). Both exist: `bg-ink-surface` and `bg-ink-surface/40`. |
| Web dev and prod are separate Dockerfile targets | `docker compose build` (with the dev override) builds the vite image; `npm run build` builds the nginx-served production image. |

---

## Deferred

Explicitly out of scope for v1 per the brief, listed here rather than left as dead UI:

- Real-time collaborative editing
- Payments / subscriptions
- Email delivery — the mail service is stubbed and logs to stdout (invites and password resets
  print their links there)
- Native mobile apps
- Internationalisation
- Admin / moderation panel
- Full-text search across book bodies — title, subtitle, description and author search is
  implemented
- Social graph (following users)

Deferred by choice while building:

- **S3 storage.** Uploads go to a local volume through a `StorageBackend` interface; swapping in S3
  is one class.
- **WebSocket notifications.** Polling every 60s and on window focus, as specified.
- **Email verification.** Registration is a single step and signs the user in immediately.
- **Server-side rendering.** Public routes set `document.title` and a meta description on the
  client; real SEO would need SSR or prerendering.
- **PDF image placement.** Images extracted from a PDF are appended to their page rather than
  positioned within the text flow.
- **Background job queue.** Document conversion runs inline in the request. A 300-page PDF will
  take a while; the upload modal says so.

---

## Testing

Per the brief, there is no test suite. `npm run smoke` checks that the containers are up,
migrations are at head, `/health` and `/openapi.json` answer, the web app serves, and one
authenticated round-trip works (register → `/auth/me` → create a draft). Everything else is
verified by hand.
