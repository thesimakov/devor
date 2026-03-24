from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from auth import decode_access_token
from database import SessionLocal
from dependencies import get_current_user, get_db
from models import ChatMessage, Listing, User
from schemas import ChatConversationOut, ChatMessageCreate, ChatMessageOut


router = APIRouter(prefix="/chat", tags=["chat"])
ACTIVE_WS_CONNECTIONS: dict[str, set[WebSocket]] = {}


def _room_key(listing_id: int, left_user_id: int, right_user_id: int) -> str:
    lo, hi = sorted((left_user_id, right_user_id))
    return f"{listing_id}:{lo}:{hi}"


async def _broadcast_to_room(room: str, payload: dict):
    sockets = list(ACTIVE_WS_CONNECTIONS.get(room, set()))
    stale: list[WebSocket] = []
    for socket in sockets:
        try:
            await socket.send_json(payload)
        except Exception:
            stale.append(socket)
    if stale:
        current = ACTIVE_WS_CONNECTIONS.get(room, set())
        for socket in stale:
            current.discard(socket)
        if not current:
            ACTIVE_WS_CONNECTIONS.pop(room, None)


@router.get("/conversations", response_model=list[ChatConversationOut])
def get_conversations(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    messages = (
        db.query(ChatMessage)
        .filter(or_(ChatMessage.sender_id == user.id, ChatMessage.recipient_id == user.id))
        .order_by(ChatMessage.created_at.desc())
        .all()
    )
    if not messages:
        return []

    listing_ids = {msg.listing_id for msg in messages}
    participant_ids = {
        (msg.recipient_id if msg.sender_id == user.id else msg.sender_id)
        for msg in messages
    }
    listings = db.query(Listing).filter(Listing.id.in_(listing_ids)).all()
    users = db.query(User).filter(User.id.in_(participant_ids)).all()
    listing_by_id = {item.id: item for item in listings}
    user_by_id = {item.id: item for item in users}
    unread_by_key: dict[tuple[int, int], int] = {}
    for msg in messages:
        if msg.recipient_id == user.id and not msg.is_read:
            unread_key = (msg.listing_id, msg.sender_id)
            unread_by_key[unread_key] = unread_by_key.get(unread_key, 0) + 1

    seen: set[tuple[int, int]] = set()
    result: list[ChatConversationOut] = []
    for msg in messages:
        peer_id = msg.recipient_id if msg.sender_id == user.id else msg.sender_id
        key = (msg.listing_id, peer_id)
        if key in seen:
            continue
        seen.add(key)
        listing = listing_by_id.get(msg.listing_id)
        peer = user_by_id.get(peer_id)
        if not listing or not peer:
            continue
        result.append(
            ChatConversationOut(
                listing_id=listing.id,
                listing_title=listing.title,
                participant_id=peer.id,
                participant_name=peer.name,
                participant_login=peer.login,
                last_message_text=msg.text,
                last_message_created_at=msg.created_at,
                last_message_sender_id=msg.sender_id,
                unread_count=unread_by_key.get(key, 0),
            )
        )
    return result


@router.get("/unread-count")
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = (
        db.query(ChatMessage)
        .filter(ChatMessage.recipient_id == user.id, ChatMessage.is_read.is_(False))
        .count()
    )
    return {"unread_count": count}


def _resolve_participant(
    db: Session,
    listing_id: int,
    current_user: User,
    participant_id: int | None,
) -> tuple[Listing, int]:
    listing = db.query(Listing).filter(Listing.id == listing_id).first()
    if not listing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Объявление не найдено")

    if current_user.id == listing.user_id:
        if participant_id is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Для владельца объявления нужно указать participant_id",
            )
        if participant_id == current_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Нельзя писать самому себе")
        participant_exists = db.query(User.id).filter(User.id == participant_id).first()
        if not participant_exists:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Собеседник не найден")
        return listing, participant_id

    return listing, listing.user_id


@router.get("/listings/{listing_id}/messages", response_model=list[ChatMessageOut])
def get_chat_messages(
    listing_id: int,
    participant_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, peer_id = _resolve_participant(db, listing_id, user, participant_id)
    unread_for_current_user = (
        db.query(ChatMessage)
        .filter(ChatMessage.listing_id == listing_id)
        .filter(ChatMessage.sender_id == peer_id, ChatMessage.recipient_id == user.id, ChatMessage.is_read.is_(False))
        .all()
    )
    if unread_for_current_user:
        for msg in unread_for_current_user:
            msg.is_read = True
        db.commit()

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.listing_id == listing_id)
        .filter(
            or_(
                ((ChatMessage.sender_id == user.id) & (ChatMessage.recipient_id == peer_id)),
                ((ChatMessage.sender_id == peer_id) & (ChatMessage.recipient_id == user.id)),
            )
        )
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return messages


