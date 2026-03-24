import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import AppHeader from "../components/AppHeader";
import AuctionCountdownBadge from "../components/AuctionCountdownBadge";
import FavoriteHeartButton from "../components/FavoriteHeartButton";
import HowItWorksYoula from "../components/HowItWorksYoula";
import ListingsMapPreview from "../components/ListingsMapPreview";
import { useLanguage } from "../contexts/LanguageContext";
import { apiFetch } from "../lib/api";
import { AUTH_TOKEN_KEY, getStoredToken } from "../lib/auth";
import { formatPrice } from "../lib/i18n";
import { fallbackCategoriesBySection, fallbackListings } from "../lib/mockData";
import {
  SERVICES_BEAUTY_ONLY,
  categoriesForBeautyStrip,
  filterCategoryTreeToBeautyOnly,
  filterMockListingsBeautyOnly,
  listingsBeautyQueryParam,
} from "../lib/servicesScope";
import { CategoryStripIcon } from "../lib/CategoryStripIcon";
import { buildCategoryHref } from "../lib/categoryLinks";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Акцент на разделе «Услуги»; остальные разделы остаются в коде для масштабирования. */
const PHASE1_SERVICES_FOCUS = true;

function flattenCategoryNodes(nodes) {
  const out = [];
  function walk(list) {
    for (const n of list || []) {
      out.push(n);
      if (n.children?.length) walk(n.children);
    }
  }
  walk(nodes);
  return out;
}

function pseudoDistanceKm(id) {
  const a = id % 45;
  const b = id % 89;
  return `${5 + (a % 35)}.${(b % 9) || 1}`;
}

const SECTION_KEYS = new Set(["services", "realty", "transport"]);

