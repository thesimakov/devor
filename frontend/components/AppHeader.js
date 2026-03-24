import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useLanguage } from "../contexts/LanguageContext";
import { apiFetch } from "../lib/api";
import { getStoredToken } from "../lib/auth";
import { CITY_KEYS, cityLabel } from "../lib/i18n";

export default function AppHeader({
  searchValue,
  onSearchChange,
  /** Устарело: язык берётся из LanguageContext; оставлено для совместимости */
  lang: langProp,
  onLangChange,
  /** 'youla' — единая шапка сайта; 'default' — старый двухрядный вариант */
  variant = "youla",
}) {
  const router = useRouter();
  const { lang: ctxLang, setLang: ctxSetLang, t } = useLanguage();
  const lang = langProp ?? ctxLang;
  const setLang = onLangChange ?? ctxSetLang;

  const [localSearch, setLocalSearch] = useState("");
  const [cityKey, setCityKey] = useState("dushanbe");
  const [unreadCount, setUnreadCount] = useState(0);
  const [toast, setToast] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const controlled = typeof searchValue === "string" && typeof onSearchChange === "function";
  const value = controlled ? searchValue : localSearch;

  function onSubmit(event) {
    event.preventDefault();
    const q = value.trim();
    router.push(q ? `/?q=${encodeURIComponent(q)}` : "/");
  }

  useEffect(() => {
    let active = true;
    async function loadWallet() {
      if (!getStoredToken()) {
        if (active) setWalletBalance(null);
        return;
      }
      try {
        const w = await apiFetch("/billing/wallet");
        if (!active) return;
        setWalletBalance(w?.balance_som ?? null);
      } catch {
        if (active) setWalletBalance(null);
      }
    }
    loadWallet();
    return () => {
      active = false;
    };
  }, [router.pathname]);

  useEffect(() => {
    let active = true;
    async function loadUnread() {
      if (!getStoredToken()) {
        if (active) setUnreadCount(0);
        if (typeof window !== "undefined") {
          localStorage.setItem("devor_last_unread_count", "0");
        }
        return;
      }
      try {
        const payload = await apiFetch("/chat/unread-count");
        const nextCount = payload?.unread_count || 0;
        if (!active) return;
        setUnreadCount(nextCount);

        if (typeof window !== "undefined") {
          const lastSeen = Number(localStorage.getItem("devor_last_unread_count") || "0");
          const isChatPage = router.pathname.startsWith("/chat");
          if (nextCount > lastSeen && !isChatPage) {
            try {
              const conversations = await apiFetch("/chat/conversations");
              const firstUnread = (conversations || []).find((item) => item.unread_count > 0);
              setToast({
                text: firstUnread
                  ? t("header.toastNewMessageFrom", { title: firstUnread.listing_title })
                  : t("header.toastNewMessage"),
                href: firstUnread
                  ? `/chat/${firstUnread.listing_id}?participant=${firstUnread.participant_id}`
                  : "/chat",
              });
            } catch {
              setToast({ text: t("header.toastNewMessage"), href: "/chat" });
            }
          }
          localStorage.setItem("devor_last_unread_count", String(nextCount));
        }
      } catch {
        if (active) setUnreadCount(0);
      }
    }

    loadUnread();
    const timer = setInterval(loadUnread, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [router.pathname, t]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (variant === "youla") {
    return (
      <div className="header-youla-wrap">
        {toast ? (
          <button
            type="button"
            className="message-toast"
            onClick={() => {
              router.push(toast.href);
              setToast(null);
            }}
          >
            <span className="message-toast-dot" />
            <span>{toast.text}</span>
          </button>
        ) : null}

        <div className="youla-header-sub" aria-label={t("header.quickLinksAria")}>
          <Link href="/my-listings" className="youla-sub-link">
            {t("header.myListings")}
          </Link>
          <Link href="/favorites" className="youla-sub-link">
            {t("header.favorites")}
          </Link>
          <Link href="/wallet" className="youla-sub-link youla-sub-link--wallet" title={t("header.walletTitle")}>
            {walletBalance != null
              ? `${t("header.balancePrefix")} ${Number(walletBalance).toLocaleString(lang === "tj" ? "tg-TJ" : "ru-RU", { maximumFractionDigits: 0 })} ${t("common.currencyWallet")}`
              : t("header.wallet")}
          </Link>
          <span className="youla-sub-muted">{t("common.tajikistan")}</span>
        </div>

        <header className="youla-header-main">
          <Link href="/" className="youla-brand-logo" aria-label={t("header.homeAria")}>
            DEVOR
          </Link>

          <a href="#youla-categories" className="youla-btn-categories">
            <span className="youla-hamburger" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {t("header.categories")}
          </a>

          <form className="youla-search-form" onSubmit={onSubmit}>
            <input
              type="search"
              className="youla-search-input"
              placeholder={t("header.searchPlaceholder")}
              value={value}
              onChange={(e) => {
                if (controlled) onSearchChange(e.target.value);
                else setLocalSearch(e.target.value);
              }}
              autoComplete="off"
            />
            <button type="submit" className="youla-search-submit">
              {t("header.find")}
            </button>
          </form>

          <Link href="/create-listing" className="youla-btn-post">
            {t("header.postListing")}
          </Link>

          <div className="youla-header-tools">
            <select
              className="youla-header-select youla-header-select--city"
              value={cityKey}
              onChange={(e) => setCityKey(e.target.value)}
              aria-label={t("header.cityAria")}
            >
              {CITY_KEYS.map((key) => (
                <option value={key} key={key}>
                  {cityLabel(lang, key)}
                </option>
              ))}
            </select>

            <select
              className="youla-header-select youla-header-select--lang"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label={t("header.langAria")}
            >
              <option value="ru">RU</option>
              <option value="tj">TJ</option>
            </select>

            <Link href="/favorites" className="youla-icon-btn" title={t("header.favoriteTitle")} aria-label={t("header.favoriteTitle")}>
              <svg className="youla-icon-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
              </svg>
            </Link>

            <Link href="/chat" className="youla-icon-btn" title={t("header.messages")} aria-label={t("header.messages")}>
              <svg className="youla-icon-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
                />
              </svg>
              {unreadCount > 0 ? (
                <span className="youla-badge-mini">{unreadCount > 99 ? t("common.ninetyNinePlus") : unreadCount}</span>
              ) : null}
            </Link>

            <Link href="/profile" className="youla-icon-btn youla-icon-btn--profile" aria-label={t("header.profile")} title={t("header.profileTitle")}>
              <svg className="youla-icon-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                />
              </svg>
            </Link>
          </div>
        </header>
      </div>
    );
  }

  return (
    <div className="header-copy-wrap">
      {toast ? (
        <button
          type="button"
          className="message-toast"
          onClick={() => {
            router.push(toast.href);
            setToast(null);
          }}
        >
          <span className="message-toast-dot" />
          <span>{toast.text}</span>
        </button>
      ) : null}

      <div className="top-nav-row">
        <div className="top-nav-left">
          <a href="#">{t("header.forBusiness")}</a>
          <a href="#">{t("header.career")}</a>
          <a href="#">{t("header.help")}</a>
          <a href="#">{t("header.catalogs")}</a>
        </div>
        <div className="top-nav-right">
          <Link href="/create-listing" className="copy-action-link strong">
            {t("header.postListingPlus")}
          </Link>
          <Link href="/my-listings" className="copy-action-link">
            {t("header.myListings")}
          </Link>
          <Link href="/favorites" className="copy-action-link">
            {t("header.favorites")}
          </Link>
          <Link href="/chat" className="copy-action-link with-badge">
            {t("header.messages")}
            {unreadCount > 0 ? (
              <span className="header-unread-badge">{unreadCount > 99 ? t("common.ninetyNinePlus") : unreadCount}</span>
            ) : null}
          </Link>
          <Link href="/profile" className="profile-icon-btn" aria-label={t("header.profile")} title={t("header.profileTitle")}>
            <span />
          </Link>
        </div>
      </div>

      <header className="copy-header-main">
        <Link href="/" className="logo copy-logo">
          DEVOR
        </Link>

        <form className="search-copy-form" onSubmit={onSubmit}>
          <input
            className="search copy-search"
            placeholder={t("header.searchPlaceholder")}
            value={value}
            onChange={(e) => {
              if (controlled) onSearchChange(e.target.value);
              else setLocalSearch(e.target.value);
            }}
          />
          <button type="submit" className="search-submit-btn">
            {t("header.find")}
          </button>
        </form>

        <div className="header-locale-group">
          <select className="location-select" value={cityKey} onChange={(e) => setCityKey(e.target.value)}>
            {CITY_KEYS.map((key) => (
              <option value={key} key={key}>
                {cityLabel(lang, key)}
              </option>
            ))}
          </select>

          <select className="location-select language-select-inline" value={lang} onChange={(e) => setLang(e.target.value)}>
            <option value="ru">RU</option>
            <option value="tj">TJ</option>
          </select>
        </div>
      </header>
    </div>
  );
}
