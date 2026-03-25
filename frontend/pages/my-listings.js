import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppHeader from "../components/AppHeader";
import { useLanguage } from "../contexts/LanguageContext";
import AuthPhoneForm from "../components/AuthPhoneForm";
import SceneIllustration from "../components/SceneIllustration";
import PageIntroBanner from "../components/PageIntroBanner";
import { apiFetch, withApiPrefix } from "../lib/api";
import { CONTENT_IMAGES } from "../lib/contentAssets";
import { formatPrice } from "../lib/i18n";

export default function MyListingsPage() {
  const { lang, t } = useLanguage();
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [brokenImageIds, setBrokenImageIds] = useState([]);

  const load = useCallback(async () => {
    setLoadingItems(true);
    try {
      const payload = await apiFetch("/users/me/listings");
      setItems(payload);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  async function removeListing(id) {
    try {
      await apiFetch(`/listings/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setMessage(error.message);
    }
  }

  const visibleItems = useMemo(() => {
    const filtered = items.filter((item) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    });
    const sorted = [...filtered].sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "price") {
        return ((a.price ?? 0) - (b.price ?? 0)) * direction;
      }
      if (sortBy === "views_count") {
        return ((a.views_count ?? 0) - (b.views_count ?? 0)) * direction;
      }
      return (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()) * direction;
    });
    return sorted;
  }, [items, query, sortBy, sortOrder]);

  function markImageBroken(id) {
    setBrokenImageIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader />

        <main className="list-page my-listings-page">
          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />
          {authed ? (
            <>
              <section className="my-header-card">
                <div>
                  <h1>{t("account.myListingsTitle")}</h1>
                  <p>{t("account.myListingsSubtitle")}</p>
                </div>
                <div className="my-illustration-wrap">
                  <SceneIllustration compact />
                </div>
                <div className="my-summary-chip">
                  <strong>{items.length}</strong>
                  <span>{t("account.listingsCountLabel")}</span>
                </div>
              </section>

              <div className="listings-head my-listings-toolbar">
                <input
                  className="search modern-search my-search"
                  placeholder={t("account.searchMyListings")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="toolbar modern-toolbar">
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="created_at">{t("account.sortNewFirst")}</option>
                    <option value="price">{t("account.sortByPrice")}</option>
                    <option value="views_count">{t("account.sortByViews")}</option>
                  </select>
                  <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                    <option value="desc">{t("account.sortDesc")}</option>
                    <option value="asc">{t("account.sortAsc")}</option>
                  </select>
                </div>
              </div>

              <div className="my-list">
                {loadingItems
                  ? Array.from({ length: 5 }, (_, index) => (
                      <div className="my-card skeleton-row" key={`my-skeleton-${index}`}>
                        <div className="skeleton skeleton-thumb" />
                        <div className="my-card-main">
                          <div className="skeleton skeleton-line short" />
                          <div className="skeleton skeleton-line tiny" />
                          <div className="skeleton skeleton-line" />
                        </div>
                        <div className="my-card-side">
                          <div className="skeleton skeleton-line tiny" />
                          <div className="skeleton skeleton-line tiny" />
                        </div>
                      </div>
                    ))
                  : visibleItems.map((item) => (
                      <div className={`my-card${item.is_promoted ? " my-card--promoted" : ""}`} key={item.id}>
                        <div className="my-thumb-wrap">
                          {item.is_promoted ? <span className="my-thumb-promo-badge">✦ {t("account.inTop")}</span> : null}
                          {item.cover_image_url && !brokenImageIds.includes(item.id) ? (
                            <img
                              src={withApiPrefix(item.cover_image_url)}
                              alt={item.title}
                              className="my-thumb"
                              onError={() => markImageBroken(item.id)}
                            />
                          ) : (
                            <div className="my-thumb-placeholder">{t("common.photo")}</div>
                          )}
                        </div>

                        <div className="my-card-main">
                          <div className="card-title">{item.title}</div>
                          <div className="card-city">{item.city}</div>
                          <div className="avito-desc">{item.description}</div>
                        </div>

                        <div className="my-card-side">
                          <div className="card-price">{formatPrice(item.price, lang)}</div>
                          <div className="avito-meta">{t("account.views", { count: item.views_count || 0 })}</div>
                          <div className="my-actions">
                            <Link href={`/listings/${item.id}`} className="ghost">
                              {t("account.open")}
                            </Link>
                            <Link href={`/wallet?listing=${item.id}`} className="ghost strong">
                              {item.is_promoted ? t("account.extendTop") : t("account.boostTop")}
                            </Link>
                            <button className="ghost danger" type="button" onClick={() => removeListing(item.id)}>
                              {t("account.delete")}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
              </div>
              {!loadingItems && visibleItems.length === 0 ? (
                <div className="empty-state">
                  <SceneIllustration compact />
                  <p className="empty-tip">{t("account.emptyFilter")}</p>
                </div>
              ) : null}
            </>
          ) : (
            <div className="favorites-guest">
              <PageIntroBanner
                title={t("account.myListingsTitle")}
                subtitle={t("account.myListingsSubtitle")}
                imageUrl={CONTENT_IMAGES.publish}
                imageAlt=""
              />
              <p className="favorites-guest-tip">{t("account.loginToSeeListings")}</p>
            </div>
          )}
          {message ? <p>{message}</p> : null}
        </main>
      </div>
    </div>
  );
}
