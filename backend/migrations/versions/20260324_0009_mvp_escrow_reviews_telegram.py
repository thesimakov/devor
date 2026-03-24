"""MVP: escrow, reviews, telegram link, verification docs, transcription status, billing enum

Revision ID: 20260324_0009
Revises: 20260323_0008
"""

from alembic import op
import sqlalchemy as sa


revision = "20260324_0009"
down_revision = "20260323_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    escrow_status = sa.Enum(
        "awaiting_payment",
        "funded",
        "released",
        "disputed",
        "refunded",
        name="escrow_status",
    )

    transcription_status = sa.Enum(
        "pending", "processing", "done", "failed", "skipped", name="transcription_status", create_type=False
    )

    verification_doc_kind = sa.Enum("passport", "selfie", name="verification_doc_kind")

    verification_doc_status = sa.Enum("pending", "approved", "rejected", name="verification_doc_status")

    # PostgreSQL: новые значения billing_ledger_kind (идемпотентно)
    for val in ("escrow_hold", "escrow_release", "escrow_refund"):
        try:
            op.execute(sa.text(f"ALTER TYPE billing_ledger_kind ADD VALUE '{val}'"))
        except Exception:
            pass

    op.add_column("users", sa.Column("telegram_username", sa.String(length=64), nullable=True))

    bind = op.get_bind()
    transcription_status.create(bind, checkfirst=True)

    op.add_column(
        "listings",
        sa.Column(
            "transcription_status",
            transcription_status,
            nullable=False,
            server_default="skipped",
        ),
    )
    op.alter_column("listings", "transcription_status", server_default=None)
    op.create_index("ix_listings_transcription_status", "listings", ["transcription_status"], unique=False)

    op.create_table(
        "escrow_transactions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("executor_id", sa.Integer(), nullable=False),
        sa.Column("amount_som", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", escrow_status, nullable=False),
        sa.Column("payment_ref", sa.String(length=128), nullable=True),
        sa.Column("dispute_reason", sa.Text(), nullable=True),
        sa.Column("dispute_opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dispute_resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_note", sa.Text(), nullable=True),
        sa.Column("resolved_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["customer_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["executor_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["resolved_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_id", name="uq_escrow_one_per_listing"),
    )
    op.create_index("ix_escrow_transactions_listing_id", "escrow_transactions", ["listing_id"], unique=False)
    op.create_index("ix_escrow_transactions_customer_id", "escrow_transactions", ["customer_id"], unique=False)
    op.create_index("ix_escrow_transactions_executor_id", "escrow_transactions", ["executor_id"], unique=False)
    op.create_index("ix_escrow_transactions_status", "escrow_transactions", ["status"], unique=False)
    op.create_index("ix_escrow_transactions_payment_ref", "escrow_transactions", ["payment_ref"], unique=False)
    op.alter_column("escrow_transactions", "created_at", server_default=None)
    op.alter_column("escrow_transactions", "updated_at", server_default=None)

    op.create_table(
        "reviews",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.Integer(), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=False),
        sa.Column("stars", sa.Integer(), nullable=False),
        sa.Column("text_ru", sa.Text(), nullable=True),
        sa.Column("text_tj", sa.Text(), nullable=True),
        sa.Column("photo_url", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["author_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["target_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_id", "author_id", name="uq_review_listing_author"),
    )
    op.create_index("ix_reviews_listing_id", "reviews", ["listing_id"], unique=False)
    op.create_index("ix_reviews_author_id", "reviews", ["author_id"], unique=False)
    op.create_index("ix_reviews_target_user_id", "reviews", ["target_user_id"], unique=False)
    op.alter_column("reviews", "created_at", server_default=None)

    op.create_table(
        "telegram_link_tokens",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_telegram_link_tokens_token"),
    )
    op.create_index("ix_telegram_link_tokens_user_id", "telegram_link_tokens", ["user_id"], unique=False)
    op.create_index("ix_telegram_link_tokens_token", "telegram_link_tokens", ["token"], unique=True)

    op.create_table(
        "verification_documents",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", verification_doc_kind, nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("status", verification_doc_status, nullable=False, server_default="pending"),
        sa.Column("admin_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "kind", name="uq_verification_user_kind"),
    )
    op.create_index("ix_verification_documents_user_id", "verification_documents", ["user_id"], unique=False)
    op.create_index("ix_verification_documents_status", "verification_documents", ["status"], unique=False)
    op.alter_column("verification_documents", "created_at", server_default=None)
    op.alter_column("verification_documents", "status", server_default=None)


def downgrade() -> None:
    op.drop_table("verification_documents")
    op.drop_table("telegram_link_tokens")
    op.drop_table("reviews")
    op.drop_table("escrow_transactions")

    op.drop_index("ix_listings_transcription_status", table_name="listings")
    op.drop_column("listings", "transcription_status")
    op.drop_column("users", "telegram_username")

    bind = op.get_bind()
    sa.Enum(name="verification_doc_status").drop(bind, checkfirst=True)
    sa.Enum(name="verification_doc_kind").drop(bind, checkfirst=True)
    sa.Enum(name="transcription_status").drop(bind, checkfirst=True)
    sa.Enum(name="escrow_status").drop(bind, checkfirst=True)
    # billing_ledger_kind values cannot be removed safely in PG without recreating type
