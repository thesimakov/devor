"""auction bids + cart + listing.auction_settled_at

Revision ID: 20260325_0010
Revises: 20260324_0009
"""

from alembic import op
import sqlalchemy as sa


revision = "20260325_0010"
down_revision = "20260324_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    cart_source = sa.Enum("auction", "manual", name="cart_item_source")
    cart_source.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "auction_bids",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount_som", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_auction_bids_listing_id", "auction_bids", ["listing_id"], unique=False)
    op.create_index("ix_auction_bids_user_id", "auction_bids", ["user_id"], unique=False)
    op.create_index("ix_auction_bids_created_at", "auction_bids", ["created_at"], unique=False)

    op.create_table(
        "cart_items",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("listing_id", sa.Integer(), nullable=False),
        sa.Column("price_som", sa.Numeric(12, 2), nullable=False),
        sa.Column("source", cart_source, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "listing_id", name="uq_cart_user_listing"),
        sa.UniqueConstraint("listing_id", name="uq_cart_listing_one_row"),
    )
    op.create_index("ix_cart_items_user_id", "cart_items", ["user_id"], unique=False)

    op.add_column("listings", sa.Column("auction_settled_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("listings", "auction_settled_at")
    op.drop_index("ix_cart_items_user_id", table_name="cart_items")
    op.drop_table("cart_items")
    op.drop_index("ix_auction_bids_created_at", table_name="auction_bids")
    op.drop_index("ix_auction_bids_user_id", table_name="auction_bids")
    op.drop_index("ix_auction_bids_listing_id", table_name="auction_bids")
    op.drop_table("auction_bids")
    sa.Enum(name="cart_item_source").drop(op.get_bind(), checkfirst=True)
