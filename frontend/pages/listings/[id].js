import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useEffect, useMemo, useState } from "react";

import AppHeader from "../../components/AppHeader";
import { useLanguage } from "../../contexts/LanguageContext";
import ListingLocationMap from "../../components/ListingLocationMap";
import ListingTipsBlock from "../../components/ListingTipsBlock";
import { apiFetch } from "../../lib/api";
import { getStoredToken, getStoredUser } from "../../lib/auth";
import { findCategoryTrail } from "../../lib/categoryPath";
import { buildCategoryHref } from "../../lib/categoryLinks";
import { formatPrice } from "../../lib/i18n";
import { fallbackCategoriesBySection, fallbackListings } from "../../lib/mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const SECTION_NAMES = {
  services: "Услуги",
  realty: "Недвижимость",
  transport: "Транспорт",
};

/** Цепочка для UI: раздел → категории → продукт (объявление). */
function normalizeListingProduct(listing) {
  if (!listing || typeof listing !== "object") return listing;
  const sectionKey = listing.section_key || listing.section || "services";
  const sectionNameRu = listing.section_name_ru || SECTION_NAMES[sectionKey] || "Каталог";
  let categoryPath = Array.isArray(listing.category_path) ? listing.category_path : [];
  if (!categoryPath.length && listing.category_slug) {
    const tree = fallbackCategoriesBySection[sectionKey] || [];
    categoryPath = findCategoryTrail(tree, listing.category_slug) || [];
  }
  return {
    ...listing,
    section_key: sectionKey,
    section_name_ru: sectionNameRu,
    category_path: categoryPath,
  };
}

