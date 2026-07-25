# CART Paper — architecture

## Shape

Three containers, one command.

```
web (vite/react)  ──HTTP+cookies──▶  api (fastapi)  ──asyncpg──▶  db (postgres 16)
                                          │
                                          └── /data/uploads (named volume, served at /media)
```

- **web** — React 18 + Vite + TypeScript, Tailwind (dark only), Framer Motion, TipTap.
- **api** — FastAPI on Python 3.12, SQLAlchemy 2.0 async, Alembic, Pydantic v2.
- **db** — PostgreSQL 16. `jsonb` carries ProseMirror documents, anchors and cover designs.

Migrations run from the API container's entrypoint before uvicorn starts, so a fresh clone is
schema-correct the moment it boots.

## Decisions taken while building

Recorded here as required by the build brief, mostly where the spec left a choice open.

| Decision | Why |
|---|---|
| Frontend talks to the API at `VITE_API_URL` (`http://localhost:8000`) rather than through a Vite proxy | Keeps the API exactly where the brief puts it. `localhost:5173` → `localhost:8000` is same-site, so `SameSite=Lax` auth cookies are still sent; CORS is configured with credentials. |
| `requirements.txt` alongside `pyproject.toml` | Docker caches the dependency layer independently of the source tree. `pyproject.toml` stays the metadata/tooling home and reads its dependency list from the same file. |
| Surface colour read as `#171613` with a translucent variant | The brief's `#17161340` is an 8-digit hex (colour + 25% alpha). Both are available: `bg-ink-surface` and `bg-ink-surface/40`. |
| Web dev and prod are separate Dockerfile targets | `docker compose build` (which includes the dev override) builds the vite dev image; `npm run build` builds the nginx-served production image. |

## The anchor

Every annotation — highlight, note, anchored comment, reading position — stores the same object:

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

Resolution is a three-stage fallback, and it never throws:

1. **Positions.** Use `from`/`to` as ProseMirror positions and confirm the text there still equals
   `quote`. Cheap, exact, correct while the document is unchanged.
2. **Context re-location.** If it does not match, search the page's plain text for
   `prefix + quote + suffix`, then `quote + suffix`, then `quote` alone, scoring candidates by
   distance from the original offset. Map the winning text offset back to document positions.
3. **Orphan.** If the quote is gone, the annotation is marked `orphaned`. It disappears from the
   text but stays visible in the sidebar with its quote, so nobody silently loses a note or a
   discussion thread.

The `pdf` branch carries page-relative rectangles for the `pdf.js` fallback reader, where the same
three stages run against the extracted text layer instead of a ProseMirror document.

## Deferred (not in v1)

Explicitly out of scope, per the brief — listed here rather than left as dead UI:

- Real-time collaborative editing
- Payments / subscriptions
- Actual email delivery (the mail service is stubbed and logs to stdout)
- Native mobile apps
- Internationalisation
- Admin / moderation panel
- Full-text search across book bodies (title, author and description search is implemented)
- Social graph (following users)

Additionally deferred by choice:

- **S3 storage.** Uploads go to a local volume through a `StorageBackend` interface; swapping in S3
  is a single class.
- **WebSocket notifications.** Polling every 60s and on window focus, as specified.
- **Email verification.** Registration is a single step and logs the user in immediately.
