from datetime import datetime
from decimal import Decimal
from enum import Enum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class UserRole(str, Enum):
    USER = "user"
    MANAGER = "manager"
    ADMIN = "admin"


class ListingStatus(str, Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"
    MODERATED = "moderated"


class BillingLedgerKind(str, Enum):
    TOPUP_DEMO = "topup_demo"
    PROMOTION = "promotion"
    ESCROW_HOLD = "escrow_hold"
    ESCROW_RELEASE = "escrow_release"
    ESCROW_REFUND = "escrow_refund"


class EscrowStatus(str, Enum):
    AWAITING_PAYMENT = "awaiting_payment"
    FUNDED = "funded"
    RELEASED = "released"
    DISPUTED = "disputed"
    REFUNDED = "refunded"


class TranscriptionStatus(str, Enum):
    """Фоновая расшифровка голоса по заявке."""

    PENDING = "pending"
    PROCESSING = "processing"
    DONE = "done"
    FAILED = "failed"
    SKIPPED = "skipped"


class VerificationDocKind(str, Enum):
    PASSPORT = "passport"
    SELFIE = "selfie"


class VerificationDocStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class MarketplaceRole(str, Enum):
    """Роль в маркетплейсе услуг (отдельно от staff user/manager/admin)."""

    CUSTOMER = "customer"
    EXECUTOR = "executor"


class VerificationLevel(str, Enum):
    NONE = "none"
    PHONE = "phone"
    EXTENDED = "extended"


class ListingKind(str, Enum):
    """Предложение исполнителя или заявка заказчика."""

    OFFER = "offer"
    REQUEST = "request"


class JobWorkflowStatus(str, Enum):
    """Жизненный цикл заявки: активна → в работе → завершена / отменена."""

    ACTIVE = "active"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class Section(Base):
    __tablename__ = "sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    key: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_tj: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    categories: Mapped[list["Category"]] = relationship("Category", back_populates="section")


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("section_id", "slug", name="uq_categories_section_slug"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name_ru: Mapped[str] = mapped_column(String(255), nullable=False)
    name_tj: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    section_id: Mapped[int] = mapped_column(ForeignKey("sections.id", ondelete="RESTRICT"), nullable=False, index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    parent: Mapped["Category | None"] = relationship(
        "Category",
        remote_side=[id],
        back_populates="children",
    )
    children: Mapped[list["Category"]] = relationship(
        "Category",
        back_populates="parent",
        cascade="all, delete-orphan",
    )
    section: Mapped["Section"] = relationship("Section", back_populates="categories")
    listings: Mapped[list["Listing"]] = relationship("Listing", back_populates="category")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    login: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), default=UserRole.USER, nullable=False)
    balance_som: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    marketplace_role: Mapped[MarketplaceRole | None] = mapped_column(
        SAEnum(MarketplaceRole, name="marketplace_role"),
        nullable=True,
    )
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    rating_avg: Mapped[Decimal] = mapped_column(Numeric(3, 2), nullable=False, default=Decimal("0"))
    telegram_chat_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    telegram_username: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_level: Mapped[VerificationLevel] = mapped_column(
        SAEnum(VerificationLevel, name="verification_level"),
        nullable=False,
        default=VerificationLevel.NONE,
    )

    listings: Mapped[list["Listing"]] = relationship("Listing", back_populates="user", foreign_keys="Listing.user_id")
    billing_entries: Mapped[list["BillingLedger"]] = relationship(
        "BillingLedger",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    favorites: Mapped[list["Favorite"]] = relationship("Favorite", back_populates="user", cascade="all, delete-orphan")
    sent_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        foreign_keys="ChatMessage.sender_id",
        back_populates="sender",
        cascade="all, delete-orphan",
    )
    received_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        foreign_keys="ChatMessage.recipient_id",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )
    assigned_as_executor: Mapped[list["Listing"]] = relationship(
        "Listing",
        foreign_keys="Listing.assigned_executor_id",
        back_populates="assigned_executor_user",
    )
    listing_responses: Mapped[list["ListingResponse"]] = relationship(
        "ListingResponse",
        back_populates="executor",
        cascade="all, delete-orphan",
    )
    escrow_as_customer: Mapped[list["EscrowTransaction"]] = relationship(
        "EscrowTransaction",
        foreign_keys="EscrowTransaction.customer_id",
        back_populates="customer",
    )
    escrow_as_executor: Mapped[list["EscrowTransaction"]] = relationship(
        "EscrowTransaction",
        foreign_keys="EscrowTransaction.executor_id",
        back_populates="executor",
    )
    reviews_written: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.author_id",
        back_populates="author",
        cascade="all, delete-orphan",
    )
    reviews_about_me: Mapped[list["Review"]] = relationship(
        "Review",
        foreign_keys="Review.target_user_id",
        back_populates="target",
    )
    escrow_resolutions: Mapped[list["EscrowTransaction"]] = relationship(
        "EscrowTransaction",
        foreign_keys="EscrowTransaction.resolved_by_id",
        back_populates="resolver",
    )
    verification_documents: Mapped[list["VerificationDocument"]] = relationship(
        "VerificationDocument",
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    city: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    views_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[ListingStatus] = mapped_column(
        SAEnum(ListingStatus, name="listing_status"),
        nullable=False,
        default=ListingStatus.ACTIVE,
    )
    promoted_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    kind: Mapped[ListingKind] = mapped_column(
        SAEnum(ListingKind, name="listing_kind"),
        nullable=False,
        default=ListingKind.OFFER,
        index=True,
    )
    workflow_status: Mapped[JobWorkflowStatus] = mapped_column(
        SAEnum(JobWorkflowStatus, name="job_workflow_status"),
        nullable=False,
        default=JobWorkflowStatus.ACTIVE,
        index=True,
    )
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True, index=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True, index=True)
    address_line: Mapped[str | None] = mapped_column(Text, nullable=True)
    deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    budget_min: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    budget_max: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    voice_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    voice_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    transcription_status: Mapped[TranscriptionStatus] = mapped_column(
        SAEnum(TranscriptionStatus, name="transcription_status"),
        nullable=False,
        default=TranscriptionStatus.SKIPPED,
        index=True,
    )
    assigned_executor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    category: Mapped["Category"] = relationship("Category", back_populates="listings")
    user: Mapped["User"] = relationship("User", back_populates="listings", foreign_keys=[user_id])
    assigned_executor_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[assigned_executor_id],
        back_populates="assigned_as_executor",
    )
    favorites: Mapped[list["Favorite"]] = relationship(
        "Favorite",
        back_populates="listing",
        cascade="all, delete-orphan",
    )
    images: Mapped[list["ListingImage"]] = relationship(
        "ListingImage",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingImage.sort_order.asc()",
    )
    chat_messages: Mapped[list["ChatMessage"]] = relationship(
        "ChatMessage",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
    )
    billing_entries: Mapped[list["BillingLedger"]] = relationship("BillingLedger", back_populates="listing")
    responses: Mapped[list["ListingResponse"]] = relationship(
        "ListingResponse",
        back_populates="listing",
        cascade="all, delete-orphan",
        order_by="ListingResponse.created_at.asc()",
    )
    escrow_transaction: Mapped["EscrowTransaction | None"] = relationship(
        "EscrowTransaction",
        back_populates="listing",
        uselist=False,
    )
    reviews: Mapped[list["Review"]] = relationship(
        "Review",
        back_populates="listing",
        cascade="all, delete-orphan",
    )