/** Категория «Массаж» в разделе Услуги — выводим в полосе и подсвечиваем (иконка: lib/CategoryStripIcon). */
const MASSAGE_CATEGORY_SLUG = "beauty-spa-massazh";
export default function HomePage() {
  const router = useRouter();
  const { lang, t } = useLanguage();
  const [activeSection, setActiveSection] = useState("services");
  const [categories, setCategories] = useState([]);
  const [listingsPage, setListingsPage] = useState({ items: [], total: 0, page: 1, page_size: 20 });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set());
  const [soonSectionMessage, setSoonSectionMessage] = useState(null);

  const heroBanners = useMemo(
    () => [
      {
        key: "1",
        title: t("home.banner1Title"),
        subtitle: t("home.banner1Sub"),
        tone: "amber",
        imageUrl:
          "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1400&q=85",
      },
      {
        key: "2",
        title: t("home.banner2Title"),
        subtitle: t("home.banner2Sub"),
        tone: "blue",
        imageUrl:
          "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1400&q=85",
      },
      {
        key: "3",
        title: t("home.banner3Title"),
        subtitle: t("home.banner3Sub"),
        tone: "violet",
        imageUrl:
          "https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&w=1400&q=85",
      },
    ],
    [t]
  );

  const homeSectionTabs = useMemo(
    () => [
      { key: "services", label: t("home.sectionServices"), soon: false },
      { key: "realty", label: t("home.sectionRealty"), soon: true },
      { key: "transport", label: t("home.sectionTransport"), soon: true },
    ],
    [t]
  );

  /** На этапе 1 всегда грузим каталог услуг; недвижимость и транспорт — в переключателе «скоро». */
  const effectiveSection = PHASE1_SERVICES_FOCUS ? "services" : activeSection;

  const refreshFavorites = useCallback(async () => {
    if (!getStoredToken()) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const items = await apiFetch("/users/me/favorites");
      setFavoriteIds(new Set((items || []).map((x) => x.id)));
    } catch {
      setFavoriteIds(new Set());
    }
  }, []);

  useEffect(() => {
    refreshFavorites();
  }, [refreshFavorites]);

  useEffect(() => {
    function onStorage(e) {
      if (e.key === AUTH_TOKEN_KEY || e.key === null) {
        refreshFavorites();
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refreshFavorites]);

  useEffect(() => {
    function onFocus() {
      if (getStoredToken()) refreshFavorites();
    }
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshFavorites]);

  const handleFavoriteToggle = useCallback(
    async (listingId, e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!getStoredToken()) {
        window.alert(t("common.loginForFavorites"));
        return;
      }
      const isFav = favoriteIds.has(listingId);
      try {
        if (isFav) {
          await apiFetch(`/favorites/${listingId}`, { method: "DELETE" });
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(listingId);
            return next;
          });
        } else {
          await apiFetch(`/favorites/${listingId}`, { method: "POST" });
          setFavoriteIds((prev) => new Set(prev).add(listingId));
        }
      } catch (err) {
        window.alert(err?.message || t("common.favoritesUpdateError"));
      }
    },
    [favoriteIds, t]
  );
  const toImageUrl = (value) => (value && value.startsWith("http") ? value : `${API_URL}${value || ""}`);

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.section;
    const s = Array.isArray(raw) ? raw[0] : raw;
    if (PHASE1_SERVICES_FOCUS) {
      if (s === "realty" || s === "transport") {
        router.replace({ pathname: "/", query: { section: "services" } }, undefined, { shallow: true });
      }
      setActiveSection("services");
      return;
    }
    if (typeof s === "string" && SECTION_KEYS.has(s)) {
      setActiveSection(s);
      setPage(1);
    }
  }, [router.isReady, router.query.section]);

  const onHomeSectionTabClick = useCallback(
    (key) => {
      setSoonSectionMessage(null);
      if (key === "services") {
        router.push({ pathname: "/", query: { section: "services" } }, undefined, { shallow: true });
        setActiveSection("services");
        setPage(1);
        return;
      }
      if (PHASE1_SERVICES_FOCUS) {
        setSoonSectionMessage(key === "realty" ? t("home.soonRealty") : t("home.soonTransport"));
        return;
      }
      router.push({ pathname: "/", query: { section: key } }, undefined, { shallow: true });
      setPage(1);
    },
    [router, t]
  );

  const mapItems = (listingsPage.items || []).map((item) => ({
    ...item,
    cover_image_url: item.cover_image_url ? toImageUrl(item.cover_image_url) : "",
  }));

  const mapCity = listingsPage.items?.[0]?.city || "Душанбе";

  /** Порядок «рекомендаций» на странице: топ, затем просмотры, затем свежесть. */
  const recommendedItems = useMemo(() => {
    const items = [...(listingsPage.items || [])];
    items.sort((a, b) => {
      const pa = a.is_promoted ? 1 : 0;
      const pb = b.is_promoted ? 1 : 0;
      if (pb !== pa) return pb - pa;
      const va = Number(a.views_count) || 0;
      const vb = Number(b.views_count) || 0;
      if (vb !== va) return vb - va;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
    return items;
  }, [listingsPage.items]);

  const categoryStrip = useMemo(() => {
    const asFlat =
      SERVICES_BEAUTY_ONLY && effectiveSection === "services" && Array.isArray(categories) && categories.length
        ? categoriesForBeautyStrip(categories)
        : PHASE1_SERVICES_FOCUS && effectiveSection === "services" && Array.isArray(categories) && categories.length
          ? categories.filter((c) => c.slug)
          : flattenCategoryNodes(categories).filter((c) => c.slug);
    const massageIdx = asFlat.findIndex((c) => c.slug === MASSAGE_CATEGORY_SLUG);
    let ordered = [...asFlat];
    if (massageIdx >= 0) {
      const [massageCat] = ordered.splice(massageIdx, 1);
      ordered = [massageCat, ...ordered];
    } else {
      ordered = [
        {
          id: "strip-massage",
          slug: MASSAGE_CATEGORY_SLUG,
          name_ru: "Массаж",
          name_tj: "Массаж",
        },
        ...ordered,
      ];
    }
    return ordered.slice(0, 24);
  }, [categories, effectiveSection]);

  const stripSource = useMemo(() => {
    if (usingFallback) {
      let rows = fallbackListings.filter((item) => item.section === effectiveSection);
      if (SERVICES_BEAUTY_ONLY) rows = filterMockListingsBeautyOnly(rows);
      return rows;
    }
    return listingsPage.items || [];
  }, [usingFallback, effectiveSection, listingsPage.items]);

  const bargainItems = useMemo(() => {
    const sorted = [...stripSource].sort((a, b) => {
      const pa = a.price == null ? -1 : Number(a.price);
      const pb = b.price == null ? -1 : Number(b.price);
      return pa - pb;
    });
    return sorted.slice(0, 12);
  }, [stripSource]);

  /** Аукцион: дедлайн (deadline_at) в ближайший час; в демо — искусственные дедлайны на fallback. */
  const auctionEndingEntries = useMemo(() => {
    const now = Date.now();
    const hourMs = 60 * 60 * 1000;
    const rows = stripSource
      .map((item) => {
        let endMs = null;
        if (item.deadline_at) {
          const t = new Date(item.deadline_at).getTime();
          if (!Number.isNaN(t)) endMs = t;
        }
        return { item, endMs };
      })
      .filter(({ endMs }) => endMs != null && endMs > now && endMs - now < hourMs)
      .sort((a, b) => a.endMs - b.endMs)
      .slice(0, 12);

    if (rows.length === 0 && usingFallback && stripSource.length > 0) {
      return stripSource.slice(0, 4).map((item, i) => ({
        item,
        endMs: now + Math.min(59, 8 + i * 13) * 60 * 1000,
      }));
    }
    return rows;
  }, [stripSource, usingFallback]);

  function buildFallbackPage() {
    let sectionItems = fallbackListings.filter((item) => item.section === effectiveSection);
    if (SERVICES_BEAUTY_ONLY) sectionItems = filterMockListingsBeautyOnly(sectionItems);
    const filtered = sectionItems.filter((item) => {
      const searchOk = !search.trim()
        ? true
        : item.title.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
      return searchOk;
    });
    const ordered = [...filtered].sort((a, b) => {
      const dir = sortOrder === "asc" ? 1 : -1;
      if (sortBy === "price") {
        const aPrice = a.price ?? 0;
        const bPrice = b.price ?? 0;
        return (aPrice - bPrice) * dir;
      }
      return (a.id - b.id) * -dir;
    });
    return {
      items: ordered.slice((page - 1) * 12, (page - 1) * 12 + 12),
      total: ordered.length,
      page,
      page_size: 12,
    };
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [categoriesRes, listingsRes] = await Promise.all([
          fetch(`${API_URL}/categories?section=${effectiveSection}`),
          fetch(
            `${API_URL}/listings?section=${effectiveSection}&page=${page}&page_size=12&sort_by=${sortBy}&sort_order=${sortOrder}&q=${encodeURIComponent(search.trim())}${listingsBeautyQueryParam()}`
          ),
        ]);

        if (!categoriesRes.ok || !listingsRes.ok) {
          throw new Error("api failed");
        }
        const categoriesData = await categoriesRes.json();
        const listingsData = await listingsRes.json();
        const isCategoriesEmpty = !Array.isArray(categoriesData) || categoriesData.length === 0;
        const isListingsEmpty = !listingsData?.items?.length;

        if (isCategoriesEmpty && isListingsEmpty) {
          setCategories(filterCategoryTreeToBeautyOnly(fallbackCategoriesBySection[effectiveSection] || []));
          setListingsPage(buildFallbackPage());
          setUsingFallback(true);
        } else {
          setCategories(filterCategoryTreeToBeautyOnly(Array.isArray(categoriesData) ? categoriesData : []));
          setListingsPage(listingsData);
          setUsingFallback(false);
        }
      } catch {
        setCategories(filterCategoryTreeToBeautyOnly(fallbackCategoriesBySection[effectiveSection] || []));
        setListingsPage(buildFallbackPage());
        setUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [effectiveSection, page, search, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil((listingsPage.total || 0) / (listingsPage.page_size || 1)));
  const skeletonIds = [1, 2, 3, 4, 5, 6, 7, 8];

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader
          searchValue={search}
          onSearchChange={(value) => {
            setPage(1);
            setSearch(value);
          }}
        />

        <nav className="youla-home-section-tabs" aria-label={t("home.sectionTabsAria")}>
          <div className="youla-home-section-tabs-inner" role="tablist">
            {homeSectionTabs.map((tab) => {
              const isActive = PHASE1_SERVICES_FOCUS ? tab.key === "services" : tab.key === activeSection;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`youla-home-section-tab${isActive ? " is-active" : ""}${tab.soon ? " is-soon" : ""}`}
                  onClick={() => onHomeSectionTabClick(tab.key)}
                >
                  <span className="youla-home-section-tab-label">{tab.label}</span>
                  {tab.soon ? <span className="youla-home-section-tab-badge">{t("home.soonBadge")}</span> : null}
                </button>
              );
            })}
          </div>
          {soonSectionMessage ? (
            <p className="youla-home-section-soon-msg" role="status">
              {soonSectionMessage}
            </p>
          ) : null}
        </nav>

        <section className="youla-hero-banners" aria-label={t("home.bannersAria")}>
          <div className="youla-banners-track">
            {heroBanners.map((b) => (
              <article
                key={b.key}
                className={`youla-banner-card youla-banner-card--${b.tone}`}
                style={{ backgroundImage: `url(${b.imageUrl})` }}
              >
                <h2 className="youla-banner-title">{b.title}</h2>
                <p className="youla-banner-sub">{b.subtitle}</p>
              </article>
            ))}
          </div>
        </section>

        {PHASE1_SERVICES_FOCUS ? (
          <section className="youla-phase1-services" aria-label={t("home.phase1Aria")}>
            <div className="youla-phase1-services-inner youla-phase1-services-inner--solo">
              <div className="youla-phase1-services-copy">
                <h2 className="youla-phase1-services-title">{t("home.phase1Title")}</h2>
                <p className="youla-phase1-services-text">{t("home.phase1Text")}</p>
              </div>
            </div>
          </section>
        ) : null}

        <section id="youla-categories" className="youla-section youla-categories-block">
          <div className="youla-section-head">
            <h2 className="youla-section-title">{t("home.categoriesTitle")}</h2>
            <p className="youla-section-subtitle">{t("home.categoriesSub")}</p>
          </div>
          <div className="youla-category-chips-scroll" role="list">
            {categoryStrip.length === 0 && loading ? (
              <div className="youla-cat-skeleton-row">
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} className="youla-cat-skeleton" />
                ))}
              </div>
            ) : (
              categoryStrip.map((cat) => {
                const isMassage = cat.slug === MASSAGE_CATEGORY_SLUG;
                const label = isMassage ? t("home.massage") : lang === "tj" ? cat.name_tj || cat.name_ru : cat.name_ru;
                const sectionParam = isMassage ? "services" : effectiveSection;
                return (
                  <Link
                    href={buildCategoryHref(cat.slug, sectionParam)}
                    key={`${cat.id}-${cat.slug}`}
                    className={`youla-cat-pill${isMassage ? " youla-cat-pill--spotlight" : ""}`}
                    role="listitem"
                  >
                    <span className="youla-cat-icon">
                      <CategoryStripIcon slug={cat.slug} size={28} />
                    </span>
                    <span className="youla-cat-label">{label}</span>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section className="youla-section youla-auction-section" aria-label={t("home.auctionAria")}>
          <div className="youla-auction-head">
            <div className="youla-auction-head-text">
              <h2 className="youla-section-title">{t("home.auctionTitle")}</h2>
              <p className="youla-section-subtitle">{t("home.auctionSub")}</p>
            </div>
            <Link href="/create-listing" className="youla-auction-add-btn">
              {t("home.auctionAdd")}
            </Link>
          </div>
          {auctionEndingEntries.length === 0 ? (
            <p className="youla-auction-empty">{t("home.auctionEmpty")}</p>
          ) : (
            <div className="youla-horizontal-scroll">
              {auctionEndingEntries.map(({ item: listing, endMs }) => (
                <Link href={`/listings/${listing.id}`} key={listing.id} className="youla-strip-card youla-auction-card">
                  <div className="youla-strip-image-wrap">
                    {listing.cover_image_url ? (
                      <img src={toImageUrl(listing.cover_image_url)} alt="" className="youla-strip-img" />
                    ) : (
                      <div className="youla-strip-img youla-strip-img--placeholder">{t("common.photo")}</div>
                    )}
                    <span className="youla-auction-timer-badge" aria-live="polite">
                      <AuctionCountdownBadge endMs={endMs} endedLabel={t("home.auctionEnded")} />
                    </span>
                    <FavoriteHeartButton
                      listingId={listing.id}
                      active={favoriteIds.has(listing.id)}
                      onToggle={handleFavoriteToggle}
                      variant="strip"
                    />
                  </div>
                  <div className="youla-strip-body">
                    <div className="youla-strip-price">
                      {listing.price == null ? t("common.free") : formatPrice(listing.price, lang)}
                    </div>
                    <div className="youla-strip-title">{listing.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {bargainItems.length > 0 ? (
          <section className="youla-section youla-strip-section" aria-label={t("home.bargainAria")}>
            <div className="youla-section-head youla-strip-head">
              <h2 className="youla-section-title">{t("home.bargainTitle")}</h2>
              <span className="youla-strip-hint">{t("home.bargainHint")}</span>
            </div>
            <div className="youla-horizontal-scroll">
              {bargainItems.map((listing) => (
                <Link href={`/listings/${listing.id}`} key={listing.id} className="youla-strip-card">
                  <div className="youla-strip-image-wrap">
                    {listing.cover_image_url ? (
                      <img src={toImageUrl(listing.cover_image_url)} alt="" className="youla-strip-img" />
                    ) : (
                      <div className="youla-strip-img youla-strip-img--placeholder">{t("common.photo")}</div>
                    )}
                    <span className="youla-strip-distance">
                      {pseudoDistanceKm(listing.id)} {t("common.km")}
                    </span>
                    <FavoriteHeartButton
                      listingId={listing.id}
                      active={favoriteIds.has(listing.id)}
                      onToggle={handleFavoriteToggle}
                      variant="strip"
                    />
                  </div>
                  <div className="youla-strip-body">
                    <div className="youla-strip-price">
                      {listing.price == null ? t("common.free") : formatPrice(listing.price, lang)}
                    </div>
                    <div className="youla-strip-title">{listing.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <HowItWorksYoula />

        <div className={`youla-main-columns ${mapExpanded ? "map-expanded" : ""}`}>
          <div className="youla-feed">
            <ListingsMapPreview city={mapCity} items={mapItems} onExpandChange={setMapExpanded} />

            <div className="listings-head youla-listings-head youla-recommendations-head">
              <div className="youla-recommendations-intro">
                <div className="youla-recommendations-title-row">
                  <h2 className="youla-all-ads-title">{t("home.recoTitle")}</h2>
                  <span className="results-badge">{t("home.recoListingsCount", { count: listingsPage.total || 0 })}</span>
                </div>
                <p className="youla-recommendations-sub">{t("home.recoSub")}</p>
              </div>
              <div className="youla-sort-wrap">
                <label className="youla-sort-label">
                  <span>{t("home.sortLabel")}</span>
                  <select
                    value={`${sortBy}:${sortOrder}`}
                    onChange={(e) => {
                      const [nextSort, nextOrder] = e.target.value.split(":");
                      setSortBy(nextSort);
                      setSortOrder(nextOrder);
                      setPage(1);
                    }}
                  >
                    <option value="created_at:desc">{t("home.sortDefaultNew")}</option>
                    <option value="created_at:asc">{t("home.sortOldFirst")}</option>
                    <option value="price:asc">{t("home.sortCheapFirst")}</option>
                    <option value="price:desc">{t("home.sortExpensiveFirst")}</option>
                    <option value="views_count:desc">{t("home.sortByViews")}</option>
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <div className="youla-grid">
                {skeletonIds.map((id) => (
                  <div key={id} className="youla-card youla-card--skeleton">
                    <div className="youla-skel-img" />
                    <div className="youla-skel-line youla-skel-line--price" />
                    <div className="youla-skel-line" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="youla-grid">
                {recommendedItems.map((listing) => {
                  const promoted = Boolean(listing.is_promoted);
                  return (
                    <Link href={`/listings/${listing.id}`} key={listing.id} className={`youla-card ${promoted ? "youla-card--promo" : ""}`}>
                      <div className="youla-card-image-wrap">
                        {listing.cover_image_url ? (
                          <img src={toImageUrl(listing.cover_image_url)} alt={listing.title} className="youla-card-img" />
                        ) : (
                          <div className="youla-card-img youla-card-img--ph">{t("common.photo")}</div>
                        )}
                        {promoted ? (
                          <span className="youla-promo-pill">
                            <span className="youla-promo-pill__shine" aria-hidden />
                            <span className="youla-promo-pill__icon" aria-hidden>
                              ✦
                            </span>
                            {t("home.inTop")}
                          </span>
                        ) : null}
                        <span className="youla-card-distance">
                          {pseudoDistanceKm(listing.id)} {t("common.km")}
                        </span>
                        <FavoriteHeartButton
                          listingId={listing.id}
                          active={favoriteIds.has(listing.id)}
                          onToggle={handleFavoriteToggle}
                          variant="grid"
                        />
                      </div>
                      <div className="youla-card-body">
                        <div className="youla-card-price">{formatPrice(listing.price, lang)}</div>
                        <div className="youla-card-title">{listing.title}</div>
                        <div className="youla-card-city">{listing.city}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {usingFallback ? (
              <p className="empty-tip youla-demo-tip">{t("home.demoDataTip")}</p>
            ) : null}
            {!loading && listingsPage.items.length === 0 ? (
              <div className="empty-state youla-empty">
                <p className="empty-tip">{t("home.emptySection")}</p>
              </div>
            ) : null}

            <div className="pagination youla-pagination">
              <button className="youla-page-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                {t("home.pageBack")}
              </button>
              <span className="youla-page-info">{t("home.pageOf", { page, total: totalPages })}</span>
              <button className="youla-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                {t("home.pageForward")}
              </button>
            </div>
          </div>

          <aside className={`youla-right-sidebar ${mapExpanded ? "collapsed" : ""}`} aria-label={t("home.asideAria")}>
            <div className="youla-bonus-card">
              <div className="youla-bonus-visual" aria-hidden />
              <h3 className="youla-bonus-title">{t("home.bonusTitle")}</h3>
              <p className="youla-bonus-text">{t("home.bonusText")}</p>
              <div className="youla-bonus-form">
                <input type="email" placeholder={t("home.bonusEmailPh")} className="youla-bonus-input" readOnly />
                <button type="button" className="youla-bonus-btn">
                  {t("home.bonusAdd")}
                </button>
              </div>
            </div>

            <div className="youla-aside-social">
              <span className="youla-social-label">{t("home.socialLabel")}</span>
              <div className="youla-social-row">
                <a href="#" className="youla-social-pill" aria-label="VK">
                  VK
                </a>
                <a href="#" className="youla-social-pill" aria-label="Telegram">
                  TG
                </a>
              </div>
            </div>

            <nav className="youla-aside-links">
              <a href="#">{t("footer.terms")}</a>
              <a href="#">{t("footer.ads")}</a>
              <a href="#">{t("footer.help")}</a>
              <a href="#">{t("footer.rules")}</a>
            </nav>

            <p className="youla-aside-copy">{t("home.asideCopyright", { suffix: t("home.asideServicesSuffix") })}</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