@router.post("/listings/{listing_id}/messages", response_model=ChatMessageOut, status_code=status.HTTP_201_CREATED)
def send_chat_message(
    listing_id: int,
    payload: ChatMessageCreate,
    participant_id: int | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _, peer_id = _resolve_participant(db, listing_id, user, participant_id)
    message = ChatMessage(
        listing_id=listing_id,
        sender_id=user.id,
        recipient_id=peer_id,
        text=payload.text.strip(),
        is_read=False,
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.websocket("/ws/listings/{listing_id}")
async def chat_messages_ws(
    websocket: WebSocket,
    listing_id: int,
):
    token = websocket.query_params.get("token")
    participant_raw = websocket.query_params.get("participant_id")
    participant_id = int(participant_raw) if participant_raw and participant_raw.isdigit() else None
    if not token:
        await websocket.close(code=1008, reason="Требуется токен")
        return

    try:
        payload = decode_access_token(token)
        user_id = int(payload.get("sub", "0"))
    except Exception:
        await websocket.close(code=1008, reason="Неверный токен")
        return

    with SessionLocal() as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            await websocket.close(code=1008, reason="Пользователь не найден")
            return
        try:
            _, peer_id = _resolve_participant(db, listing_id, user, participant_id)
        except HTTPException as exc:
            await websocket.close(code=1008, reason=str(exc.detail))
            return

        unread_for_current_user = (
            db.query(ChatMessage)
            .filter(ChatMessage.listing_id == listing_id)
            .filter(ChatMessage.sender_id == peer_id, ChatMessage.recipient_id == user.id, ChatMessage.is_read.is_(False))
            .all()
        )
        if unread_for_current_user:
            read_ids = [msg.id for msg in unread_for_current_user]
            for msg in unread_for_current_user:
                msg.is_read = True
            db.commit()
        else:
            read_ids = []

        history = (
            db.query(ChatMessage)
            .filter(ChatMessage.listing_id == listing_id)
            .filter(
                or_(
                    ((ChatMessage.sender_id == user.id) & (ChatMessage.recipient_id == peer_id)),
                    ((ChatMessage.sender_id == peer_id) & (ChatMessage.recipient_id == user.id)),
                )
            )
            .order_by(ChatMessage.created_at.asc())
            .all()
        )
        history_payload = [ChatMessageOut.model_validate(item).model_dump(mode="json") for item in history]

    await websocket.accept()
    room = _room_key(listing_id, user_id, peer_id)
    ACTIVE_WS_CONNECTIONS.setdefault(room, set()).add(websocket)
    await websocket.send_json({"type": "history", "items": history_payload})
    if read_ids:
        await _broadcast_to_room(room, {"type": "read", "message_ids": read_ids, "reader_id": user_id})

    try:
        while True:
            incoming = await websocket.receive_json()
            event_type = incoming.get("type")
            if event_type == "typing":
                is_typing = bool(incoming.get("is_typing", False))
                await _broadcast_to_room(
                    room,
                    {
                        "type": "typing",
                        "user_id": user_id,
                        "is_typing": is_typing,
                    },
                )
                continue

            if event_type == "read":
                message_ids = incoming.get("message_ids") or []
                normalized_ids = [int(item) for item in message_ids if str(item).isdigit()]
                if not normalized_ids:
                    continue
                with SessionLocal() as db:
                    to_mark = (
                        db.query(ChatMessage)
                        .filter(ChatMessage.id.in_(normalized_ids))
                        .filter(ChatMessage.recipient_id == user_id, ChatMessage.is_read.is_(False))
                        .all()
                    )
                    changed_ids = [item.id for item in to_mark]
                    if changed_ids:
                        for item in to_mark:
                            item.is_read = True
                        db.commit()
                    else:
                        changed_ids = []
                if changed_ids:
                    await _broadcast_to_room(room, {"type": "read", "message_ids": changed_ids, "reader_id": user_id})
                continue

            if event_type != "send":
                continue

            text = str(incoming.get("text", "")).strip()
            if not text:
                continue
            with SessionLocal() as db:
                sender = db.query(User).filter(User.id == user_id).first()
                if not sender:
                    break
                try:
                    _, resolved_peer_id = _resolve_participant(db, listing_id, sender, participant_id)
                except HTTPException:
                    break
                message = ChatMessage(
                    listing_id=listing_id,
                    sender_id=user_id,
                    recipient_id=resolved_peer_id,
                    text=text,
                    is_read=False,
                )
                db.add(message)
                db.commit()
                db.refresh(message)
                serialized = ChatMessageOut.model_validate(message).model_dump(mode="json")
            await _broadcast_to_room(room, {"type": "message", "item": serialized})
    except WebSocketDisconnect:
        pass
    finally:
        sockets = ACTIVE_WS_CONNECTIONS.get(room, set())
        sockets.discard(websocket)
        if not sockets:
            ACTIVE_WS_CONNECTIONS.pop(room, None)
