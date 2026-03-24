from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth import (
    authenticate_user,
    create_access_token,
    get_or_create_user,
    register_user,
    request_sms_code,
    verify_sms_code,
)
from dependencies import get_current_user, get_db
from listing_presenters import listing_to_out, load_images_for_listings
from models import Favorite, Listing, User
from schemas import (
    AuthCodeRequest,
    AuthCodeRequestResponse,
    AuthCodeVerify,
    AuthLoginRequest,
    AuthRegisterRequest,
    AuthTokenResponse,
    ListingOut,
    UserOut,
    UserProfileUpdate,
)


router = APIRouter(tags=["users"])


@router.get("/users/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/users/me", response_model=UserOut)
def patch_me(
    payload: UserProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def _map_listings_with_images(db: Session, listings: list[Listing]) -> list[ListingOut]:
    listing_ids = [item.id for item in listings]
    images_by_listing = load_images_for_listings(db, listing_ids)
    return [listing_to_out(item, images_by_listing, db=db) for item in listings]


@router.post("/auth/request-code", response_model=AuthCodeRequestResponse)
def auth_request_code(payload: AuthCodeRequest):
    result = request_sms_code(payload.phone)
    return {
        "message": "Код отправлен по SMS",
        "expires_in_sec": result.expires_in_sec,
    }


@router.post("/auth/verify-code", response_model=AuthTokenResponse)
def auth_verify_code(payload: AuthCodeVerify, db: Session = Depends(get_db)):
    valid = verify_sms_code(payload.phone, payload.code)
    if not valid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Неверный код")

    user = get_or_create_user(db, payload.phone, payload.name)
    token = create_access_token(user)
    return AuthTokenResponse(access_token=token, user=user)


@router.post("/auth/register", response_model=AuthTokenResponse, status_code=status.HTTP_201_CREATED)
def auth_register(payload: AuthRegisterRequest, db: Session = Depends(get_db)):
    user = register_user(db, payload.login, payload.password, payload.name)
    token = create_access_token(user)
    return AuthTokenResponse(access_token=token, user=user)


@router.post("/auth/login", response_model=AuthTokenResponse)
def auth_login(payload: AuthLoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.login, payload.password)
    token = create_access_token(user)
    return AuthTokenResponse(access_token=token, user=user)


@router.post("/favorites/{listing_id}", status_code=status.HTTP_201_CREATED)
def add_to_favorites(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    existing = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.listing_id == listing_id)
        .first()
    )
    if existing:
        return {"message": "Уже в избранном"}

    db.add(Favorite(user_id=user.id, listing_id=listing_id))
    db.commit()
    return {"message": "Добавлено в избранное"}


@router.delete("/favorites/{listing_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_favorites(
    listing_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    favorite = (
        db.query(Favorite)
        .filter(Favorite.user_id == user.id, Favorite.listing_id == listing_id)
        .first()
    )
    if not favorite:
        return None
    db.delete(favorite)
    db.commit()
    return None


@router.get("/users/me/favorites", response_model=list[ListingOut])
def get_my_favorites(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listings = (
        db.query(Listing)
        .join(Favorite, Favorite.listing_id == Listing.id)
        .filter(Favorite.user_id == user.id)
        .order_by(Listing.created_at.desc())
        .all()
    )
    return _map_listings_with_images(db, listings)


@router.get("/users/me/listings", response_model=list[ListingOut])
def get_my_listings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listings = (
        db.query(Listing)
        .filter(Listing.user_id == user.id)
        .order_by(Listing.created_at.desc())
        .all()
    )
    return _map_listings_with_images(db, listings)
