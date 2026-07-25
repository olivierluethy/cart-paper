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

Sixteen tables (`apps/api/app/models/`). Enums are stored as `VARCHAR` + `CHECK`
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
| `reading_progress` | One row per user per book: the resume point, plus `completed_at` and `restarted_count`. |
| `reading_sessions` | Written by the 15s heartbeat; the source of every statistic. |
| `notifications` | `comment_reply` · `book_comment` · `book_rating` · `invite_accepted`. |
| `imported_documents` | Keeps the original file forever plus a conversion report. |
| `oauth_accounts` | One row per (provider, account); unique on that pair. `users.password_hash` is nullable because of it. |

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
| Reading | `GET|PATCH /books/{ref}/progress` (PUT alias), `POST /books/{ref}/progress/restart`, `POST /books/{ref}/heartbeat`, `GET /reading/continue` |
| Annotations | `GET|POST /books/{ref}/highlights`, `PATCH|DELETE /highlights/{id}`, `GET|POST /books/{ref}/notes`, `PATCH|DELETE /notes/{id}`, `POST /notes/{id}/attachments[/file]`, `DELETE /note-attachments/{id}` |
| Discussion | `GET|POST /books/{ref}/comments` (`scope=all\|book\|page`), `GET /comments/{id}/thread`, `PATCH|DELETE /comments/{id}` |
| Ratings | `GET|PUT|DELETE /books/{ref}/rating` |
| Favourites | `POST|DELETE /books/{ref}/favorite`, `GET /favorites` |
| Notifications | `GET /notifications`, `/unread-count`, `POST /notifications/read`, `/{id}/read` |
| Profile | `GET /users/{handle}`, `/comments`, `/stats`, `GET /users/me/trail` |
| Avatar | `POST /me/avatar` (upload), `/me/avatar/url`, `/me/avatar/preview`, `DELETE /me/avatar` |
| Social sign-in | `GET /auth/providers`, `/auth/oauth/{provider}/start`, `/callback`, `GET /auth/linked`, `DELETE /auth/linked/{id}` |
| Import | `POST /imports`, `GET /imports`, `GET /imports/{id}` |
| Export | `GET /books/{ref}/export.pdf?marks=` |

**Access rules.** Published books are readable anonymously. A draft returns **404, not 403**, to
anyone without the author's session or a valid invite token — an unlisted draft should not be
discoverable. Invite tokens travel as `?invite=` or `X-Cart-Invite`.

---

## Progress and completion

`reading_progress` carries `page_id`, `percent`, `completed_at` and `restarted_count`.

* **The stored position is a high-water mark.** Writes are monotonic on the server: paging
  backwards, clicking past the last page or reloading can never lower it, and nothing clears
  `completed_at`. Without that, flicking back to re-read chapter one would lose your place.
* **Completion is confirmed, not inferred.** The reader sends `completed: true` when the last page
  is actually reached; a percentage that rounding nudged over the line is not enough on its own
  (though `>= 0.999` is also accepted as a fallback).
* **A finished book stays finished.** `POST /books/{id}/progress/restart` resets the position and
  increments `restarted_count`, but deliberately keeps `completed_at` — and every highlight, note
  and discussion.
* Client-side, writes are clamped to `[0, pageCount-1]`, deduplicated against the last payload,
  debounced to at most one every 2s, and flushed on unmount, `visibilitychange` and `pagehide`.

## Annotation privacy

Two kinds of annotation, and a reader should never have to work out which is which:

| | Private note | Public discussion |
|---|---|---|
| Stored in | `highlights` + `notes` | `comments` |
| Visible to | only its author — the API filters by `user_id` | everyone who can read the book |
| Icon | pencil / lock | speech bubble |
| Accent | amber | teal |
| Margin | left | right |
| Label | "Private note · only you" | "Public discussion · everyone can see this" |

That vocabulary lives in one module (`features/reader/privacy.tsx`) and is reused by the selection
toolbar, the margin markers, the panel tabs, both composers, the reader chrome and the profile
views. Highlights are never shared, and a PDF export contains only the caller's own marks.

Margin markers are permanent rather than hover-revealed: hover does not exist on touch, and "there
is a note here" is information, not a control. Anything that *is* hover-revealed elsewhere uses the
`can-hover:` Tailwind variant (`@media (hover: hover) and (pointer: fine)`) so it stays visible
where hovering is impossible.

## OAuth

`oauth_accounts` holds one row per `(provider, provider_account_id)` pair, unique on that pair, so a
single user can carry several identities. `users.password_hash` is nullable — an OAuth-only account
has no password — and every path that assumed one exists is guarded.

* `GET /auth/providers` — what is configured. The modals call this before rendering, so a button
  that cannot work is never shown as if it could.
* `GET /auth/oauth/{provider}/start` — 302 to consent when configured, **501
  `provider_not_configured`** when not.
* `GET /auth/oauth/{provider}/callback` — exchanges the code, upserts the user, and issues *exactly*
  the same httpOnly cookie session a password login does, so nothing downstream can tell the
  difference.

**Linking** follows a provider email only when the provider says it is verified. An unverified
address would let anyone who can type your email into a provider account walk into your library, so
those get a separate account instead. Disconnecting is refused when it is the account's only
remaining way to sign in.

### Activating a provider

No code changes are needed; this is configuration only.

**Google** — Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → Web
application. Authorised redirect URI `http://localhost:8000/auth/oauth/google/callback` (or your
`OAUTH_REDIRECT_BASE_URL` + `/auth/oauth/google/callback`). Fill in `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET`.

**Facebook** — developers.facebook.com → My Apps → Create App → add **Facebook Login**. Valid OAuth
Redirect URI `http://localhost:8000/auth/oauth/facebook/callback`. Fill in `FACEBOOK_APP_ID` and
`FACEBOOK_APP_SECRET`.

Restart the API. Authlib keeps the OAuth state and PKCE verifier in a short-lived signed session
cookie (`cp_oauth`, 10 minutes), signed with `SECRET_KEY`.

## Passwords and avatars

**Passwords.** The browser scores with zxcvbn-ts and shows a verdict, a crack time against offline
slow hashing and one suggestion — but that is advice. The server is authoritative and enforces only
what is not a matter of opinion: a 10-character minimum and rejection against a bundled list of
40k already-cracked passwords. A low zxcvbn score never blocks registration, because refusing
somebody's genuinely random passphrase is worse than letting it through. The generator uses
`crypto.getRandomValues` with rejection sampling (never modulo bias) and a bundled 4096-word list,
so the entropy figure it displays is real.

**Avatars.** Remote images are downloaded, cropped and re-hosted as 512×512 WebP — never hotlinked,
because a third-party host could otherwise break every avatar on the page and would see each
viewer's IP. Fetching a user-supplied URL from the server is SSRF, so the host is resolved before
the request and anything loopback, private, link-local, reserved or multicast is refused, on every
redirect hop.

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
- Real social sign-in **credentials** — the entire Google/Facebook flow, table and UI are built and
  tested; only the client id/secret are absent, and filling them in is the whole activation

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
