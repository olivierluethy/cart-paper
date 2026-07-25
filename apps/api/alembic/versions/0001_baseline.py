"""baseline schema

Revision ID: 0001_baseline
Revises:
Create Date: 2026-07-25

Every enum is rendered as VARCHAR + CHECK (``native_enum=False``) so adding a
value later is an ordinary ALTER rather than a PostgreSQL type migration.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_baseline"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NOW = sa.text("now()")
UUID = postgresql.UUID(as_uuid=True)


def _json() -> postgresql.JSONB:
    return postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    # ---------------------------------------------------------------- users
    op.create_table(
        "users",
        sa.Column("id", UUID, nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("handle", sa.String(length=48), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("avatar_url", sa.Text(), nullable=True),
        sa.Column("bio", sa.Text(), nullable=True),
        sa.Column("stats_visible", sa.Boolean(), nullable=False),
        sa.Column("reading_settings", _json(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_handle", "users", ["handle"], unique=True)

    # ---------------------------------------------------------------- books
    op.create_table(
        "books",
        sa.Column("id", UUID, nullable=False),
        sa.Column("author_id", UUID, nullable=False),
        sa.Column("title", sa.String(length=240), nullable=False),
        sa.Column("subtitle", sa.String(length=240), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("slug", sa.String(length=280), nullable=False),
        sa.Column(
            "status",
            sa.Enum("draft", "published", name="book_status", native_enum=False),
            nullable=False,
        ),
        sa.Column("language", sa.String(length=12), nullable=False),
        sa.Column("tags", _json(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("front_cover", _json(), nullable=True),
        sa.Column("back_cover", _json(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_books_author_id", "books", ["author_id"])
    op.create_index("ix_books_slug", "books", ["slug"], unique=True)
    op.create_index("ix_books_status", "books", ["status"])
    op.create_index("ix_books_status_published_at", "books", ["status", "published_at"])

    # ---------------------------------------------------------------- pages
    op.create_table(
        "pages",
        sa.Column("id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("index", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=240), nullable=True),
        sa.Column("content", _json(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_pages_book_id", "pages", ["book_id"])
    op.create_index("ix_pages_book_index", "pages", ["book_id", "index"])

    # ---------------------------------------------------------- book_assets
    op.create_table(
        "book_assets",
        sa.Column("id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=True),
        sa.Column("uploader_id", UUID, nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime", sa.String(length=127), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["uploader_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_book_assets_book_id", "book_assets", ["book_id"])

    # --------------------------------------------------------- book_invites
    op.create_table(
        "book_invites",
        sa.Column("id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("invited_email", sa.String(length=320), nullable=True),
        sa.Column("created_by", UUID, nullable=False),
        sa.Column("label", sa.String(length=120), nullable=True),
        sa.Column("accepted_count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_book_invites_book_id", "book_invites", ["book_id"])
    op.create_index("ix_book_invites_token", "book_invites", ["token"], unique=True)

    # ------------------------------------------------------------ favorites
    op.create_table(
        "favorites",
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "book_id"),
    )

    # -------------------------------------------------------------- ratings
    op.create_table(
        "ratings",
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("value", sa.SmallInteger(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.CheckConstraint("value >= 1 AND value <= 5", name="ck_ratings_value_range"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "book_id"),
    )

    # ------------------------------------------------------------- comments
    op.create_table(
        "comments",
        sa.Column("id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("page_id", UUID, nullable=True),
        sa.Column("parent_id", UUID, nullable=True),
        sa.Column("thread_id", UUID, nullable=True),
        sa.Column("author_id", UUID, nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("anchor", _json(), nullable=True),
        sa.Column("is_deleted", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["parent_id"], ["comments.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_comments_author_id", "comments", ["author_id"])
    op.create_index("ix_comments_book_id", "comments", ["book_id"])
    op.create_index("ix_comments_page_id", "comments", ["page_id"])
    op.create_index("ix_comments_parent_id", "comments", ["parent_id"])
    op.create_index("ix_comments_thread_id", "comments", ["thread_id"])
    op.create_index("ix_comments_book_page", "comments", ["book_id", "page_id"])

    # ----------------------------------------------------------- highlights
    op.create_table(
        "highlights",
        sa.Column("id", UUID, nullable=False),
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("page_id", UUID, nullable=True),
        sa.Column("anchor", _json(), nullable=False),
        sa.Column(
            "color",
            sa.Enum(
                "yellow",
                "green",
                "blue",
                "pink",
                "red",
                "purple",
                "black",
                name="highlight_color",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_highlights_book_id", "highlights", ["book_id"])
    op.create_index("ix_highlights_page_id", "highlights", ["page_id"])
    op.create_index("ix_highlights_user_id", "highlights", ["user_id"])
    op.create_index("ix_highlights_user_book", "highlights", ["user_id", "book_id"])

    # ---------------------------------------------------------------- notes
    op.create_table(
        "notes",
        sa.Column("id", UUID, nullable=False),
        sa.Column("highlight_id", UUID, nullable=True),
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("page_id", UUID, nullable=True),
        sa.Column("anchor", _json(), nullable=True),
        sa.Column("body", _json(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["highlight_id"], ["highlights.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notes_book_id", "notes", ["book_id"])
    op.create_index("ix_notes_highlight_id", "notes", ["highlight_id"])
    op.create_index("ix_notes_user_id", "notes", ["user_id"])
    op.create_index("ix_notes_user_book", "notes", ["user_id", "book_id"])

    # ------------------------------------------------------ note_attachments
    op.create_table(
        "note_attachments",
        sa.Column("id", UUID, nullable=False),
        sa.Column("note_id", UUID, nullable=False),
        sa.Column(
            "kind",
            sa.Enum("link", "image", "quote", "file", name="attachment_kind", native_enum=False),
            nullable=False,
        ),
        sa.Column("url", sa.Text(), nullable=True),
        sa.Column("title", sa.String(length=300), nullable=True),
        sa.Column("preview", sa.Text(), nullable=True),
        sa.Column("storage_key", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["note_id"], ["notes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_note_attachments_note_id", "note_attachments", ["note_id"])

    # ----------------------------------------------------- reading_progress
    op.create_table(
        "reading_progress",
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("page_id", UUID, nullable=True),
        sa.Column("anchor", _json(), nullable=True),
        sa.Column("percent", sa.Float(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["page_id"], ["pages.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "book_id"),
    )

    # ----------------------------------------------------- reading_sessions
    op.create_table(
        "reading_sessions",
        sa.Column("id", UUID, nullable=False),
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("active_seconds", sa.Integer(), nullable=False),
        sa.Column("pages_turned", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reading_sessions_book_id", "reading_sessions", ["book_id"])
    op.create_index("ix_reading_sessions_user_id", "reading_sessions", ["user_id"])

    # -------------------------------------------------------- notifications
    op.create_table(
        "notifications",
        sa.Column("id", UUID, nullable=False),
        sa.Column("user_id", UUID, nullable=False),
        sa.Column(
            "type",
            sa.Enum(
                "comment_reply",
                "book_comment",
                "book_rating",
                "invite_accepted",
                name="notification_type",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("actor_id", UUID, nullable=True),
        sa.Column("book_id", UUID, nullable=True),
        sa.Column("comment_id", UUID, nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["actor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["comment_id"], ["comments.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_user_created", "notifications", ["user_id", "created_at"])

    # --------------------------------------------------- imported_documents
    op.create_table(
        "imported_documents",
        sa.Column("id", UUID, nullable=False),
        sa.Column("user_id", UUID, nullable=False),
        sa.Column("book_id", UUID, nullable=True),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column(
            "source_type",
            sa.Enum("pdf", "docx", name="source_type", native_enum=False),
            nullable=False,
        ),
        sa.Column("original_storage_key", sa.String(length=512), nullable=False),
        sa.Column(
            "conversion_status",
            sa.Enum(
                "pending",
                "processing",
                "converted",
                "low_confidence",
                "failed",
                name="conversion_status",
                native_enum=False,
            ),
            nullable=False,
        ),
        sa.Column("conversion_report", _json(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=NOW, nullable=False),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_imported_documents_book_id", "imported_documents", ["book_id"])
    op.create_index("ix_imported_documents_user_id", "imported_documents", ["user_id"])


def downgrade() -> None:
    for table in (
        "imported_documents",
        "notifications",
        "reading_sessions",
        "reading_progress",
        "note_attachments",
        "notes",
        "highlights",
        "comments",
        "ratings",
        "favorites",
        "book_invites",
        "book_assets",
        "pages",
        "books",
        "users",
    ):
        op.drop_table(table)