export async function getStaticPaths() {
  if (process.env.NEXT_STATIC_EXPORT === "1") {
    const ids = new Set();
    const max =
      Number(process.env.NEXT_EXPORT_LISTING_ID_MAX || process.env.NEXT_STATIC_LISTING_ID_MAX || "1200") || 1200;
    for (let i = 1; i <= max; i++) ids.add(String(i));
    for (const item of fallbackListings) ids.add(String(item.id));
    return {
      paths: [...ids].map((id) => ({ params: { id } })),
      fallback: false,
    };
  }
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps() {
  return { props: {} };
}

async function fetchListingById(id) {
  try {
    const res = await fetch(`${API_URL}/listings/${id}`);
    if (!res.ok) {
      const fallback = fallbackListings.find((item) => String(item.id) === String(id));
      if (!fallback) return { notFound: true, listing: null };
      return {
        notFound: false,
        listing: normalizeListingProduct({
          ...fallback,
          phone: "+992 90 111 22 33",
          image_urls: fallback.cover_image_url ? [fallback.cover_image_url] : [],
          seller_name: "Demo Seller",
          is_promoted: false,
          promoted_until: null,
          user_id: fallback.user_id ?? 1,
        }),
      };
    }
    const listing = await res.json();
    return { notFound: false, listing: normalizeListingProduct(listing) };
  } catch {
    const fallback = fallbackListings.find((item) => String(item.id) === String(id));
    if (!fallback) return { notFound: true, listing: null };
    return {
      notFound: false,
      listing: normalizeListingProduct({
        ...fallback,
        phone: "+992 90 111 22 33",
        image_urls: fallback.cover_image_url ? [fallback.cover_image_url] : [],
        seller_name: "Demo Seller",
        is_promoted: false,
        promoted_until: null,
        user_id: fallback.user_id ?? 1,
      }),
    };
  }
}

export default function ListingPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const rawId = router.query.id;
  const id = typeof rawId === "string" ? rawId : "";

  const [listing, setListing] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!router.isReady || !id) return;
    let cancelled = false;
    (async () => {
      const result = await fetchListingById(id);
      if (cancelled) return;
      if (result.notFound) {
        setNotFound(true);
        setListing(null);
      } else {
        setNotFound(false);
        setListing(result.listing);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router.isReady, id]);

  const [message, setMessage] = useState("");
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (!listing) return;
    const u = getStoredUser();
    setIsOwner(Boolean(u && String(u.id) === String(listing.user_id)));
  }, [listing]);

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const normalizedPhone = (listing?.phone || "").replace(/\s/g, "");
  const imageUrls = useMemo(
    () =>
      (listing?.image_urls || []).map((url) => (url.startsWith("http") ? url : `${API_URL}${url}`)),
    [listing]
  );
  const mainImage = imageUrls[selectedImageIndex] || imageUrls[0] || "";
  const sectionKey = listing?.section_key || "services";
  const categoryPath = listing?.category_path || [];
  const categoryLine = useMemo(
    () =>
      categoryPath.length
        ? categoryPath
            .map((c) => (lang === "tj" ? c.name_tj || c.name_ru : c.name_ru))
            .join(" · ")
        : null,
    [categoryPath, lang]
  );
  const quickQuestions = [
    "Можно сегодня?",
    "Какая цена за услугу?",
    "Есть ли выезд на дом?",
    "Сколько длится работа?",
  ];

  useEffect(() => {
    if (imageUrls.length <= 1 || isLightboxOpen) return undefined;
    const timer = setInterval(() => {
      setSelectedImageIndex((prev) => (prev + 1) % imageUrls.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [imageUrls.length, isLightboxOpen]);

  useEffect(() => {
    if (!isLightboxOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === "Escape") setIsLightboxOpen(false);
      if (event.key === "ArrowRight") {
        setSelectedImageIndex((prev) => (prev + 1) % imageUrls.length);
      }
      if (event.key === "ArrowLeft") {
        setSelectedImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isLightboxOpen, imageUrls.length]);

  function nextImage() {
    setSelectedImageIndex((prev) => (prev + 1) % imageUrls.length);
  }

  function prevImage() {
    setSelectedImageIndex((prev) => (prev - 1 + imageUrls.length) % imageUrls.length);
  }

  async function addToFavorites() {
    if (!listing) return;
    if (!getStoredToken()) {
      setMessage("Сначала войдите по логину и паролю");
      return;
    }
    try {
      await apiFetch(`/favorites/${listing.id}`, { method: "POST" });
      setMessage("Добавлено в избранное");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function writeToSeller() {
    if (!listing) return;
    if (!getStoredToken()) {
      setMessage("Сначала войдите по логину и паролю");
      return;
    }
    router.push(`/chat/${listing.id}?participant=${listing.user_id}`);
  }

  if (!router.isReady || !id) {
    return null;
  }

  if (notFound) {
    return (
      <div className="app-shell youla-app-shell">
        <div className="page youla-page listing-page">
          <AppHeader />
          <main className="listing-content" style={{ padding: "2rem" }}>
            <p>Объявление не найдено.</p>
            <Link href="/">На главную</Link>
          </main>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="app-shell youla-app-shell">
        <div className="page youla-page listing-page">
          <AppHeader />
          <main className="listing-content" style={{ padding: "2rem" }}>
            <p>Загрузка…</p>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page listing-page">
        <AppHeader />

        <main className="listing-content listing-layout">
          <div className="listing-left">
            <nav className="breadcrumbs" aria-label={lang === "tj" ? "Нишонҳои роҳ" : "Хлебные крошки"}>
              <Link href="/">{lang === "tj" ? "Саҳифаи асосӣ" : "Главная"}</Link>
              <span className="breadcrumbs-sep"> / </span>
              <Link href={`/?section=${sectionKey}`}>{listing.section_name_ru || SECTION_NAMES[sectionKey] || "Каталог"}</Link>
              {categoryPath.map((crumb) => (
                <Fragment key={crumb.slug}>
                  <span className="breadcrumbs-sep"> / </span>
                  <Link href={buildCategoryHref(crumb.slug, sectionKey)}>{lang === "tj" ? crumb.name_tj || crumb.name_ru : crumb.name_ru}</Link>
                </Fragment>
              ))}
              <span className="breadcrumbs-sep"> / </span>
              <span className="breadcrumbs-current">{listing.title}</span>
            </nav>

            <div className="listing-title-row">
              <h1>
                {listing.title}
                {listing.is_promoted ? (
                  <span className="listing-top-badge" title="Объявление продвигается — показывается выше в поиске">
                    <span className="listing-top-badge__icon" aria-hidden>
                      ✦
                    </span>
                    Продвижение
                  </span>
                ) : null}
              </h1>
              <div className="listing-price">{formatPrice(listing.price, lang)}</div>
            </div>

            {isOwner ? (
              <p className="listing-owner-monetization">
                <Link href={`/wallet?listing=${listing.id}`} className="ghost strong">
                  {listing.is_promoted ? "Продлить продвижение" : "Поднять в топ выдачи"} — кошелёк и тарифы
                </Link>
              </p>
            ) : null}

            <section className="listing-gallery-card">
              {mainImage ? (
                <img
                  src={mainImage}
                  alt={listing.title}
                  className="listing-main-image"
                  onClick={() => setIsLightboxOpen(true)}
                />
              ) : (
                <div className="placeholder-image listing-main-image">Фото</div>
              )}

              {imageUrls.length > 1 ? (
                <div className="listing-thumbs">
                  {imageUrls.map((url, index) => (
                    <button
                      key={url}
                      type="button"
                      className={`thumb-btn ${index === selectedImageIndex ? "active" : ""}`}
                      onClick={() => setSelectedImageIndex(index)}
                    >
                      <img src={url} alt={`${listing.title} ${index + 1}`} />
                    </button>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="listing-section listing-section--location">
              <h3>Расположение</h3>
              <p className="listing-city-line">
                <strong>Город:</strong> {listing.city}
              </p>
              <ListingLocationMap city={listing.city} />
            </section>

            <section className="listing-section">
              <h3>Подробности</h3>
              <ul className="details-list">
                <li>
                  Раздел: <strong>{listing.section_name_ru || SECTION_NAMES[sectionKey] || "—"}</strong>
                </li>
                {categoryLine ? (
                  <li>
                    Категория: <strong>{categoryLine}</strong>
                  </li>
                ) : (
                  <li>Категория: уточняется</li>
                )}
                <li>Просмотры: {listing.views_count || 0}</li>
                <li>Статус: {listing.status || "active"}</li>
              </ul>
            </section>

            <section className="listing-section">
              <h3>Описание</h3>
              <p>{listing.description}</p>
            </section>

            <ListingTipsBlock />
          </div>

          <aside className="listing-side-card">
            <div className="seller-box">
              <div className="seller-name">{listing.seller_name || "Исполнитель"}</div>
              <div className="seller-phone">{listing.phone}</div>
            </div>

            <a className="primary call-button side-btn" href={`tel:${normalizedPhone}`}>
              Позвонить
            </a>
            <button className="ghost side-btn" type="button" onClick={writeToSeller}>
              Написать
            </button>
            <button className="ghost side-btn" type="button" onClick={addToFavorites}>
              В избранное
            </button>
            {message ? <p className="auth-message">{message}</p> : null}

            <div className="quick-questions">
              <h4>Спросите у исполнителя</h4>
              <div className="questions-wrap">
                {quickQuestions.map((question) => (
                  <button type="button" key={question} className="question-chip">
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </main>

        {isLightboxOpen && mainImage ? (
          <div className="lightbox-overlay" onClick={() => setIsLightboxOpen(false)}>
            <button
              type="button"
              className="lightbox-close"
              onClick={(e) => {
                e.stopPropagation();
                setIsLightboxOpen(false);
              }}
            >
              ✕
            </button>
            {imageUrls.length > 1 ? (
              <>
                <button
                  type="button"
                  className="lightbox-nav prev"
                  onClick={(e) => {
                    e.stopPropagation();
                    prevImage();
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="lightbox-nav next"
                  onClick={(e) => {
                    e.stopPropagation();
                    nextImage();
                  }}
                >
                  ›
                </button>
              </>
            ) : null}
            <img
              src={mainImage}
              alt={listing.title}
              className="lightbox-image"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
