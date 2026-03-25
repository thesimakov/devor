import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppHeader from "../components/AppHeader";
import AuthPhoneForm from "../components/AuthPhoneForm";
import PageIntroBanner from "../components/PageIntroBanner";
import SceneIllustration from "../components/SceneIllustration";
import { apiFetch } from "../lib/api";
import { clearAuthData, getStoredUser } from "../lib/auth";
import { CONTENT_IMAGES } from "../lib/contentAssets";
import { useLanguage } from "../contexts/LanguageContext";

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

export default function ProfilePage() {
  const { t } = useLanguage();
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [myListings, setMyListings] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const user = getStoredUser();

  const loadProfileData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [listingsPayload, favoritesPayload, conversationsPayload, unreadPayload] = await Promise.all([
        apiFetch("/users/me/listings"),
        apiFetch("/users/me/favorites"),
        apiFetch("/chat/conversations"),
        apiFetch("/chat/unread-count"),
      ]);
      setMyListings(listingsPayload || []);
      setFavorites(favoritesPayload || []);
      setConversations(conversationsPayload || []);
      setUnreadCount(unreadPayload?.unread_count || 0);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) loadProfileData();
  }, [authed, loadProfileData]);

  const firstLetter = useMemo(() => {
    const source = (user?.name || user?.login || "U").trim();
    return source[0]?.toUpperCase() || "U";
  }, [user?.login, user?.name]);

  const recentListings = myListings.slice(0, 3);
  const recentFavorites = favorites.slice(0, 3);
  const recentConversations = conversations.slice(0, 3);

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader />

        <main className="profile-page">
          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />
          {authed ? (
            <>
              <section className="profile-hero">
                <div className="profile-hero-main">
                  <div className="profile-user">
                    <div className="profile-avatar">{firstLetter}</div>
                    <div>
                      <h1>{user?.name || "Профиль"}</h1>
                      <p>@{user?.login || "user"} · {user?.phone || "Телефон не указан"}</p>
                    </div>
                  </div>
                  <div className="profile-actions">
                    <button className="ghost" type="button" onClick={loadProfileData} disabled={loading}>
                      Обновить
                    </button>
                    <button
                      className="ghost danger"
                      type="button"
                      onClick={() => {
                        clearAuthData();
                        setAuthed(false);
                      }}
                    >
                      Выйти
                    </button>
                  </div>
                </div>
                <div className="profile-hero-visual" aria-hidden="true">
                  <img src={CONTENT_IMAGES.profile} alt="" className="profile-hero-img" width={400} height={250} loading="lazy" />
                </div>
              </section>

              <section className="profile-tabs">
                <Link href="/my-listings" className="profile-tab-chip">
                  Мои объявления
                </Link>
                <Link href="/favorites" className="profile-tab-chip">
                  Избранное
                </Link>
                <Link href="/chat" className="profile-tab-chip">
                  Сообщения
                  {unreadCount > 0 ? <span className="profile-chip-badge">{unreadCount}</span> : null}
                </Link>
                <Link href="/create-listing" className="profile-tab-chip strong">
                  + Добавить объявление
                </Link>
                <Link href="/wallet" className="profile-tab-chip">
                  Кошелёк и продвижение
                </Link>
              </section>

              <section className="profile-grid">
                <article className="profile-card">
                  <h3>Общая статистика</h3>
                  <div className="profile-stats">
                    <div className="profile-stat-item">
                      <strong>{myListings.length}</strong>
                      <span>объявлений</span>
                    </div>
                    <div className="profile-stat-item">
                      <strong>{favorites.length}</strong>
                      <span>в избранном</span>
                    </div>
                    <div className="profile-stat-item">
                      <strong>{conversations.length}</strong>
                      <span>диалогов</span>
                    </div>
                    <div className="profile-stat-item">
                      <strong>{unreadCount}</strong>
                      <span>непрочитанных</span>
                    </div>
                  </div>
                </article>

                <article className="profile-card profile-illustration-card">
                  <SceneIllustration compact />
                  <p>Управляйте объявлениями, следите за сообщениями и отвечайте клиентам быстрее.</p>
                </article>
              </section>

              <section className="profile-grid">
                <article className="profile-card">
                  <div className="profile-card-head">
                    <h3>Последние объявления</h3>
                    <Link href="/my-listings">Смотреть все</Link>
                  </div>
                  {loading ? (
                    <div className="profile-skeleton-stack">
                      <div className="skeleton skeleton-line short" />
                      <div className="skeleton skeleton-line tiny" />
                      <div className="skeleton skeleton-line" />
                    </div>
                  ) : recentListings.length ? (
                    <div className="profile-list">
                      {recentListings.map((item) => (
                        <Link key={item.id} href={`/listings/${item.id}`} className="profile-list-row">
                          <div className="profile-list-title">{item.title}</div>
                          <small>{item.city}</small>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-tip">Пока нет объявлений.</p>
                  )}
                </article>

                <article className="profile-card">
                  <div className="profile-card-head">
                    <h3>Последние избранные</h3>
                    <Link href="/favorites">Смотреть все</Link>
                  </div>
                  {loading ? (
                    <div className="profile-skeleton-stack">
                      <div className="skeleton skeleton-line short" />
                      <div className="skeleton skeleton-line tiny" />
                      <div className="skeleton skeleton-line" />
                    </div>
                  ) : recentFavorites.length ? (
                    <div className="profile-list">
                      {recentFavorites.map((item) => (
                        <Link key={item.id} href={`/listings/${item.id}`} className="profile-list-row">
                          <div className="profile-list-title">{item.title}</div>
                          <small>{item.city}</small>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-tip">Избранное пока пусто.</p>
                  )}
                </article>
              </section>

              <section className="profile-card">
                <div className="profile-card-head">
                  <h3>Последние диалоги</h3>
                  <Link href="/chat">Открыть сообщения</Link>
                </div>
                {loading ? (
                  <div className="profile-skeleton-stack">
                    <div className="skeleton skeleton-line short" />
                    <div className="skeleton skeleton-line tiny" />
                    <div className="skeleton skeleton-line" />
                  </div>
                ) : recentConversations.length ? (
                  <div className="profile-list">
                    {recentConversations.map((item) => (
                      <Link
                        key={`${item.listing_id}-${item.participant_id}`}
                        href={`/chat/${item.listing_id}?participant=${item.participant_id}`}
                        className="profile-list-row"
                      >
                        <div className="profile-list-title">{item.listing_title}</div>
                        <small>{formatTime(item.last_message_created_at)}</small>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="empty-tip">Диалогов пока нет.</p>
                )}
              </section>
            </>
          ) : (
            <div className="favorites-guest">
              <PageIntroBanner
                title={t("header.profileTitle")}
                subtitle={t("account.profileGuestSubtitle")}
                imageUrl={CONTENT_IMAGES.profile}
                imageAlt=""
              />
              <p className="favorites-guest-tip">{t("account.profileGuestTip")}</p>
            </div>
          )}
          {message ? <p className="auth-message">{message}</p> : null}
        </main>
      </div>
    </div>
  );
}
