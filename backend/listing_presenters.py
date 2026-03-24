from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from models import AuctionBid, Category, Listing, ListingImage
from schemas import CategoryCrumb, ListingOut


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def order_listing_boosted_first():
    """Сортировка: сначала активно продвигаемые, затем выбранный столбец."""
    n = now_utc()
    return case((Listing.promoted_until > n, 1), else_=0)


def load_images_for_listings(db, listing_ids: list[int]) -> dict[int, list[str]]:
    if not listing_ids:
        return {}
    images = (
        db.query(ListingImage)
        .filter(ListingImage.listing_id.in_(listing_ids))
        .order_by(ListingImage.sort_order.asc(), ListingImage.created_at.asc())
        .all()
    )
    images_by_listing: dict[int, list[str]] = defaultdict(list)
    for image in images:
        images_by_listing[image.listing_id].append(image.file_url)
    return images_by_listing


def build_listing_category_meta(category: Category | None) -> tuple[list[CategoryCrumb], str | None, str | None]:
    """Цепочка категорий от корня до листа + раздел (services/realty/transport)."""
    if category is None:
        return [], None, None
    crumbs: list[CategoryCrumb] = []
    c: Category | None = category
    while c:
        crumbs.insert(0, CategoryCrumb(slug=c.slug, name_ru=c.name_ru))
        c = c.parent
    sec = category.section
    return crumbs, sec.key if sec else None, sec.name_ru if sec else None


def listing_to_out(
    listing: Listing,
    images_by_listing: dict[int, list[str]],
    *,
    section_key: str | None = None,
    section_name_ru: str | None = None,
    category_path: list[CategoryCrumb] | None = None,
    db: Session | None = None,
) -> ListingOut:
    images = images_by_listing.get(listing.id, [])
    pu = listing.promoted_until
    n = now_utc()
    is_promoted = bool(pu and pu > n)

    auction_bid_count: int | None = None
    auction_participant_count: int | None = None
    auction_starting_price_som: Decimal | None = None
    auction_current_price_som: Decimal | None = None
    if db is not None and listing.deadline_at is not None:
        from routers.auction import _auction_metrics, _starting_price

        highest, bid_count, _ = _auction_metrics(db, listing)
        start = _starting_price(listing)
        participants = (
            db.query(func.count(func.distinct(AuctionBid.user_id)))
            .filter(AuctionBid.listing_id == listing.id)
            .scalar()
        )
        if participants is None:
            participants = 0
        current: Decimal = highest if highest is not None else start
        auction_bid_count = bid_count
        auction_participant_count = int(participants)
        auction_starting_price_som = start
        auction_current_price_som = current

    return ListingOut(
        id=listing.id,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        category_id=listing.category_id,
        user_id=listing.user_id,
        city=listing.city,
        views_count=listing.views_count,
        status=listing.status,
        kind=listing.kind,
        workflow_status=listing.workflow_status,
        latitude=listing.latitude,
        longitude=listing.longitude,
        address_line=listing.address_line,
        deadline_at=listing.deadline_at,
        budget_min=listing.budget_min,
        budget_max=listing.budget_max,
        voice_url=listing.voice_url,
        voice_transcript=listing.voice_transcript,
        transcription_status=listing.transcription_status,
        assigned_executor_id=listing.assigned_executor_id,
        cover_image_url=images[0] if images else None,
        image_urls=images,
        created_at=listing.created_at,
        updated_at=listing.updated_at,
        promoted_until=pu,
        is_promoted=is_promoted,
        section_key=section_key,
        section_name_ru=section_name_ru,
        category_path=category_path if category_path is not None else [],
        auction_bid_count=auction_bid_count,
        auction_participant_count=auction_participant_count,
        auction_starting_price_som=auction_starting_price_som,
        auction_current_price_som=auction_current_price_som,
    )
