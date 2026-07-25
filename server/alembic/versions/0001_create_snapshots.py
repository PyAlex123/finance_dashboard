"""create snapshots table

Revision ID: 0001
Revises:
Create Date: 2026-07-25
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "snapshots",
        sa.Column("workspace", sa.String(length=190), primary_key=True),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("snapshots")
