import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../components/AppHeader";
import { useLanguage } from "../contexts/LanguageContext";
import { apiFetch, withApiPrefix } from "../lib/api";
import { getStoredToken } from "../lib/auth";
import { formatPrice } from "../lib/i18n";

export default function CartPage() {
  const { lang, t } = useLanguage();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!getStoredToken()) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch("/users/me/cart");
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setMessage(e?.message || "");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function removeItem(id) {
    try {
      await apiFetch(`/users/me/cart/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setMessage(e?.message || "");
    }
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page cart-page">
        <AppHeader />
        <main className="cart-main">
          <h1 className="cart-title">{t("auction.cartTitle")}</h1>
          {message ? <p className="cart-msg cart-msg--err">{message}</p> : null}
          {loading ? (
            <p>{t("common.loading")}</p>
          ) : items.length === 0 ? (
            <p className="cart-empty">{t("auction.cartEmpty")}</p>
          ) : (
            <ul className="cart-list">
              {items.map((row) => {
                const cover = row.listing?.cover_image_url;
                const img = cover && !cover.startsWith("http") ? withApiPrefix(cover) : cover;
                return (
                  <li key={row.id} className="cart-row">
                    <Link href={`/listings/${row.listing_id}`} className="cart-row-img-link">
                      {img ? (
                        <img src={img} alt="" className="cart-row-img" />
                      ) : (
                        <div className="cart-row-img cart-row-img--ph">{t("common.photo")}</div>
                      )}
                    </Link>
                    <div className="cart-row-body">
                      <div className="cart-row-meta">
                        <span className="cart-row-badge">{t("auction.cartSourceAuction")}</span>
                      </div>
                      <Link href={`/listings/${row.listing_id}`} className="cart-row-title">
                        {row.listing?.title || ` #${row.listing_id}`}
                      </Link>
                      <div className="cart-row-price">
                        {t("auction.cartPrice")}: {formatPrice(row.price_som, lang)}
                      </div>
                      <button type="button" className="cart-row-remove ghost" onClick={() => removeItem(row.id)}>
                        {t("auction.cartRemove")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </main>
      </div>
    </div>
  );
}
