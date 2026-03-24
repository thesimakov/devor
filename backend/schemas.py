from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from models import (
    BillingLedgerKind,
    EscrowStatus,
    JobWorkflowStatus,
    ListingKind,
    ListingStatus,
    MarketplaceRole,
    TranscriptionStatus,
    UserRole,
    VerificationLevel,
)


PHONE_REGEX = r"^\+992 \d{2} \d{3} \d{2} \d{2}$"


class CategoryBase(BaseModel):
    section_id: int
    name_ru: str
    name_tj: str
    slug: str
    level: int


class SectionOut(BaseModel):
    id: int
    key: str
    name_ru: str
    name_tj: str
    slug: str

    model_config = ConfigDict(from_attributes=True)


class CategoryTree(CategoryBase):
    id: int
    parent_id: int | None = None
    children: list["CategoryTree"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserOut(BaseModel):
    id: int
    login: str
    phone: str | None = None
    name: str | None = None
    role: UserRole
    created_at: datetime
    marketplace_role: MarketplaceRole | None = None
    avatar_url: str | None = None
    rating_avg: Decimal = Field(default=Decimal("0"))
    verification_level: VerificationLevel = VerificationLevel.NONE

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    """Обновление профиля маркетплейса (роль заказчик/исполнитель, имя)."""

    name: str | None = Field(default=None, max_length=255)
    marketplace_role: MarketplaceRole | None = None


class ListingBase(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    price: Decimal | None = Field(default=None, ge=0)
    category_id: int
    city: str = Field(min_length=2, max_length=120)
    status: ListingStatus = ListingStatus.ACTIVE
    kind: ListingKind = ListingKind.OFFER
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90"), le=Decimal("90"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180"), le=Decimal("180"))
    address_line: str | None = Field(default=None, max_length=2000)
    deadline_at: datetime | None = None
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    voice_transcript: str | None = Field(default=None, max_length=8000)

    @model_validator(mode="after")
    def budget_consistency(self):
        if self.budget_max is not None and self.budget_min is not None and self.budget_max < self.budget_min:
            raise ValueError("budget_max must be >= budget_min")
        return self


class ListingCreate(ListingBase):
    pass


class ListingUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=255)
    description: str | None = Field(default=None, min_length=10)
    price: Decimal | None = Field(default=None, ge=0)
    category_id: int | None = None
    city: str | None = Field(default=None, min_length=2, max_length=120)
    status: ListingStatus | None = None
    kind: ListingKind | None = None
    workflow_status: JobWorkflowStatus | None = None
    latitude: Decimal | None = Field(default=None, ge=Decimal("-90"), le=Decimal("90"))
    longitude: Decimal | None = Field(default=None, ge=Decimal("-180"), le=Decimal("180"))
    address_line: str | None = Field(default=None, max_length=2000)
    deadline_at: datetime | None = None
    budget_min: Decimal | None = Field(default=None, ge=0)
    budget_max: Decimal | None = Field(default=None, ge=0)
    voice_transcript: str | None = Field(default=None, max_length=8000)


class CategoryCrumb(BaseModel):
    """Один уровень цепочки: главная категория → подкатегория → …"""

    slug: str
    name_ru: str


class ListingOut(BaseModel):
    id: int
    title: str
    description: str
    price: Decimal | None = None
    category_id: int
    user_id: int
    city: str
    views_count: int
    status: ListingStatus
    kind: ListingKind = ListingKind.OFFER
    workflow_status: JobWorkflowStatus = JobWorkflowStatus.ACTIVE
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    address_line: str | None = None
    deadline_at: datetime | None = None
    budget_min: Decimal | None = None
    budget_max: Decimal | None = None
    voice_url: str | None = None
    voice_transcript: str | None = None
    transcription_status: TranscriptionStatus = TranscriptionStatus.SKIPPED
    assigned_executor_id: int | None = None
    cover_image_url: str | None = None
    image_urls: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    promoted_until: datetime | None = None
    is_promoted: bool = False
    section_key: str | None = None
    section_name_ru: str | None = None
    category_path: list[CategoryCrumb] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ListingWithContact(ListingOut):
    phone: str
    seller_name: str | None = None


class AuthCodeRequest(BaseModel):
    phone: str = Field(pattern=PHONE_REGEX)


class AuthCodeVerify(BaseModel):
    phone: str = Field(pattern=PHONE_REGEX)
    code: str = Field(min_length=4, max_length=6)
    name: str | None = Field(default=None, max_length=255)


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserOut


class AuthCodeRequestResponse(BaseModel):
    message: str
    expires_in_sec: int


class AuthRegisterRequest(BaseModel):
    login: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._-]+$")
    password: str = Field(min_length=6, max_length=128)
    name: str | None = Field(default=None, max_length=255)


class AuthLoginRequest(BaseModel):
    login: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class FavoriteOut(BaseModel):
    listing_id: int


class ListingsFilter(BaseModel):
    category_id: int | None = None
    city: str | None = None
    price_from: Decimal | None = Field(default=None, ge=0)
    price_to: Decimal | None = Field(default=None, ge=0)

    @field_validator("price_to")
    @classmethod
    def validate_price_range(cls, v: Decimal | None, info):
        price_from = info.data.get("price_from")
        if v is not None and price_from is not None and v < price_from:
            raise ValueError("price_to must be greater than or equal to price_from")
        return v


