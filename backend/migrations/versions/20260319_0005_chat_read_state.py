"""add read state for chat messages

Revision ID: 20260319_0005
Revises: 20260319_0004
Create Date: 2026-03-19 19:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260319_0005"
down_revision = "20260319_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "chat_messages",
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(sa.text("UPDATE chat_messages SET is_read = false WHERE is_read IS NULL"))
    op.alter_column("chat_messages", "is_read", server_default=None)


def downgrade() -> None:
    op.drop_column("chat_messages", "is_read")
