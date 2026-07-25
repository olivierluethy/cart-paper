"""Demo data: `npm run seed`.

Three readers, four published books with real multi-page prose, images,
highlights, private notes with attachments, and a couple of anchored discussion
threads — so the first thing anybody sees is the product working rather than an
empty shelf.

Idempotent: running it twice does nothing unless you pass --reset.
"""

from __future__ import annotations

import asyncio
import io
import random
import sys
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.db.seed_content import BOOKS, doc, image
from app.db.session import SessionLocal
from app.models import (
    AttachmentKind,
    Book,
    BookStatus,
    Comment,
    Favorite,
    Highlight,
    HighlightColor,
    Note,
    NoteAttachment,
    NotificationType,
    Page,
    Rating,
    ReadingProgress,
    ReadingSession,
    User,
)
from app.core.security import hash_password
from app.services.anchors import anchor_for
from app.services.handles import unique_book_slug
from app.services.notifications import notify
from app.services.storage import storage

PASSWORD = "readwrite123"

READERS = [
    {
        "email": "mira@cartpaper.test",
        "handle": "mira",
        "display_name": "Mira Halloway",
        "bio": "Walks at night, writes it down in the morning. Two books here, both arguments.",
    },
    {
        "email": "tomas@cartpaper.test",
        "handle": "tomas",
        "display_name": "Tomas Ek",
        "bio": "Reads with a pencil. Believes the margin is the best part of any book.",
    },
    {
        "email": "odile@cartpaper.test",
        "handle": "odile",
        "display_name": "Odile Renard",
        "bio": "Four years on a coast that was leaving. Now inland, still counting.",
    },
]

AUTHORS = {0: "mira", 1: "tomas", 2: "odile", 3: "mira"}


def make_image(seed: int, caption: str) -> str:
    """A plausible plate rather than a placeholder box, generated offline."""
    from PIL import Image, ImageDraw

    rng = random.Random(seed)
    width, height = 1200, 720
    top = (rng.randint(20, 60), rng.randint(24, 60), rng.randint(28, 66))
    bottom = (rng.randint(8, 22), rng.randint(8, 24), rng.randint(10, 26))

    canvas = Image.new("RGB", (width, height), top)
    draw = ImageDraw.Draw(canvas, "RGBA")
    for y in range(height):
        blend = y / height
        draw.line(
            [(0, y), (width, y)],
            fill=tuple(round(top[i] + (bottom[i] - top[i]) * blend) for i in range(3)),
        )

    # A horizon and a scatter of lights — enough to read as a night scene.
    horizon = int(height * rng.uniform(0.55, 0.7))
    draw.rectangle([0, horizon, width, height], fill=(0, 0, 0, 90))
    for _ in range(rng.randint(40, 90)):
        x = rng.randint(0, width)
        y = rng.randint(horizon - 120, horizon - 4)
        size = rng.randint(2, 5)
        glow = rng.choice([(217, 160, 91), (240, 205, 156), (128, 172, 170)])
        draw.ellipse([x, y, x + size, y + size], fill=(*glow, rng.randint(120, 235)))
    for _ in range(rng.randint(6, 14)):
        x = rng.randint(0, width)
        w = rng.randint(20, 90)
        h = rng.randint(40, 220)
        draw.rectangle([x, horizon - h, x + w, horizon], fill=(0, 0, 0, rng.randint(60, 140)))

    buffer = io.BytesIO()
    canvas.save(buffer, format="JPEG", quality=82, optimize=True)
    key = storage.save(buffer.getvalue(), suffix=".jpg", prefix="assets")
    return storage.url(key)


async def wipe(db) -> None:
    emails = [reader["email"] for reader in READERS]
    users = list(await db.scalars(select(User).where(User.email.in_(emails))))
    for user in users:
        # Every other table hangs off users with ON DELETE CASCADE.
        await db.delete(user)
    await db.commit()
    print(f"[seed] removed {len(users)} demo account(s) and everything attached to them")