class ListingsPage(BaseModel):
    items: list[ListingOut]
    total: int
    page: int
    page_size: int


class AdminListingStatusUpdate(BaseModel):
    status: ListingStatus


class AdminUserRoleUpdate(BaseModel):
    role: UserRole


class AdminSectionCreate(BaseModel):
    key: str = Field(min_length=2, max_length=50, pattern=r"^[a-z][a-z0-9_]*$")
    name_ru: str = Field(min_length=1, max_length=255)
    name_tj: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=2, max_length=255, pattern=r"^[a-z0-9][a-z0-9-]*$")


class AdminCategoryCreate(BaseModel):
    section_key: str = Field(min_length=1, max_length=50)
    name_ru: str = Field(min_length=1, max_length=255)
    name_tj: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=2, max_length=255, pattern=r"^[a-z0-9][a-z0-9-]*$")
    parent_id: int | None = None


class AdminCategoryUpdate(BaseModel):
    name_ru: str | None = Field(default=None, min_length=1, max_length=255)
    name_tj: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=2, max_length=255, pattern=r"^[a-z0-9][a-z0-9-]*$")


class CategoryAdminRow(BaseModel):
    id: int
    section_id: int
    section_key: str
    parent_id: int | None
    level: int
    name_ru: str
    name_tj: str
    slug: str


class ListingImageOut(BaseModel):
    id: int
    file_url: str
    is_primary: bool
    sort_order: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatMessageCreate(BaseModel):
    text: str = Field(min_length=1, max_length=2000)


class ChatMessageOut(BaseModel):
    id: int
    listing_id: int
    sender_id: int
    recipient_id: int
    text: str
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PromotionPackageOut(BaseModel):
    id: str
    days: int
    price_som: Decimal
    title: str
    description: str


class WalletOut(BaseModel):
    balance_som: Decimal
    demo_topup_enabled: bool


class TopUpDemoRequest(BaseModel):
    amount_som: Decimal = Field(ge=Decimal("10"), le=Decimal("10000"))


class PromoteListingRequest(BaseModel):
    package_id: str = Field(min_length=1, max_length=64)


class BillingLedgerOut(BaseModel):
    id: int
    user_id: int
    listing_id: int | None
    delta_som: Decimal
    balance_after_som: Decimal
    kind: BillingLedgerKind
    note: str
    package_id: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ChatConversationOut(BaseModel):
    listing_id: int
    listing_title: str
    participant_id: int
    participant_name: str | None = None
    participant_login: str
    last_message_text: str
    last_message_created_at: datetime
    last_message_sender_id: int
    unread_count: int = 0


class ListingResponseCreate(BaseModel):
    proposed_price: Decimal | None = Field(default=None, ge=0)
    comment: str = Field(default="", max_length=4000)


class ListingResponseOut(BaseModel):
    id: int
    listing_id: int
    executor_id: int
    proposed_price: Decimal | None = None
    comment: str
    created_at: datetime
    executor_name: str | None = None
    executor_login: str

    model_config = ConfigDict(from_attributes=True)


class AssignExecutorRequest(BaseModel):
    executor_user_id: int = Field(ge=1)


class EscrowCreateRequest(BaseModel):
    amount_som: Decimal = Field(gt=0, le=Decimal("500000"))


class EscrowOut(BaseModel):
    id: int
    listing_id: int
    customer_id: int
    executor_id: int
    amount_som: Decimal
    status: EscrowStatus
    payment_ref: str | None = None
    dispute_reason: str | None = None
    dispute_opened_at: datetime | None = None
    dispute_resolved_at: datetime | None = None
    resolution_note: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EscrowSimulatePayOut(BaseModel):
    escrow: EscrowOut
    payment_ref: str


class DisputeOpenRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=4000)


class AdminEscrowResolveRequest(BaseModel):
    decision: Literal["refund", "payout"]
    resolution_note: str | None = Field(default=None, max_length=4000)


class ReviewCreate(BaseModel):
    listing_id: int
    target_user_id: int
    stars: int = Field(ge=1, le=5)
    text_ru: str | None = Field(default=None, max_length=4000)
    text_tj: str | None = Field(default=None, max_length=4000)


class ReviewOut(BaseModel):
    id: int
    listing_id: int
    author_id: int
    target_user_id: int
    stars: int
    text_ru: str | None
    text_tj: str | None
    photo_url: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TelegramLinkStartOut(BaseModel):
    bot_username: str
    start_param: str
    deep_link: str
    expires_at: datetime


class TelegramBindComplete(BaseModel):
    token: str
    telegram_chat_id: str
    telegram_username: str | None = None


class VerificationDocumentOut(BaseModel):
    id: int
    kind: str
    file_url: str
    status: str
    admin_note: str | None
    created_at: datetime
    reviewed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class VerificationDecisionRequest(BaseModel):
    status: Literal["approved", "rejected"]
    admin_note: str | None = Field(default=None, max_length=2000)