class ListingResponse(Base):
    """Отклик исполнителя на заявку (цена, комментарий)."""

    __tablename__ = "listing_responses"
    __table_args__ = (UniqueConstraint("listing_id", "executor_id", name="uq_listing_response_executor"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    executor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    proposed_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    listing: Mapped["Listing"] = relationship("Listing", back_populates="responses")
    executor: Mapped["User"] = relationship("User", back_populates="listing_responses")


class ListingImage(Base):
    __tablename__ = "listing_images"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    listing: Mapped["Listing"] = relationship("Listing", back_populates="images")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    listing: Mapped["Listing"] = relationship("Listing", back_populates="chat_messages")
    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    recipient: Mapped["User"] = relationship("User", foreign_keys=[recipient_id], back_populates="received_messages")


class Favorite(Base):
    __tablename__ = "favorites"
    __table_args__ = (UniqueConstraint("user_id", "listing_id", name="uq_favorites_user_listing"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), primary_key=True)

    user: Mapped["User"] = relationship("User", back_populates="favorites")
    listing: Mapped["Listing"] = relationship("Listing", back_populates="favorites")


class BillingLedger(Base):
    __tablename__ = "billing_ledger"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    listing_id: Mapped[int | None] = mapped_column(ForeignKey("listings.id", ondelete="SET NULL"), nullable=True, index=True)
    delta_som: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    balance_after_som: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    kind: Mapped[BillingLedgerKind] = mapped_column(SAEnum(BillingLedgerKind, name="billing_ledger_kind"), nullable=False)
    note: Mapped[str] = mapped_column(String(500), nullable=False, default="")
    package_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    user: Mapped["User"] = relationship("User", back_populates="billing_entries")
    listing: Mapped["Listing | None"] = relationship("Listing", back_populates="billing_entries")


class EscrowTransaction(Base):
    """Эскроу по сделке (одна запись на заявку в MVP)."""

    __tablename__ = "escrow_transactions"
    __table_args__ = (UniqueConstraint("listing_id", name="uq_escrow_one_per_listing"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    executor_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    amount_som: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[EscrowStatus] = mapped_column(SAEnum(EscrowStatus, name="escrow_status"), nullable=False, index=True)
    payment_ref: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    dispute_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispute_opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dispute_resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    listing: Mapped["Listing"] = relationship("Listing", back_populates="escrow_transaction")
    customer: Mapped["User"] = relationship("User", foreign_keys=[customer_id], back_populates="escrow_as_customer")
    executor: Mapped["User"] = relationship("User", foreign_keys=[executor_id], back_populates="escrow_as_executor")
    resolver: Mapped["User | None"] = relationship("User", foreign_keys=[resolved_by_id], back_populates="escrow_resolutions")


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (UniqueConstraint("listing_id", "author_id", name="uq_review_listing_author"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    stars: Mapped[int] = mapped_column(Integer, nullable=False)
    text_ru: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_tj: Mapped[str | None] = mapped_column(Text, nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    listing: Mapped["Listing"] = relationship("Listing", back_populates="reviews")
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id], back_populates="reviews_written")
    target: Mapped["User"] = relationship("User", foreign_keys=[target_user_id], back_populates="reviews_about_me")


class TelegramLinkToken(Base):
    """Одноразовый токен для привязки Telegram (/start <token>)."""

    __tablename__ = "telegram_link_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User")


class VerificationDocument(Base):
    __tablename__ = "verification_documents"
    __table_args__ = (UniqueConstraint("user_id", "kind", name="uq_verification_user_kind"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[VerificationDocKind] = mapped_column(SAEnum(VerificationDocKind, name="verification_doc_kind"), nullable=False)
    file_url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[VerificationDocStatus] = mapped_column(
        SAEnum(VerificationDocStatus, name="verification_doc_status"),
        nullable=False,
        default=VerificationDocStatus.PENDING,
        index=True,
    )
    admin_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="verification_documents")
