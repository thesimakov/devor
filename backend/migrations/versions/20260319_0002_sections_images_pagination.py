"""add sections and listing images

Revision ID: 20260319_0002
Revises: 20260319_0001
Create Date: 2026-03-19 11:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260319_0002"
down_revision = "20260319_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(length=50), nullable=False),
        sa.Column("name_ru", sa.String(length=255), nullable=False),
        sa.Column("name_tj", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.UniqueConstraint("key", name="uq_sections_key"),
        sa.UniqueConstraint("slug", name="uq_sections_slug"),
    )
    op.create_index("ix_sections_key", "sections", ["key"])
    op.create_index("ix_sections_slug", "sections", ["slug"])

    op.execute(
        sa.text(
            """
            INSERT INTO sections (key, name_ru, name_tj, slug)
            VALUES ('services', 'Услуги', 'Хизматҳо', 'services')
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO sections (key, name_ru, name_tj, slug)
            VALUES ('realty', 'Недвижимость', 'Амволи ғайриманқул', 'realty')
            """
        )
    )
    op.execute(
        sa.text(
            """
            INSERT INTO sections (key, name_ru, name_tj, slug)
            VALUES ('transport', 'Транспорт', 'Нақлиёт', 'transport')
            """
        )
    )

    op.add_column("categories", sa.Column("section_id", sa.Integer(), nullable=True))
    op.create_index("ix_categories_section_id", "categories", ["section_id"])
    op.create_foreign_key(
        "fk_categories_section_id_sections",
        "categories",
        "sections",
        ["section_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.execute(
        sa.text(
            """
            UPDATE categories
            SET section_id = (SELECT id FROM sections WHERE key='services' LIMIT 1)
            WHERE section_id IS NULL
            """
        )
    )
    op.alter_column("categories", "section_id", nullable=False)
    op.drop_constraint("uq_categories_slug", "categories", type_="unique")
    op.create_unique_constraint("uq_categories_section_slug", "categories", ["section_id", "slug"])

    op.create_table(
        "listing_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("listing_id", sa.Integer(), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_listing_images_listing_id", "listing_images", ["listing_id"])


def downgrade() -> None:
    op.drop_index("ix_listing_images_listing_id", table_name="listing_images")
    op.drop_table("listing_images")

    op.drop_constraint("uq_categories_section_slug", "categories", type_="unique")
    op.create_unique_constraint("uq_categories_slug", "categories", ["slug"])
    op.drop_constraint("fk_categories_section_id_sections", "categories", type_="foreignkey")
    op.drop_index("ix_categories_section_id", table_name="categories")
    op.drop_column("categories", "section_id")

    op.drop_index("ix_sections_slug", table_name="sections")
    op.drop_index("ix_sections_key", table_name="sections")
    op.drop_table("sections")
