import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AppHeader from "../../components/AppHeader";
import AuthPhoneForm from "../../components/AuthPhoneForm";
import { apiFetch, getWsApiUrl } from "../../lib/api";
import { getStoredToken, getStoredUser } from "../../lib/auth";

function formatTime(value) {
  try {
    return new Date(value).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ChatByListingPage() {
  const router = useRouter();
  const { listingId, participant } = router.query;
  const [authed, setAuthed] = useState(false);
  const [listing, setListing] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollRef = useRef(null);
  const wsRef = useRef(null);
  const typingTimerRef = useRef(null);
  const typingActiveRef = useRef(false);
  const me = getStoredUser();
  const participantId = useMemo(() => (participant ? Number(participant) : null), [participant]);
  const queryTail = participantId ? `?participant_id=${participantId}` : "";

  const loadMessages = useCallback(
    async (silent = false) => {
      if (!listingId) return [];
      if (!silent) setLoading(true);
      try {
        const messagesPayload = await apiFetch(`/chat/listings/${listingId}/messages${queryTail}`);
        setMessages(messagesPayload);
        return messagesPayload;
      } catch (loadError) {
        setError(loadError.message);
        return [];
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [listingId, queryTail]
  );

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!authed || !router.isReady || !listingId) return;

    let cancelled = false;
    async function loadChat() {
      setLoading(true);
      setError("");
      try {
        const [listingPayload] = await Promise.all([apiFetch(`/listings/${listingId}`), loadMessages(true)]);
        if (cancelled) return;
        setListing(listingPayload);
      } catch (loadError) {
        if (!cancelled) setError(loadError.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadChat();
    return () => {
      cancelled = true;
    };
  }, [authed, listingId, loadMessages, router.isReady]);

  useEffect(() => {
    if (!authed || !router.isReady || !listingId || wsConnected) return undefined;
    const timer = setInterval(() => {
      loadMessages(true);
    }, 5000);
    return () => clearInterval(timer);
  }, [authed, listingId, loadMessages, router.isReady, wsConnected]);

  useEffect(() => {
    if (!authed || !router.isReady || !listingId || !participantId) return undefined;
    const token = getStoredToken();
    if (!token) return undefined;
    const wsUrl = `${getWsApiUrl()}/chat/ws/listings/${listingId}?participant_id=${participantId}&token=${encodeURIComponent(token)}`;
    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      setWsConnected(true);
      setError("");
    };
    socket.onclose = () => {
      setWsConnected(false);
      if (wsRef.current === socket) wsRef.current = null;
    };
    socket.onerror = () => {
      setWsConnected(false);
    };
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "history" && Array.isArray(payload.items)) {
          setMessages(payload.items);
          return;
        }
        if (payload.type === "message" && payload.item) {
          setMessages((prev) => {
            const exists = prev.some((item) => item.id === payload.item.id);
            return exists ? prev : [...prev, payload.item];
          });
          if (me && payload.item.recipient_id === me.id && wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "read", message_ids: [payload.item.id] }));
          }
          return;
        }
        if (payload.type === "read" && Array.isArray(payload.message_ids)) {
          const idSet = new Set(payload.message_ids);
          setMessages((prev) => prev.map((item) => (idSet.has(item.id) ? { ...item, is_read: true } : item)));
          return;
        }
        if (payload.type === "typing" && me && payload.user_id !== me.id) {
          setPeerTyping(Boolean(payload.is_typing));
        }
      } catch {
        // noop
      }
    };

    return () => {
      socket.close();
    };
  }, [authed, listingId, participantId, router.isReady]);

  async function sendMessage() {
    if (!text.trim() || !listingId) return;
    setSending(true);
    setError("");
    try {
      const outgoing = text.trim();
      if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN && typingActiveRef.current) {
        wsRef.current.send(JSON.stringify({ type: "typing", is_typing: false }));
        typingActiveRef.current = false;
      }
      if (wsConnected && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "send", text: outgoing }));
      } else {
        const payload = await apiFetch(`/chat/listings/${listingId}/messages${queryTail}`, {
          method: "POST",
          body: JSON.stringify({ text: outgoing }),
        });
        setMessages((prev) => [...prev, payload]);
      }
      setText("");
      loadMessages(true);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  function onTypingChange(nextValue) {
    setText(nextValue);
    if (!wsConnected || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!typingActiveRef.current) {
      wsRef.current.send(JSON.stringify({ type: "typing", is_typing: true }));
      typingActiveRef.current = true;
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN && typingActiveRef.current) {
        wsRef.current.send(JSON.stringify({ type: "typing", is_typing: false }));
      }
      typingActiveRef.current = false;
    }, 1200);
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader />
        <main className="chat-page">
          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />
          {authed ? (
            <section className="chat-card">
              <div className="chat-head">
                <div>
                  <h1>Чат по объявлению</h1>
                  <p className="chat-live-state">
                    {wsConnected ? "Онлайн-чат подключен" : "Режим обновления: каждые 5 сек"}
                  </p>
                  {listing ? (
                    <p>
                      <Link href={`/listings/${listing.id}`}>{listing.title}</Link>
                    </p>
                  ) : null}
                </div>
                {listing ? (
                  <div className="chat-head-actions">
                    <a className="ghost" href={`tel:${(listing.phone || "").replace(/\s/g, "")}`}>
                      Позвонить
                    </a>
                    <Link href={`/listings/${listing.id}`} className="ghost">
                      К объявлению
                    </Link>
                  </div>
                ) : null}
              </div>

              {loading ? (
                <div className="chat-messages">
                  {Array.from({ length: 5 }, (_, idx) => (
                    <div className="chat-row" key={`chat-sk-${idx}`}>
                      <div className="skeleton chat-bubble-skeleton" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="chat-messages" ref={scrollRef}>
                  {messages.map((item) => {
                    const mine = me && item.sender_id === me.id;
                    return (
                      <div className={`chat-row ${mine ? "mine" : ""}`} key={item.id}>
                        <div className={`chat-bubble ${mine ? "mine" : ""}`}>
                          <div>{item.text}</div>
                          <small>
                            {formatTime(item.created_at)}
                            {mine ? <span className={`message-state ${item.is_read ? "read" : ""}`}>{item.is_read ? "Прочитано" : "Доставлено"}</span> : null}
                          </small>
                        </div>
                      </div>
                    );
                  })}
                  {peerTyping ? (
                    <div className="chat-row">
                      <div className="typing-indicator">Собеседник печатает...</div>
                    </div>
                  ) : null}
                  {!messages.length ? (
                    <div className="chat-empty-block">
                      <img
                        src="https://www.svgrepo.com/show/530350/chat.svg"
                        alt="Иллюстрация чата"
                        className="chat-empty-illustration"
                      />
                      <p className="empty-tip">Сообщений пока нет. Начните диалог первым.</p>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="chat-compose">
                <textarea
                  value={text}
                  onChange={(e) => onTypingChange(e.target.value)}
                  onBlur={() => {
                    if (wsConnected && wsRef.current?.readyState === WebSocket.OPEN && typingActiveRef.current) {
                      wsRef.current.send(JSON.stringify({ type: "typing", is_typing: false }));
                    }
                    typingActiveRef.current = false;
                  }}
                  placeholder="Напишите сообщение..."
                  rows={3}
                />
                <button className="primary" type="button" onClick={sendMessage} disabled={sending || !text.trim()}>
                  {sending ? "Отправка..." : "Отправить"}
                </button>
              </div>

              {error ? <p className="auth-message">{error}</p> : null}
            </section>
          ) : (
            <p>Войдите, чтобы открыть чат.</p>
          )}
        </main>
      </div>
    </div>
  );
}
