"""Загрузка документов для расширенной верификации исполнителя."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from dependencies import get_current_user, get_db
from models import MarketplaceRole, User, VerificationDocKind, VerificationDocument, VerificationDocStatus
from schemas import VerificationDocumentOut
from storage import save_verification_document

router = APIRouter(prefix="/verification", tags=["verification"])


@router.get("/documents", response_model=list[VerificationDocumentOut])
def my_documents(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.query(VerificationDocument).filter(VerificationDocument.user_id == user.id).all()
    return [
        VerificationDocumentOut(
            id=r.id,
            kind=r.kind.value,
            file_url=r.file_url,
            status=r.status.value,
            admin_note=r.admin_note,
            created_at=r.created_at,
            reviewed_at=r.reviewed_at,
        )
        for r in rows
    ]


@router.post("/documents", response_model=VerificationDocumentOut, status_code=status.HTTP_201_CREATED)
def upload_document(
    kind: VerificationDocKind = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.marketplace_role != MarketplaceRole.EXECUTOR:
        raise HTTPException(status_code=400, detail="Документы загружает исполнитель (укажите роль в профиле)")

    existing = (
        db.query(VerificationDocument)
        .filter(VerificationDocument.user_id == user.id, VerificationDocument.kind == kind)
        .first()
    )
    if existing and existing.status == VerificationDocStatus.APPROVED:
        raise HTTPException(status_code=400, detail="Документ уже принят")

    url = save_verification_document(file)
    if existing:
        existing.file_url = url
        existing.status = VerificationDocStatus.PENDING
        existing.admin_note = None
        existing.reviewed_at = None
        db.commit()
        db.refresh(existing)
        row = existing
    else:
        row = VerificationDocument(user_id=user.id, kind=kind, file_url=url, status=VerificationDocStatus.PENDING)
        db.add(row)
        db.commit()
        db.refresh(row)

    return VerificationDocumentOut(
        id=row.id,
        kind=row.kind.value,
        file_url=row.file_url,
        status=row.status.value,
        admin_note=row.admin_note,
        created_at=row.created_at,
        reviewed_at=row.reviewed_at,
    )
