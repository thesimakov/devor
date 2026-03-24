"""add manager to user_role enum

Revision ID: 20260319_0007
Revises: 20260319_0006
"""

from alembic import op
import sqlalchemy as sa


revision = "20260319_0007"
down_revision = "20260319_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Идемпотентно: повторный прогон может выдать ошибку «already exists» — игнорируем.
    try:
        op.execute(sa.text("ALTER TYPE user_role ADD VALUE 'manager'"))
    except Exception:
        pass


def downgrade() -> None:
    pass
