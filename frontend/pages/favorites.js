import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../components/AppHeader";
import { useLanguage } from "../contexts/LanguageContext";
import AuthPhoneForm from "../components/AuthPhoneForm";
import HeartEmptyIllustration from "../components/HeartEmptyIllustration";
import PageIntroBanner from "../components/PageIntroBanner";
import { CONTENT_IMAGES } from "../lib/contentAssets";
import { apiFetch, withApiPrefix } from "../lib/api";
import { formatPrice } from "../lib/i18n";

export default function FavoritesPage() {
  const { lang, t } = useLanguage();
  const [authed, setAuthed] = useState(false);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);

  const load = useCallback(async () => {
    setLoadingItems(true);
    try {
      const payload = await apiFetch("/users/me/favorites");
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

  async function removeFromFavorites(id) {
    try {
      await apiFetch(`/favorites/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader />

        <main className="list-page favorites-page">
          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />
          {authed ? (
            <>
              <PageIntroBanner
                title={t("account.favoritesTitle")}
                subtitle={t("account.favoritesSubtitle")}
                imageUrl={CONTENT_IMAGES.favorites}
                imageAlt={t("account.favoritesImageAlt")}
              />
              <div className="grid favorites-grid">
                {loadingItems
                  ? Array.from({ length: 6 }, (_, index) => (
                      <div className="card" key={`fav-skeleton-${index}`}>
                        <div className="skeleton skeleton-thumb" />
                        <div className="skeleton skeleton-line short" />
                        <div className="skeleton skeleton-line tiny" />
                        <div className="skeleton skeleton-line" />
                      </div>
                    ))
                  : items.map((item) => (
                      <div className={`card${item.is_promoted ? " card--promoted" : ""}`} key={item.id}>
                        <div className="card-thumb-el">
                          {item.cover_image_url ? (
                            <img src={withApiPrefix(item.cover_image_url)} alt={item.title} className="listing-image" />
                          ) : (
                            <div className="placeholder-image">{t("common.photo")}</div>
                          )}
                          {item.is_promoted ? (
                            <span className="card-promo-floating">
                              <span aria-hidden>✦</span> {t("account.inTop")}
                            </span>
                          ) : null}
                        </div>
                        <div className="card-title">{item.title}</div>
                        <div className="card-price">{formatPrice(item.price, lang)}</div>
                        <div className="card-city">{item.city}</div>
                        <div className="row">
                          <Link href={`/listings/${item.id}`} className="ghost">
                            {t("account.open")}
                          </Link>
                          <button className="ghost" type="button" onClick={() => removeFromFavorites(item.id)}>
                            {t("account.removeFavorite")}
                          </button>
                        </div>
                      </div>
                    ))}
              </div>
              {!loadingItems && items.length === 0 ? (
                <div className="favorites-empty">
                  <HeartEmptyIllustration />
                  <p className="favorites-empty-title">{t("account.favoritesEmptyTitle")}</p>
                  <p className="empty-tip">{t("account.favoritesEmptyTip")}</p>
                  <Link href="/" className="primary favorites-empty-cta">
                    {t("account.goToListings")}
                  </Link>
                </div>
              ) : null}
            </>
          ) : (
            <div className="favorites-guest">
              <PageIntroBanner
                title={t("account.favoritesTitle")}
                subtitle={t("account.favoritesGuestSubtitle")}
                imageUrl={CONTENT_IMAGES.favorites}
                imageAlt=""
              />
              <p className="favorites-guest-tip">{t("account.favoritesGuestTip")}</p>
            </div>
          )}
          {message ? <p>{message}</p> : null}
        </main>
      </div>
    </div>
  );
}