async def seed() -> None:
    reset = "--reset" in sys.argv

    async with SessionLocal() as db:
        if reset:
            await wipe(db)

        existing = await db.scalar(select(User).where(User.email == READERS[0]["email"]))
        if existing is not None:
            print("[seed] demo data is already present — pass --reset to rebuild it")
            return

        now = datetime.now(UTC)

        # -------------------------------------------------------------- readers
        users: dict[str, User] = {}
        for reader in READERS:
            user = User(
                email=reader["email"],
                handle=reader["handle"],
                display_name=reader["display_name"],
                bio=reader["bio"],
                password_hash=hash_password(PASSWORD),
            )
            db.add(user)
            users[reader["handle"]] = user
        await db.flush()
        print(f"[seed] {len(users)} readers (password: {PASSWORD})")

        # ---------------------------------------------------------------- books
        plates = {
            1: make_image(11, "Sodium, the last winter it was still in use"),
            2: make_image(23, "The same stretch of shore, sixty-one years apart"),
        }

        books: list[Book] = []
        pages_by_book: list[list[Page]] = []

        for index, spec in enumerate(BOOKS):
            author = users[AUTHORS[index]]
            book = Book(
                author_id=author.id,
                title=spec["title"],
                subtitle=spec["subtitle"],
                description=spec["description"],
                slug=await unique_book_slug(db, spec["title"]),
                status=BookStatus.published,
                published_at=now - timedelta(days=(len(BOOKS) - index) * 9),
                tags=spec["tags"],
                front_cover=spec["cover"],
                back_cover=spec["back"],
            )
            db.add(book)
            await db.flush()

            page_rows: list[Page] = []
            for page_index, (title, blocks) in enumerate(spec["pages"]):
                content = list(blocks)
                # One plate each in two of the books, placed inside the text.
                if index == 0 and page_index == 1:
                    content.insert(3, image(plates[1], "Sodium, the last winter it was still in use"))
                if index == 2 and page_index == 1:
                    content.insert(3, image(plates[2], "The same stretch of shore, sixty-one years apart"))

                page = Page(book_id=book.id, index=page_index, title=title, content=doc(*content))
                db.add(page)
                page_rows.append(page)

            await db.flush()
            books.append(book)
            pages_by_book.append(page_rows)

        print(f"[seed] {len(books)} published books, {sum(len(p) for p in pages_by_book)} pages")

        mira, tomas, odile = users["mira"], users["tomas"], users["odile"]

        # ----------------------------------------------------------- highlights
        marks = [
            (tomas, 0, 0, "Attention is not a resource you spend.", HighlightColor.yellow),
            (tomas, 0, 3, "It is for the part of thinking that cannot be done sitting down.", HighlightColor.green),
            (odile, 0, 1, "A very few light their trees, and those are the ones I would live in.", HighlightColor.blue),
            (mira, 1, 0, "A book you have not written in is a book you have not finished reading.", HighlightColor.yellow),
            (mira, 1, 2, "It means being read while reading. I think it is worth it.", HighlightColor.purple),
            (odile, 1, 1, "Agreement leaves no mark. Disagreement leaves a scar.", HighlightColor.red),
            (tomas, 2, 0, "The sea does not take the land all at once. That is the cruelty of it.", HighlightColor.blue),
            (mira, 2, 3, "Almost everything worth keeping was kept by somebody who had no particular", HighlightColor.green),
            (tomas, 3, 0, "Forgetting is not the failure of memory.", HighlightColor.pink),
        ]

        created: dict[tuple[str, int, int], Highlight] = {}
        for reader, book_index, page_index, needle, color in marks:
            page = pages_by_book[book_index][page_index]
            anchor = anchor_for(page.content, page.id, needle)
            if anchor is None:
                print(f"[seed]   ! could not anchor {needle[:40]!r}")
                continue
            highlight = Highlight(
                user_id=reader.id,
                book_id=books[book_index].id,
                page_id=page.id,
                anchor=anchor,
                color=color,
            )
            db.add(highlight)
            created[(reader.handle, book_index, page_index)] = highlight
        await db.flush()
        print(f"[seed] {len(created)} highlights")

        # ---------------------------------------------------------------- notes
        def note_body(*paragraphs: str) -> dict:
            return {
                "type": "doc",
                "content": [
                    {"type": "paragraph", "content": [{"type": "text", "text": text}]}
                    for text in paragraphs
                ],
            }

        tomas_note = Note(
            user_id=tomas.id,
            book_id=books[0].id,
            page_id=pages_by_book[0][0].id,
            highlight_id=created[("tomas", 0, 0)].id,
            anchor=created[("tomas", 0, 0)].anchor,
            body=note_body(
                "This is the sentence the whole book turns on, and it arrives on page one — "
                "which is either confident or careless.",
                "Compare with the argument in A Field Guide to Forgetting: attention as a room "
                "you enter, memory as a shape left behind. Same claim from two directions.",
            ),
        )
        db.add(tomas_note)
        await db.flush()
        db.add_all(
            [
                NoteAttachment(
                    note_id=tomas_note.id,
                    kind=AttachmentKind.quote,
                    preview="A mind that kept everything would not be a better mind.",
                    title="A Field Guide to Forgetting, page 1",
                ),
                NoteAttachment(
                    note_id=tomas_note.id,
                    kind=AttachmentKind.link,
                    url="https://en.wikipedia.org/wiki/Sodium-vapor_lamp",
                    title="Sodium-vapour lamp — why the orange light is going",
                ),
            ]
        )

        mira_note = Note(
            user_id=mira.id,
            book_id=books[1].id,
            page_id=pages_by_book[1][2].id,
            highlight_id=created[("mira", 1, 2)].id,
            anchor=created[("mira", 1, 2)].anchor,
            body=note_body(
                "He is describing this platform without having seen it. Keep this passage for "
                "the epigraph if the essay ever gets written."
            ),
        )
        db.add(mira_note)

        odile_note = Note(
            user_id=odile.id,
            book_id=books[1].id,
            page_id=pages_by_book[1][1].id,
            highlight_id=created[("odile", 1, 1)].id,
            anchor=created[("odile", 1, 1)].anchor,
            body=note_body(
                "True of coastlines too. Nobody photographs the shore that stayed where it was."
            ),
        )
        db.add(odile_note)
        await db.flush()
        print("[seed] 3 private notes with attachments")

        # ------------------------------------------------- anchored discussions
        threads = [
            (
                tomas,
                1,
                2,
                "I want the thing that is about the sentence",
                "This is the argument, and it is buried three pages in. Everything before it is "
                "throat-clearing about Coleridge.",
                [
                    (mira, "The Coleridge is doing work — it establishes that this is the old "
                           "practice being restored, not a new gimmick. I would not cut it."),
                    (odile, "Both of you are right, which is why the chapter feels long. It is "
                            "two chapters wearing one coat."),
                ],
            ),
            (
                odile,
                0,
                2,
                "It is the least romantic hour and by far the most competent.",
                "The best line in the book and it is thrown away in a subordinate clause. Was "
                "that deliberate?",
                [
                    (mira, "Entirely deliberate. If you put it in its own paragraph it starts "
                           "congratulating itself."),
                    (tomas, "It is also the only sentence here that likes anybody. Worth "
                            "noticing what it takes for this author to be warm."),
                ],
            ),
            (
                mira,
                2,
                1,
                "a person who noticed and then did not stop",
                "Sixty-one photographs is the whole thesis of this book in one object. I keep "
                "coming back to the fact that he had no theory.",
                [
                    (odile, "He would have hated being made an example of. I did ask him once "
                            "what it was for and he said “somebody ought to”, and changed the subject."),
                ],
            ),
        ]

        thread_count = 0
        for starter, book_index, page_index, needle, body, replies in threads:
            page = pages_by_book[book_index][page_index]
            anchor = anchor_for(page.content, page.id, needle)
            if anchor is None:
                print(f"[seed]   ! could not anchor discussion {needle[:40]!r}")
                continue
            root = Comment(
                book_id=books[book_index].id,
                page_id=page.id,
                author_id=starter.id,
                body=body,
                anchor=anchor,
                created_at=now - timedelta(days=4, hours=thread_count),
            )
            db.add(root)
            await db.flush()
            root.thread_id = root.id

            for offset, (author, text) in enumerate(replies, start=1):
                reply = Comment(
                    book_id=root.book_id,
                    page_id=root.page_id,
                    parent_id=root.id,
                    thread_id=root.id,
                    author_id=author.id,
                    body=text,
                    anchor=root.anchor,
                    created_at=root.created_at + timedelta(hours=offset * 5),
                )
                db.add(reply)
                await db.flush()
                await notify(
                    db,
                    user_id=root.author_id,
                    type=NotificationType.comment_reply,
                    actor_id=author.id,
                    book_id=root.book_id,
                    comment_id=reply.id,
                )
                await notify(
                    db,
                    user_id=books[book_index].author_id,
                    type=NotificationType.book_comment,
                    actor_id=author.id,
                    book_id=root.book_id,
                    comment_id=reply.id,
                )
            thread_count += 1

        # A whole-book comment, so the book page is not empty either.
        book_level = Comment(
            book_id=books[3].id,
            author_id=odile.id,
            body="Read this in one sitting on a train and then immediately again. The second "
                 "chapter does something I have not seen done well before.",
            created_at=now - timedelta(days=2),
        )
        db.add(book_level)
        await db.flush()
        book_level.thread_id = book_level.id
        await notify(
            db,
            user_id=books[3].author_id,
            type=NotificationType.book_comment,
            actor_id=odile.id,
            book_id=books[3].id,
            comment_id=book_level.id,
        )
        print(f"[seed] {thread_count} anchored discussions + 1 book-level thread")

        # ------------------------------------------- ratings, favourites, progress
        ratings = [
            (tomas, 0, 5), (odile, 0, 4),
            (mira, 1, 5), (odile, 1, 4),
            (mira, 2, 5), (tomas, 2, 4),
            (tomas, 3, 5), (odile, 3, 5),
        ]
        for reader, book_index, value in ratings:
            db.add(Rating(user_id=reader.id, book_id=books[book_index].id, value=value))
            await notify(
                db,
                user_id=books[book_index].author_id,
                type=NotificationType.book_rating,
                actor_id=reader.id,
                book_id=books[book_index].id,
            )

        for reader, book_index in [(tomas, 0), (tomas, 3), (odile, 1), (mira, 2)]:
            db.add(Favorite(user_id=reader.id, book_id=books[book_index].id))

        progress = [(tomas, 0, 1, 0.33), (odile, 1, 1, 0.5), (mira, 2, 2, 0.66)]
        for reader, book_index, page_index, percent in progress:
            db.add(
                ReadingProgress(
                    user_id=reader.id,
                    book_id=books[book_index].id,
                    page_id=pages_by_book[book_index][page_index].id,
                    percent=percent,
                )
            )

        # A fortnight of reading sessions, so the statistics screen has a shape.
        rng = random.Random(7)
        for reader in (mira, tomas, odile):
            for day in range(14):
                if rng.random() < 0.25:
                    continue
                book = books[rng.randrange(len(books))]
                started = now - timedelta(days=day, hours=rng.randint(0, 6))
                seconds = rng.randint(300, 2700)
                db.add(
                    ReadingSession(
                        user_id=reader.id,
                        book_id=book.id,
                        started_at=started,
                        ended_at=started + timedelta(seconds=seconds),
                        active_seconds=seconds,
                        pages_turned=rng.randint(1, 9),
                    )
                )

        await db.commit()
        print("[seed] ratings, favourites, progress and a fortnight of reading sessions")
        print("\n[seed] done. Sign in as mira@cartpaper.test / " + PASSWORD)


def main() -> None:
    asyncio.run(seed())


if __name__ == "__main__":
    main()
