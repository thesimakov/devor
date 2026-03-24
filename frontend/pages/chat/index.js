import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../../components/AppHeader";
import AuthPhoneForm from "../../components/AuthPhoneForm";
import { apiFetch } from "../../lib/api";
import { getStoredUser } from "../../lib/auth";

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

export default function ChatInboxPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const me = getStoredUser();

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const payload = await apiFetch("/chat/conversations");
      setItems(payload);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadConversations();
  }, [authed, loadConversations]);

  useEffect(() => {
    if (!authed) return undefined;
    const timer = setInterval(() => {
      loadConversations();
    }, 8000);
    return () => clearInterval(timer);
  }, [authed, loadConversations]);

  const visibleItems = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      item.listing_title.toLowerCase().includes(q) ||
      item.participant_login.toLowerCase().includes(q) ||
      (item.participant_name || "").toLowerCase().includes(q) ||
      item.last_message_text.toLowerCase().includes(q)
    );
  });

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader />
        <main className="chat-page">
          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />
          <section className="chat-media-banner">
            <img
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&q=80"
              alt="Люди общаются"
            />
            <div className="chat-media-banner-overlay">
              <h3>Быстрые ответы и живое общение</h3>
              <p>Договаривайтесь с исполнителями напрямую и безопасно.</p>
            </div>
          </section>
          {authed ? (
            <section className="chat-card">
              <div className="chat-head">
                <div>
                  <h1>Сообщения</h1>
                  <p>Ваши диалоги по объявлениям.</p>
                </div>
                <button className="ghost" type="button" onClick={loadConversations} disabled={loading}>
                  Обновить
                </button>
              </div>
              <input
                className="search modern-search chat-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по объявлениям, логину или сообщению"
              />

              {loading ? (
                <div className="conversation-list">
                  {Array.from({ length: 6 }, (_, idx) => (
                    <div className="conversation-card" key={`conv-sk-${idx}`}>
                      <div className="skeleton skeleton-line short" />
                      <div className="skeleton skeleton-line tiny" />
                      <div className="skeleton skeleton-line" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="conversation-list">
                  {visibleItems.map((item) => {
                    const mine = me && item.last_message_sender_id === me.id;
                    return (
                      <Link
                        href={`/chat/${item.listing_id}?participant=${item.participant_id}`}
                        key={`${item.listing_id}-${item.participant_id}`}
                        className="conversation-card"
                      >
                        <div className="conversation-top">
                          <div className="conversation-title">{item.listing_title}</div>
                          {item.unread_count > 0 ? <span className="unread-badge">{item.unread_count}</span> : null}
                        </div>
                        <div className="conversation-meta">
                          @{item.participant_login}
                          {item.participant_name ? ` (${item.participant_name})` : ""}
                        </div>
                        <div className="conversation-last">
                          <span>{mine ? "Вы: " : ""}{item.last_message_text}</span>
                          <small>{formatTime(item.last_message_created_at)}</small>
                        </div>
                      </Link>
                    );
                  })}
                  {!visibleItems.length ? <p className="empty-tip">Диалогов по этому запросу не найдено.</p> : null}
                </div>
              )}
              {message ? <p className="auth-message">{message}</p> : null}
            </section>
          ) : (
            <p>Войдите, чтобы увидеть сообщения.</p>
          )}
        </main>
      </div>
    </div>
  );
}
