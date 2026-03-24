from collections import defaultdict

import re

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import not_, or_
from sqlalchemy.orm import Session

from dependencies import get_db
from listing_presenters import listing_to_out, load_images_for_listings, order_listing_boosted_first
from models import Category, Listing, ListingStatus, Section
from schemas import CategoryTree, ListingsPage, ListingOut, SectionOut


router = APIRouter(prefix="/categories", tags=["categories"])


def _build_tree(categories: list[Category]) -> list[CategoryTree]:
    nodes = {
        c.id: CategoryTree(
            id=c.id,
            section_id=c.section_id,
            name_ru=c.name_ru,
            name_tj=c.name_tj,
            slug=c.slug,
            parent_id=c.parent_id,
            level=c.level,
            children=[],
        )
        for c in categories
    }

    children_map: dict[int | None, list[CategoryTree]] = defaultdict(list)
    for node in nodes.values():
        children_map[node.parent_id].append(node)

    for node in nodes.values():
        node.children = sorted(children_map.get(node.id, []), key=lambda x: x.name_ru.lower())

    return sorted(children_map.get(None, []), key=lambda x: x.name_ru.lower())


def _collect_descendants(categories: list[Category], parent_id: int) -> set[int]:
    children_by_parent: dict[int | None, list[Category]] = defaultdict(list)
    for c in categories:
        children_by_parent[c.parent_id].append(c)

    result: set[int] = {parent_id}
    stack = [parent_id]
    while stack:
        current = stack.pop()
        for child in children_by_parent.get(current, []):
            if child.id not in result:
                result.add(child.id)
                stack.append(child.id)
    return result


@router.get("/sections", response_model=list[SectionOut])
def get_sections(db: Session = Depends(get_db)):
    return db.query(Section).order_by(Section.id.asc()).all()


@router.get("", response_model=list[CategoryTree])
def get_categories(
    section: str = Query(default="services", description="Ключ раздела: services/realty/transport"),
    db: Session = Depends(get_db),
):
    section_row = db.query(Section).filter(Section.key == section).first()
    if not section_row:
        return []
    categories = (
        db.query(Category)
        .filter(Category.section_id == section_row.id)
        .order_by(Category.level.asc(), Category.name_ru.asc())
        .all()
    )
    return _build_tree(categories)


@router.get("/{slug}/listings", response_model=ListingsPage)
def get_category_listings(
    slug: str,
    section: str = Query(default="services"),
    include_subcategories: bool = Query(default=True),
    city: str | None = None,
    price_from: float | None = Query(default=None, ge=0),
    price_to: float | None = Query(default=None, ge=0),
    q: str | None = None,
    exclude_q: str | None = Query(default=None, description="Слова через пробел/запятую — скрыть объявления, где есть в заголовке или описании"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(default="created_at", pattern="^(created_at|price|views_count)$"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    section_row = db.query(Section).filter(Section.key == section).first()
    if not section_row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Раздел не найден")

    category = db.query(Category).filter(Category.slug == slug, Category.section_id == section_row.id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Категория не найдена")

    order_map = {
        "created_at": Listing.created_at,
        "price": Listing.price,
        "views_count": Listing.views_count,
    }
    order_column = order_map[sort_by]
    order_expr = order_column.asc() if sort_order == "asc" else order_column.desc()
    boost = order_listing_boosted_first()

    query = db.query(Listing).filter(Listing.status == ListingStatus.ACTIVE)
    if include_subcategories:
        all_categories = db.query(Category).filter(Category.section_id == section_row.id).all()
        ids = _collect_descendants(all_categories, category.id)
        query = query.filter(Listing.category_id.in_(ids))
    else:
        query = query.filter(Listing.category_id == category.id)

    if city:
        query = query.filter(Listing.city.ilike(city.strip()))
    if price_from is not None:
        query = query.filter(Listing.price >= price_from)
    if price_to is not None:
        query = query.filter(Listing.price <= price_to)
    if q:
        text = f"%{q.strip()}%"
        query = query.filter((Listing.title.ilike(text)) | (Listing.description.ilike(text)))

    if exclude_q and exclude_q.strip():
        for raw in re.split(r"[\s,;]+", exclude_q.strip()):
            token = raw.strip()
            if len(token) < 2:
                continue
            pat = f"%{token}%"
            query = query.filter(not_(or_(Listing.title.ilike(pat), Listing.description.ilike(pat))))

    total = query.count()
    items = query.order_by(boost.desc(), order_expr).offset((page - 1) * page_size).limit(page_size).all()
    listing_ids = [item.id for item in items]
    images_by_listing = load_images_for_listings(db, listing_ids)

    return ListingsPage(
        items=[listing_to_out(item, images_by_listing, db=db) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )
