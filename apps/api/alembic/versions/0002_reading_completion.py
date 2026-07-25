"""reading completion

Revision ID: 0002_reading_completion
Revises: 0001_baseline
Create Date: 2026-07-25
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002_reading_completion"
down_revision: Union[str, None] = "0001_baseline"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "reading_progress",
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "reading_progress",
        sa.Column("restarted_count", sa.Integer(), nullable=False, server_default="0"),
    )
    # Existing rows that were already at the end count as finished, so nobody
    # loses a book they had in fact read.
    op.execute(
        "UPDATE reading_progress SET completed_at = updated_at WHERE percent >= 0.999"
    )
    op.alter_column("reading_progress", "restarted_count", server_default=None)


def downgrade() -> None:
    op.drop_column("reading_progress", "restarted_count")
    op.drop_column("reading_progress", "completed_at")
