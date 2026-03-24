"""add login password auth fields for users

Revision ID: 20260319_0003
Revises: 20260319_0002
Create Date: 2026-03-19 12:00:00.000000
"""

from alembic import op
import sqlalchemy as sa
from passlib.context import CryptContext


# revision identifiers, used by Alembic.
revision = "20260319_0003"
down_revision = "20260319_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("login", sa.String(length=64), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.create_index("ix_users_login", "users", ["login"])
    op.create_unique_constraint("uq_users_login", "users", ["login"])

    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    default_hash = pwd_context.hash("change_me_123")
    op.execute(
        sa.text(
            """
            UPDATE users
            SET
              login = COALESCE(NULLIF(regexp_replace(phone, '[^0-9]', '', 'g'), ''), 'user_' || id::text),
              password_hash = :default_hash
            WHERE login IS NULL OR password_hash IS NULL
            """
        ).bindparams(default_hash=default_hash)
    )

    op.alter_column("users", "login", nullable=False)
    op.alter_column("users", "password_hash", nullable=False)
    op.alter_column("users", "phone", nullable=True)


def downgrade() -> None:
    op.alter_column("users", "phone", nullable=False)
    op.drop_constraint("uq_users_login", "users", type_="unique")
    op.drop_index("ix_users_login", table_name="users")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "login")
