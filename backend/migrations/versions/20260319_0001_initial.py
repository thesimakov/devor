"""initial schema for services module

Revision ID: 20260319_0001
Revises:
Create Date: 2026-03-19 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260319_0001"
down_revision = None
branch_labels = None
depends_on = None


user_role = sa.Enum("user", "admin", name="user_role")
listing_status = sa.Enum("active", "archived", "moderated", name="listing_status")


def upgrade() -> None:
    # Не вызывать .create() отдельно: SQLAlchemy создаст тип при первом create_table с колонкой ENUM.
    # Иначе PG получает два CREATE TYPE (explicit + перед create_table).

    op.create_table(
        "categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name_ru", sa.String(length=255), nullable=False),
        sa.Column("name_tj", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("parent_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="SET NULL"), nullable=True),
        sa.Column("level", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("slug", name="uq_categories_slug"),
    )
    op.create_index("ix_categories_slug", "categories", ["slug"])
    op.create_index("ix_categories_parent_id", "categories", ["parent_id"])

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("role", user_role, nullable=False, server_default="user"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("phone", name="uq_users_phone"),
    )
    op.create_index("ix_users_phone", "users", ["phone"])

    op.create_table(
        "listings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("price", sa.Numeric(12, 2), nullable=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("views_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", listing_status, nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_listings_title", "listings", ["title"])
    op.create_index("ix_listings_category_id", "listings", ["category_id"])
    op.create_index("ix_listings_user_id", "listings", ["user_id"])
    op.create_index("ix_listings_city", "listings", ["city"])

    op.create_table(
        "favorites",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("listing_id", sa.Integer(), sa.ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True),
        sa.UniqueConstraint("user_id", "listing_id", name="uq_favorites_user_listing"),
    )

    categories_table = sa.table(
        "categories",
        sa.column("name_ru", sa.String),
        sa.column("name_tj", sa.String),
        sa.column("slug", sa.String),
        sa.column("parent_id", sa.Integer),
        sa.column("level", sa.Integer),
    )

    op.bulk_insert(
        categories_table,
        [
            {"name_ru": "Автосервис, аренда", "name_tj": "Хизматрасонии авто, иҷора", "slug": "avtoservis-arenda", "parent_id": None, "level": 0},
            {"name_ru": "Перевозки и доставка", "name_tj": "Нақлиёт ва расондан", "slug": "perevozki-dostavka", "parent_id": None, "level": 0},
            {"name_ru": "Пассажирские перевозки", "name_tj": "Нақлиёти мусофиркаш", "slug": "passazhirskie-perevozki", "parent_id": None, "level": 0},
            {"name_ru": "Грузчики, складские услуги", "name_tj": "Боркашон, хизматҳои анбор", "slug": "gruzchiki-sklad", "parent_id": None, "level": 0},
            {"name_ru": "Услуги эвакуатора", "name_tj": "Хизматҳои эвакуатор", "slug": "evakuator", "parent_id": None, "level": 0},
            {"name_ru": "Ремонт и отделка", "name_tj": "Таъмир ва пардоз", "slug": "remont-otdelka", "parent_id": None, "level": 0},
            {"name_ru": "Строительство", "name_tj": "Сохтмон", "slug": "stroitelstvo", "parent_id": None, "level": 0},
            {"name_ru": "Сад, благоустройство", "name_tj": "Боғ ва ободонӣ", "slug": "sad-blagoustroystvo", "parent_id": None, "level": 0},
            {"name_ru": "Компьютерная помощь", "name_tj": "Кумаки компютерӣ", "slug": "kompyuternaya-pomosh", "parent_id": None, "level": 0},
            {"name_ru": "Красота", "name_tj": "Зебоӣ", "slug": "krasota", "parent_id": None, "level": 0},
            {"name_ru": "Здоровье", "name_tj": "Саломатӣ", "slug": "zdorovie", "parent_id": None, "level": 0},
            {"name_ru": "Ремонт и обслуживание техники", "name_tj": "Таъмир ва хизматрасонии техника", "slug": "remont-tehniki", "parent_id": None, "level": 0},
            {"name_ru": "Оборудование, производство", "name_tj": "Таҷҳизот ва истеҳсолот", "slug": "oborudovanie-proizvodstvo", "parent_id": None, "level": 0},
            {"name_ru": "Обучение, курсы", "name_tj": "Омӯзиш ва курсҳо", "slug": "obuchenie-kursy", "parent_id": None, "level": 0},
            {"name_ru": "Деловые услуги", "name_tj": "Хизматҳои тиҷоратӣ", "slug": "delovye-uslugi", "parent_id": None, "level": 0},
            {"name_ru": "Услуги посредников", "name_tj": "Хизматҳои миёнаравон", "slug": "uslugi-posrednikov", "parent_id": None, "level": 0},
            {"name_ru": "Вывоз мусора и вторсырья", "name_tj": "Баровардани партов ва ашёи дуюм", "slug": "vyvoz-musora", "parent_id": None, "level": 0},
            {"name_ru": "Уборка", "name_tj": "Тозакунӣ", "slug": "uborka", "parent_id": None, "level": 0},
            {"name_ru": "Бытовые услуги", "name_tj": "Хизматҳои маишӣ", "slug": "bytovye-uslugi", "parent_id": None, "level": 0},
            {"name_ru": "Праздники, мероприятия", "name_tj": "Идҳо ва чорабиниҳо", "slug": "prazdniki-meropriyatiya", "parent_id": None, "level": 0},
            {"name_ru": "Доставка продуктов, десертов, кейтеринг", "name_tj": "Расонидани маҳсулот, десерт ва кейтеринг", "slug": "dostavka-produktov", "parent_id": None, "level": 0},
            {"name_ru": "Фото- и видеосъёмка", "name_tj": "Аксбардорӣ ва наворбардорӣ", "slug": "photo-video", "parent_id": None, "level": 0},
            {"name_ru": "Искусство", "name_tj": "Санъат", "slug": "iskusstvo", "parent_id": None, "level": 0},
            {"name_ru": "Другое", "name_tj": "Дигар", "slug": "drugoe", "parent_id": None, "level": 0},
        ],
    )


def downgrade() -> None:
    op.drop_table("favorites")
    op.drop_index("ix_listings_city", table_name="listings")
    op.drop_index("ix_listings_user_id", table_name="listings")
    op.drop_index("ix_listings_category_id", table_name="listings")
    op.drop_index("ix_listings_title", table_name="listings")
    op.drop_table("listings")
    op.drop_index("ix_users_phone", table_name="users")
    op.drop_table("users")
    op.drop_index("ix_categories_parent_id", table_name="categories")
    op.drop_index("ix_categories_slug", table_name="categories")
    op.drop_table("categories")

    listing_status.drop(op.get_bind(), checkfirst=True)
    user_role.drop(op.get_bind(), checkfirst=True)
