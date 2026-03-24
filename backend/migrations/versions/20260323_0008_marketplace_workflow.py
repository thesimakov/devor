"""marketplace: roles, listing kind/workflow, geo, voice, responses

Revision ID: 20260323_0008
Revises: 20260319_0007
"""

from alembic import op
import sqlalchemy as sa


revision = "20260323_0008"
down_revision = "20260319_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    marketplace_role = sa.Enum("customer", "executor", name="marketplace_role")
    marketplace_role.create(bind, checkfirst=True)
    verification_level = sa.Enum("none", "phone", "extended", name="verification_level")
    verification_level.create(bind, checkfirst=True)
    listing_kind = sa.Enum("offer", "request", name="listing_kind")
    listing_kind.create(bind, checkfirst=True)
    job_workflow_status = sa.Enum("active", "in_progress", "completed", "cancelled", name="job_workflow_status")
    job_workflow_status.create(bind, checkfirst=True)

    op.add_column("users", sa.Column("marketplace_role", marketplace_role, nullable=True))
    op.add_column("users", sa.Column("avatar_url", sa.String(length=500), nullable=True))
    op.add_column(
        "users",
        sa.Column("rating_avg", sa.Numeric(3, 2), nullable=False, server_default="0"),
    )
    op.add_column("users", sa.Column("telegram_chat_id", sa.String(length=64), nullable=True))
    op.add_column(
        "users",
        sa.Column("verification_level", verification_level, nullable=False, server_default="none"),
    )
    op.alter_column("users", "rating_avg", server_default=None)
    op.alter_column("users", "verification_level", server_default=None)
    op.create_index("ix_users_telegram_chat_id", "users", ["telegram_chat_id"], unique=False)

    op.add_column(
        "listings",
        sa.Column("kind", listing_kind, nullable=False, server_default="offer"),
    )
    op.add_column(
        "listings",
        sa.Column("workflow_status", job_workflow_status, nullable=False, server_default="active"),
    )
    op.alter_column("listings", "kind", server_default=None)
    op.alter_column("listings", "workflow_status", server_default=None)
    op.add_column("listings", sa.Column("latitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("listings", sa.Column("longitude", sa.Numeric(10, 7), nullable=True))
    op.add_column("listings", sa.Column("address_line", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("deadline_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("listings", sa.Column("budget_min", sa.Numeric(12, 2), nullable=True))
    op.add_column("listings", sa.Column("budget_max", sa.Numeric(12, 2), nullable=True))
    op.add_column("listings", sa.Column("voice_url", sa.String(length=500), nullable=True))
    op.add_column("listings", sa.Column("voice_transcript", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("assigned_executor_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_listings_assigned_executor_id_users",
        "listings",
        "users",
        ["assigned_executor_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_listings_kind", "listings", ["kind"], unique=False)
    op.create_index("ix_listings_workflow_status", "listings", ["workflow_status"], unique=False)
    op.create_index("ix_listings_latitude", "listings", ["latitude"], unique=False)
    op.create_index("ix_listings_longitude", "listings", ["longitude"], unique=False)
    op.create_index("ix_listings_assigned_executor_id", "listings", ["assigned_executor_id"], unique=False)

    op.create_table(
        "listing_responses",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("executor_id", sa.Integer(), nullable=False),
        sa.Column("proposed_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("comment", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["executor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_id", "executor_id", name="uq_listing_response_executor"),
    )
    op.create_index("ix_listing_responses_listing_id", "listing_responses", ["listing_id"], unique=False)
    op.create_index("ix_listing_responses_executor_id", "listing_responses", ["executor_id"], unique=False)
    op.alter_column("listing_responses", "comment", server_default=None)
    op.alter_column("listing_responses", "created_at", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_listing_responses_executor_id", table_name="listing_responses")
    op.drop_index("ix_listing_responses_listing_id", table_name="listing_responses")
    op.drop_table("listing_responses")

    op.drop_index("ix_listings_assigned_executor_id", table_name="listings")
    op.drop_constraint("fk_listings_assigned_executor_id_users", "listings", type_="foreignkey")
    op.drop_column("listings", "assigned_executor_id")
    op.drop_column("listings", "voice_transcript")
    op.drop_column("listings", "voice_url")
    op.drop_column("listings", "budget_max")
    op.drop_column("listings", "budget_min")
    op.drop_column("listings", "deadline_at")
    op.drop_column("listings", "address_line")
    op.drop_column("listings", "longitude")
    op.drop_column("listings", "latitude")
    op.drop_column("listings", "workflow_status")
    op.drop_column("listings", "kind")

    op.drop_index("ix_users_telegram_chat_id", table_name="users")
    op.drop_column("users", "verification_level")
    op.drop_column("users", "telegram_chat_id")
    op.drop_column("users", "rating_avg")
    op.drop_column("users", "avatar_url")
    op.drop_column("users", "marketplace_role")

    job_workflow_status = sa.Enum(name="job_workflow_status")
    job_workflow_status.drop(op.get_bind(), checkfirst=True)
    listing_kind = sa.Enum(name="listing_kind")
    listing_kind.drop(op.get_bind(), checkfirst=True)
    verification_level = sa.Enum(name="verification_level")
    verification_level.drop(op.get_bind(), checkfirst=True)
    marketplace_role = sa.Enum(name="marketplace_role")
    marketplace_role.drop(op.get_bind(), checkfirst=True)
