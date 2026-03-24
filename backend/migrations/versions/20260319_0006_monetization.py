"""monetization: balance, promotion, billing ledger

Revision ID: 20260319_0006
Revises: 20260319_0005
Create Date: 2026-03-19 22:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260319_0006"
down_revision = "20260319_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("balance_som", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.alter_column("users", "balance_som", server_default=None)

    op.add_column(
        "listings",
        sa.Column("promoted_until", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_listings_promoted_until", "listings", ["promoted_until"], unique=False)

    billing_kind = sa.Enum("topup_demo", "promotion", name="billing_ledger_kind")

    op.create_table(
        "billing_ledger",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=True),
        sa.Column("delta_som", sa.Numeric(12, 2), nullable=False),
        sa.Column("balance_after_som", sa.Numeric(12, 2), nullable=False),
        sa.Column("kind", billing_kind, nullable=False),
        sa.Column("note", sa.String(length=500), nullable=False, server_default=""),
        sa.Column("package_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_billing_ledger_user_id", "billing_ledger", ["user_id"], unique=False)
    op.create_index("ix_billing_ledger_listing_id", "billing_ledger", ["listing_id"], unique=False)
    op.alter_column("billing_ledger", "created_at", server_default=None)
    op.alter_column("billing_ledger", "note", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_billing_ledger_listing_id", table_name="billing_ledger")
    op.drop_index("ix_billing_ledger_user_id", table_name="billing_ledger")
    op.drop_table("billing_ledger")
    billing_kind = sa.Enum("topup_demo", "promotion", name="billing_ledger_kind")
    billing_kind.drop(op.get_bind(), checkfirst=True)
    op.drop_index("ix_listings_promoted_until", table_name="listings")
    op.drop_column("listings", "promoted_until")
    op.drop_column("users", "balance_som")
