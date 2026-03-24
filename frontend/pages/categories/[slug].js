import Link from "next/link";
import { useRouter } from "next/router";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HiOutlineMapPin, HiOutlineStar, HiOutlineTrophy } from "react-icons/hi2";

import AppHeader from "../../components/AppHeader";
import BeautyCategoryFilterPanel from "../../components/BeautyCategoryFilterPanel";
import ListingsMapPreview from "../../components/ListingsMapPreview";
import { CONTENT_IMAGES } from "../../lib/contentAssets";
import { findCategoryTrail } from "../../lib/categoryPath";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatIntegerGrouped, formatPrice, formatPriceFrom } from "../../lib/i18n";
import { getAllCategorySlugs } from "../../lib/categoryStaticPaths";
import { fallbackCategoriesBySection, fallbackListings } from "../../lib/mockData";
import { CategoryStripIcon } from "../../lib/CategoryStripIcon";
import { BEAUTY_PARENT_SLUG, BEAUTY_SUBCATEGORIES } from "../../lib/beautyCategoryLanding";
import { buildCategoryHref } from "../../lib/categoryLinks";
import { SERVICES_BEAUTY_ONLY, isCategoryRouteAllowed } from "../../lib/servicesScope";
import { applyBeautyPostFilters, BEAUTY_FILTER_DEFAULTS, isBeautyServicesSlug } from "../../lib/beautySubcategoryFilters";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PAGE_SIZE = 12;

const CITIES = ["", "Душанбе", "Худжанд", "Бохтар", "Кулоб", "Истаравшан", "Турсунзода"];

const CATALOG_SECTION_TITLES = {
  services: { ru: "Предложения услуг", tj: "Пешниҳодҳои хизматҳо" },
  realty: { ru: "Недвижимость", tj: "Амволи ғайриманқул" },
  transport: { ru: "Транспорт", tj: "Нақлиёт" },
};

export async function getStaticPaths() {
  if (process.env.NEXT_STATIC_EXPORT === "1") {
    return {
      paths: getAllCategorySlugs().map((s) => ({ params: { slug: s } })),
      fallback: false,
    };
  }
  return { paths: [], fallback: "blocking" };
}

export async function getStaticProps() {
  return { props: {} };
}

const DEFAULT_CATEGORY_FILTERS = {
  city: "",
  priceFrom: "",
  priceTo: "",
  q: "",
  excludeQ: "",
  includeSubcats: true,
  sortBy: "created_at",
  sortOrder: "desc",
  cbPrivate: true,
  cbCompany: true,
  reliableOnly: false,
  execSegment: "all",
  stars4Plus: false,
  commSegment: "all",
  ...BEAUTY_FILTER_DEFAULTS,
};

function isFiltersPristine(a) {
  return Object.keys(DEFAULT_CATEGORY_FILTERS).every((k) => a[k] === DEFAULT_CATEGORY_FILTERS[k]);
}

function clientFilterList(items, { city, priceFrom, priceTo, q, excludeQ }) {
  let data = [...items];
  const cityTrim = city.trim().toLowerCase();
  if (cityTrim) {
    data = data.filter((l) => (l.city || "").toLowerCase().includes(cityTrim));
  }
  const from = priceFrom.trim() ? Number(priceFrom) : null;
  const to = priceTo.trim() ? Number(priceTo) : null;
  if (from != null && !Number.isNaN(from)) {
    data = data.filter((l) => (l.price != null ? Number(l.price) >= from : false));
  }
  if (to != null && !Number.isNaN(to)) {
    data = data.filter((l) => (l.price != null ? Number(l.price) <= to : false));
  }
  const qt = q.trim().toLowerCase();
  if (qt) {
    data = data.filter(
      (l) =>
        (l.title || "").toLowerCase().includes(qt) || (l.description || "").toLowerCase().includes(qt)
    );
  }
  if (excludeQ && excludeQ.trim()) {
    const bad = excludeQ
      .toLowerCase()
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2);
    if (bad.length) {
      data = data.filter((l) => {
        const t = `${l.title || ""} ${l.description || ""}`.toLowerCase();
        return !bad.some((w) => t.includes(w));
      });
    }
  }
  return data;
}

function companyHeuristic(listing) {
  const t = `${listing.title || ""} ${listing.description || ""}`;
  return /ООО|ОсОО|ИП\b|компани|бригад|студия|агентств/i.test(t);
}

function mockStars(listing) {
  return (Number(listing.id) % 5) + 1;
}

/** Доп. фильтры без полей в API — на стороне клиента (на странице онлайн уточняют только текущую выборку). */
function applyClientPostFilters(items, a) {
  let rows = [...items];
  if (!a.cbPrivate && !a.cbCompany) return [];
  if (a.cbPrivate && !a.cbCompany) {
    rows = rows.filter((x) => !companyHeuristic(x));
  } else if (!a.cbPrivate && a.cbCompany) {
    rows = rows.filter((x) => companyHeuristic(x));
  }
  if (a.execSegment === "private") rows = rows.filter((x) => !companyHeuristic(x));
  if (a.execSegment === "company") rows = rows.filter((x) => companyHeuristic(x));
  if (a.reliableOnly) rows = rows.filter((x) => Number(x.id) % 4 !== 0);
  if (a.stars4Plus) rows = rows.filter((x) => mockStars(x) >= 4);
  return rows;
}

function clientSortList(items, sortBy, sortOrder) {
  const dir = sortOrder === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    if (sortBy === "price") {
      return ((a.price ?? 0) - (b.price ?? 0)) * dir;
    }
    if (sortBy === "views_count") {
      return ((a.views_count || 0) - (b.views_count || 0)) * dir;
    }
    return (new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()) * dir;
  });
}

export default function CategoryPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const sectionRaw = router.query.section;
  const sectionKey =
    typeof sectionRaw === "string" && sectionRaw.trim() ? sectionRaw.trim() : "services";

  const { lang } = useLanguage();
  const [resolvedCategoryName, setResolvedCategoryName] = useState("");
  const offlineSeedRef = useRef([]);

  const [listings, setListings] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [offlineMode, setOfflineMode] = useState(false);

  const [draft, setDraft] = useState(DEFAULT_CATEGORY_FILTERS);
  const [applied, setApplied] = useState(DEFAULT_CATEGORY_FILTERS);
  const [heroBroken, setHeroBroken] = useState(false);

  const catalogBreadcrumbLabel =
    CATALOG_SECTION_TITLES[sectionKey]?.[lang] ||
    CATALOG_SECTION_TITLES[sectionKey]?.ru ||
    (lang === "tj" ? "Феҳрист" : "Каталог");
  const showBeautyFilters = sectionKey === "services" && isBeautyServicesSlug(slug);

  /** Цепочка от корня дерева до текущей страницы (главная категория → подкатегория). */
  const categoryTrail = useMemo(
    () => findCategoryTrail(fallbackCategoriesBySection[sectionKey] || [], slug),
    [sectionKey, slug]
  );

  const prettySlug = useMemo(() => {
    const last = Array.isArray(categoryTrail) && categoryTrail.length ? categoryTrail[categoryTrail.length - 1] : null;
    if (last) {
      return lang === "tj" ? last.name_tj || last.name_ru : last.name_ru;
    }
    return resolvedCategoryName || slug.replaceAll("-", " ");
  }, [categoryTrail, resolvedCategoryName, slug, lang]);

  useEffect(() => {
    if (!router.isReady || !slug) return;
    if (SERVICES_BEAUTY_ONLY && !isCategoryRouteAllowed(slug)) {
      router.replace("/categories/krasota?section=services");
    }
  }, [router, router.isReady, slug]);

  useEffect(() => {
    if (!slug || !sectionKey) return;
    let cancelled = false;
    function findCategoryName(tree, targetSlug) {
      for (const node of tree || []) {
        if (node.slug === targetSlug) return node.name_ru;
        const fromChild = findCategoryName(node.children || [], targetSlug);
        if (fromChild) return fromChild;
      }
      return null;
    }
    (async () => {
      try {
        const categoriesRes = await fetch(`${API_URL}/categories?section=${sectionKey}`);
        if (categoriesRes.ok && !cancelled) {
          const categoriesPayload = await categoriesRes.json();
          const found = findCategoryName(categoriesPayload, slug);
          if (found) setResolvedCategoryName(found);
        }
      } catch {
        const fallbackCategoryName = findCategoryName(fallbackCategoriesBySection[sectionKey] || [], slug);
        if (fallbackCategoryName && !cancelled) setResolvedCategoryName(fallbackCategoryName);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, sectionKey]);

  useEffect(() => {
    setHeroBroken(false);
  }, [slug]);

  useEffect(() => {
    if (!offlineMode && page === 1 && isFiltersPristine(applied) && listings.length) {
      offlineSeedRef.current = [...listings];
    }
  }, [offlineMode, page, applied, listings, slug, sectionKey]);
  const sellerNames = ["Ирина", "Фаррух", "Мунира", "Алишер", "Ситора", "Рустам"];

  const toImageUrl = useCallback(
    (value) => (value && value.startsWith("http") ? value : `${API_URL}${value || ""}`),
    []
  );

  const appliedRef = useRef(applied);
  appliedRef.current = applied;

  useEffect(() => {
    if (!router.isReady || !slug) return;
    let cancelled = false;
    async function run() {
      setLoading(true);
      const a = appliedRef.current;
      try {
        const params = new URLSearchParams({
          section: sectionKey,
          include_subcategories: String(a.includeSubcats),
          page: String(page),
          page_size: String(PAGE_SIZE),
          sort_by: a.sortBy,
          sort_order: a.sortOrder,
        });
        if (a.city.trim()) params.append("city", a.city.trim());
        if (a.priceFrom.trim()) params.append("price_from", a.priceFrom.trim());
        if (a.priceTo.trim()) params.append("price_to", a.priceTo.trim());
        if (a.q.trim()) params.append("q", a.q.trim());
        if (a.excludeQ.trim()) params.append("exclude_q", a.excludeQ.trim());

        const res = await fetch(`${API_URL}/categories/${encodeURIComponent(slug)}/listings?${params}`);
        if (!res.ok) throw new Error("bad response");
        const data = await res.json();
        if (cancelled) return;
        setOfflineMode(false);
        setListings(data.items || []);
        setTotal(data.total ?? 0);
      } catch {
        if (cancelled) return;
        setOfflineMode(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [
    router.isReady,
    slug,
    sectionKey,
    page,
    applied.city,
    applied.priceFrom,
    applied.priceTo,
    applied.q,
    applied.excludeQ,
    applied.sortBy,
    applied.sortOrder,
    applied.includeSubcats,
  ]);

  useEffect(() => {
    if (!offlineMode) return;
    const a = applied;
    const seed =
      offlineSeedRef.current.length > 0
        ? offlineSeedRef.current
        : fallbackListings
            .filter((item) => item.section === sectionKey && item.category_slug === slug)
            .map((item) => ({
              ...item,
              image_urls: item.cover_image_url ? [item.cover_image_url] : [],
              views_count: 0,
              created_at: new Date().toISOString(),
            }));
    let data = clientFilterList(seed, {
      city: a.city,
      priceFrom: a.priceFrom,
      priceTo: a.priceTo,
      q: a.q,
      excludeQ: a.excludeQ,
    });
    data = clientSortList(data, a.sortBy, a.sortOrder);
    data = applyClientPostFilters(data, a);
    if (sectionKey === "services" && isBeautyServicesSlug(slug)) {
      data = applyBeautyPostFilters(data, a);
    }
    const start = (page - 1) * PAGE_SIZE;
    setTotal(data.length);
    setListings(data.slice(start, start + PAGE_SIZE));
  }, [
    offlineMode,
    page,
    slug,
    sectionKey,
    applied.city,
    applied.priceFrom,
    applied.priceTo,
    applied.q,
    applied.excludeQ,
    applied.sortBy,
    applied.sortOrder,
    applied.includeSubcats,
    applied.cbPrivate,
    applied.cbCompany,
    applied.reliableOnly,
    applied.execSegment,
    applied.stars4Plus,
    applied.beautyServiceType,
    applied.needToday,
    applied.needTomorrow,
    applied.beautyPromoOnly,
    applied.beautyOnlineBooking,
    applied.beautyGender,
    applied.beautyAudience,
    applied.beautyExperience,
    applied.beautyPlaceHome,
    applied.beautyPlaceMasterHome,
    applied.beautyPlaceSalon,
    applied.beautyPlaceCowork,
    applied.beautyPlaceStudio,
  ]);

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE));

  function updateDraft(patch) {
    setDraft((d) => ({ ...d, ...patch }));
  }

  function applyFilters() {
    setApplied({ ...draft });
    setPage(1);
    if (typeof document !== "undefined") {
      document.getElementById("category-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function resetFilters() {
    setDraft(DEFAULT_CATEGORY_FILTERS);
    setApplied(DEFAULT_CATEGORY_FILTERS);
    setPage(1);
  }

  function previewServices(basePrice) {
    const base = Number(basePrice || 0);
    if (!base) return [];
    return [
      { title: lang === "tj" ? "Аксияи хизматрасонӣ" : "Акция по услуге", price: base },
      { title: lang === "tj" ? "Бастаи васеътар" : "Расширенный пакет", price: base + 2000 },
    ];
  }

  const displayListings = useMemo(() => {
    let raw = offlineMode ? listings : applyClientPostFilters(listings, applied);
    if (showBeautyFilters) {
      raw = applyBeautyPostFilters(raw, applied);
    }
    return raw.map((item) => ({
      ...item,
      cover_image_url: item.cover_image_url ? toImageUrl(item.cover_image_url) : "",
    }));
  }, [listings, offlineMode, applied, toImageUrl, showBeautyFilters]);

  if (!router.isReady || !slug) {
    return null;
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page category-page">
        <AppHeader />

        <main className="category-content avito-category-page">
          <nav className="breadcrumbs" aria-label={lang === "tj" ? "Нишонҳои роҳ" : "Хлебные крошки"}>
            <Link href="/">{lang === "tj" ? "Саҳифаи асосӣ" : "Главная"}</Link>
            <span className="breadcrumbs-sep"> / </span>
            <Link href={`/?section=${sectionKey}`}>{catalogBreadcrumbLabel}</Link>
            {categoryTrail?.length
              ? categoryTrail.map((crumb, idx) => {
                  const isLast = idx === categoryTrail.length - 1;
                  const crumbLabel = lang === "tj" ? crumb.name_tj || crumb.name_ru : crumb.name_ru;
                  return (
                    <Fragment key={crumb.slug}>
                      <span className="breadcrumbs-sep"> / </span>
                      {isLast ? (
                        <span className="breadcrumbs-current">{crumbLabel}</span>
                      ) : (
                        <Link href={buildCategoryHref(crumb.slug, sectionKey)}>{crumbLabel}</Link>
                      )}
                    </Fragment>
                  );
                })
              : (
                  <>
                    <span className="breadcrumbs-sep"> / </span>
                    <span className="breadcrumbs-current">{prettySlug}</span>
                  </>
                )}
          </nav>

          {categoryTrail && categoryTrail.length >= 2 ? (
            <p className="category-hierarchy-hint">
              {lang === "tj" ? "Категорияи асосӣ: " : "Главная категория: "}
              <Link href={buildCategoryHref(categoryTrail[0].slug, sectionKey)}>
                {lang === "tj" ? categoryTrail[0].name_tj || categoryTrail[0].name_ru : categoryTrail[0].name_ru}
              </Link>
              <span className="category-hierarchy-hint-sep"> · </span>
              {lang === "tj" ? "Зеркатегория: " : "подкатегория: "}
              <strong>{lang === "tj" ? categoryTrail[categoryTrail.length - 1].name_tj || categoryTrail[categoryTrail.length - 1].name_ru : categoryTrail[categoryTrail.length - 1].name_ru}</strong>
            </p>
          ) : null}

          <h1 className="category-title">{lang === "tj" ? `Эълонҳо: ${prettySlug}` : `Объявления: ${prettySlug}`}</h1>
          <p className="category-subtitle">
            {lang === "tj" ? "Маҷмӯи пешниҳодҳои мубрам бо тамосҳои мустақими иҷрокунандагон." : "Подборка актуальных предложений с прямыми контактами исполнителей."}
          </p>
          {process.env.NODE_ENV === "development" ? (
            <aside className="category-dev-notice" role="note">
              <strong>{lang === "tj" ? "Режими таҳия:" : "Режим разработки:"}</strong>{" "}
              {lang === "tj" ? (
                <>
                  саҳифа бо сутуни чапи филтрҳо ва тугмаи «Нишон додани ... эълонҳо». Оғоз кунед{" "}
                  <code>npm run dev</code> аз папкаи <code>Без названия/frontend</code> (порт <strong>3000</strong>). Агар намуди кӯҳнаро
                  бинед — иҷро кунед <code>npm run dev:clear</code> ва браузерро бо тоза кардани кэш нав кунед (Cmd+Shift+R / Ctrl+Shift+R).
                </>
              ) : (
                <>
                  страница с левой колонкой фильтров и кнопкой «Показать … объявлений». Запускайте <code>npm run dev</code> из папки{" "}
                  <code>Без названия/frontend</code> (порт <strong>3000</strong>). Если видите старый вид — выполните{" "}
                  <code>npm run dev:clear</code> и обновите браузер с очисткой кэша (Cmd+Shift+R / Ctrl+Shift+R).
                </>
              )}
            </aside>
          ) : null}
          <div className="category-hero-visual">
            {!heroBroken ? (
              <img
                src={CONTENT_IMAGES.category}
                alt=""
                className="category-hero-img"
                width={1320}
                height={280}
                loading="lazy"
                onError={() => setHeroBroken(true)}
              />
            ) : (
              <div className="category-hero-img category-hero-img--fallback" aria-hidden />
            )}
            <p className="category-hero-caption">
              {lang === "tj"
                ? "Тавсифҳои рост ва аксҳо ёрӣ медиҳанд, зудтар он чизеро пайдо кунед, ки ба шумо лозим аст."
                : "Честные описания и фото помогают быстрее найти то, что нужно."}
            </p>
          </div>

          {slug === BEAUTY_PARENT_SLUG && sectionKey === "services" ? (
            <section className="beauty-landing" aria-label={lang === "tj" ? "Зербахшҳои «Зебоӣ»" : "Подразделы «Красота»"}>
              <div className="beauty-landing-grid">
                {BEAUTY_SUBCATEGORIES.map((c) => (
                  <Link
                    key={c.slug}
                    href={buildCategoryHref(c.slug, sectionKey)}
                    className="beauty-landing-card"
                  >
                    <span className="beauty-landing-card-text">
                      <span className="beauty-landing-card-title">
                        {lang === "tj" ? c.title_tj || c.title_ru || c.title : c.title_ru || c.title || c.title_tj}
                      </span>
                    </span>
                    <span className="beauty-landing-card-icon" aria-hidden>
                      <CategoryStripIcon slug={c.slug} size={26} />
                    </span>
                  </Link>
                ))}
                <Link
                  href={`/?section=${sectionKey}#youla-categories`}
                  className="beauty-landing-card beauty-landing-card--all"
                >
                  <span className="beauty-landing-card-title">{lang === "tj" ? "Ҳамаи категорияҳо" : "Все категории"}</span>
                </Link>
              </div>

              <div className="beauty-landing-search">
                <h3 className="beauty-landing-search-title">
                  {lang === "tj" ? "Ҷустуҷӯи иҷрокунанда" : "Поиск исполнителя"}
                </h3>
                <div className="beauty-landing-search-row">
                  <input
                    type="search"
                    className="beauty-landing-search-input"
                    placeholder={lang === "tj" ? "Хизмат ё мутахассис" : "Услуга или специалист"}
                    value={draft.q}
                    onChange={(e) => updateDraft({ q: e.target.value })}
                    autoComplete="off"
                  />
                  <label className="beauty-landing-search-city">
                    <span className="visually-hidden">{lang === "tj" ? "Шаҳр" : "Город"}</span>
                    <select
                      className="beauty-landing-search-select"
                      value={draft.city}
                      onChange={(e) => updateDraft({ city: e.target.value })}
                      aria-label={lang === "tj" ? "Радиус, ноҳия" : "Радиус, район"}
                    >
                      <option value="">{lang === "tj" ? "Радиус, ноҳия" : "Радиус, район"}</option>
                      {CITIES.filter(Boolean).map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="beauty-landing-search-actions">
                  <button type="button" className="beauty-landing-search-btn beauty-landing-search-btn--primary" onClick={applyFilters} disabled={loading}>
                    {loading
                      ? lang === "tj"
                        ? "Бор карда мешавад…"
                        : "Загрузка…"
                      : total > 1000
                        ? lang === "tj"
                          ? `Намоиш додани бештар ${Math.floor(total / 1000)} ҳазор эълон`
                          : `Показать больше ${Math.floor(total / 1000)} тыс. объявлений`
                        : total > 0
                          ? lang === "tj"
                            ? `Намоиш додани ${formatIntegerGrouped(total)} эълон`
                            : `Показать ${formatIntegerGrouped(total)} объявлений`
                          : lang === "tj"
                            ? "Намоиши эълонҳо"
                            : "Показать объявления"}
                  </button>
                  <button
                    type="button"
                    className="beauty-landing-search-btn beauty-landing-search-btn--map"
                    onClick={() => {
                      document.querySelector(".listings-map-preview")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                    }}
                  >
                    <HiOutlineMapPin className="beauty-map-btn-icon" size={18} aria-hidden />{" "}
                    {lang === "tj" ? "Дар харита" : "На карте"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <div className="category-catalog-layout">
            <aside className="category-filters-sidebar" aria-label={lang === "tj" ? "Филтрҳои каталог" : "Фильтры каталога"}>
              <div className={`category-filters-card cat-filters-ref${showBeautyFilters ? " cat-filters-ref--beauty" : ""}`}>
                {!showBeautyFilters ? (
                  <>
                    <h2 className="category-filters-heading">{lang === "tj" ? "Филтрҳо" : "Фильтры"}</h2>
                    <p className="category-filters-hint">
                      {lang === "tj"
                        ? "Шартҳоро танзим кунед ва «Эълонҳоро нишон диҳед» -ро пахш кунед. Бе имконоти серверӣ, филтрҳо аз рӯи навъи иҷрокунанда ва рейтинг танҳо саҳифаи ҷории натиҷаҳоро дақиқ мекунанд."
                        : "Настройте условия и нажмите «Показать объявления». Без серверных полей фильтры по типу исполнителя и рейтингу уточняют только текущую страницу выдачи."}
                    </p>

                    <div className="cat-filter-section">
                      <div className="cat-filter-section-head">
                        <h3 className="cat-filter-section-title">{lang === "tj" ? "Кӣ хизмат мерасонад" : "Кто оказывает услуги"}</h3>
                        <span className="cat-filter-new-badge">{lang === "tj" ? "Нав" : "Новое"}</span>
                      </div>
                      <label className="category-filter-checkbox cat-filter-checkbox-square">
                        <input
                          type="checkbox"
                          checked={draft.cbPrivate}
                          onChange={(e) => updateDraft({ cbPrivate: e.target.checked })}
                        />
                        <span>{lang === "tj" ? "Иҷрокунандаи хусусӣ" : "Частный исполнитель"}</span>
                      </label>
                      <label className="category-filter-checkbox cat-filter-checkbox-square">
                        <input
                          type="checkbox"
                          checked={draft.cbCompany}
                          onChange={(e) => updateDraft({ cbCompany: e.target.checked })}
                        />
                        <span>{lang === "tj" ? "Ширкат ё гурӯҳ" : "Компания или команда"}</span>
                      </label>
                    </div>

                    <div className="cat-filter-reliable-card">
                      <div className="cat-filter-reliable-icon" aria-hidden>
                        <HiOutlineTrophy size={22} />
                      </div>
                      <div className="cat-filter-reliable-text">
                        <div className="cat-filter-reliable-title">{lang === "tj" ? "Иҷрокунандаи боэътимод" : "Надёжный исполнитель"}</div>
                        <div className="cat-filter-reliable-sub">{lang === "tj" ? "Репутацияро нигоҳ медорад" : "Следит за репутацией"}</div>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={draft.reliableOnly}
                        className={`cat-filter-toggle ${draft.reliableOnly ? "is-on" : ""}`}
                        onClick={() => updateDraft({ reliableOnly: !draft.reliableOnly })}
                      />
                    </div>

                    <div className="cat-filter-section">
                      <h3 className="cat-filter-section-title">{lang === "tj" ? "Шаҳр" : "Город"}</h3>
                      <label className="category-filter-field cat-filter-field-plain">
                        <select value={draft.city} onChange={(e) => updateDraft({ city: e.target.value })}>
                          <option value="">{lang === "tj" ? "Ҳама шаҳрҳо" : "Все города"}</option>
                          {CITIES.filter(Boolean).map((c) => (
                            <option value={c} key={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="cat-filter-section">
                      <h3 className="cat-filter-section-title">{lang === "tj" ? "Нарх, сом." : "Стоимость, сом."}</h3>
                      <div className="category-filter-price-row cat-filter-price-row">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder={lang === "tj" ? "Аз" : "От"}
                          value={draft.priceFrom}
                          onChange={(e) => updateDraft({ priceFrom: e.target.value })}
                        />
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          placeholder={lang === "tj" ? "То" : "до"}
                          value={draft.priceTo}
                          onChange={(e) => updateDraft({ priceTo: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="cat-filter-section">
                      <h3 className="cat-filter-section-title">{lang === "tj" ? "Иҷрокунандагон" : "Исполнители"}</h3>
                      <div className="cat-filter-segment-group" role="group" aria-label={lang === "tj" ? "Навъи иҷрокунанда" : "Тип исполнителя"}>
                        {[
                          { k: "all", l: lang === "tj" ? "Ҳама" : "Все" },
                          { k: "private", l: lang === "tj" ? "Хусусӣ" : "Частные" },
                          { k: "company", l: lang === "tj" ? "Ширкатҳо" : "Компании" },
                        ].map(({ k, l }) => (
                          <button
                            key={k}
                            type="button"
                            className={`cat-filter-seg ${draft.execSegment === k ? "is-active" : ""}`}
                            onClick={() => updateDraft({ execSegment: k })}
                          >
                            {l}
                          </button>
                        ))}
                      </div>
                      <label className="category-filter-checkbox cat-filter-checkbox-square">
                        <input
                          type="checkbox"
                          checked={draft.stars4Plus}
                          onChange={(e) => updateDraft({ stars4Plus: e.target.checked })}
                        />
                        <span>{lang === "tj" ? "4 ситора ва бештар" : "4 звезды и выше"}</span>
                      </label>
                    </div>

                    <div className="cat-filter-section">
                      <h3 className="cat-filter-section-title">{lang === "tj" ? "Калимаҳо дар тавсиф" : "Слова в описании"}</h3>
                      <input
                        type="search"
                        className="cat-filter-input-full"
                        placeholder={lang === "tj" ? "Барои шумо чизи муҳим" : "Что-то важное для вас"}
                        value={draft.q}
                        onChange={(e) => updateDraft({ q: e.target.value })}
                        autoComplete="off"
                      />
                    </div>
                  </>
                ) : (
                  <BeautyCategoryFilterPanel
                    draft={draft}
                    updateDraft={updateDraft}
                    slug={slug}
                    prettySlug={prettySlug}
                    sectionKey={sectionKey}
                    cities={CITIES}
                  />
                )}

                <div className="cat-filter-section">
                  <h3 className="cat-filter-section-title">{lang === "tj" ? "Пинҳон кардани эълонҳо бо калимаҳо" : "Скрыть объявления со словами"}</h3>
                  <input
                    type="search"
                    className="cat-filter-input-full"
                    placeholder={lang === "tj" ? "Чизе, ки ба шумо лозим нест" : "То, что вам не нужно"}
                    value={draft.excludeQ}
                    onChange={(e) => updateDraft({ excludeQ: e.target.value })}
                    autoComplete="off"
                  />
                </div>

                <div className="cat-filter-section">
                  <h3 className="cat-filter-section-title">{lang === "tj" ? "Усулҳои тамос" : "Способы связи"}</h3>
                  <div className="cat-filter-segment-group" role="group" aria-label={lang === "tj" ? "Усулҳои тамос" : "Способы связи"}>
                    {[
                      { k: "all", l: lang === "tj" ? "Ҳама" : "Все" },
                      { k: "calls", l: lang === "tj" ? "Зангҳо" : "Звонки" },
                      { k: "messages", l: lang === "tj" ? "Паёмҳо" : "Сообщения" },
                    ].map(({ k, l }) => (
                      <button
                        key={k}
                        type="button"
                        className={`cat-filter-seg ${draft.commSegment === k ? "is-active" : ""}`}
                        onClick={() => updateDraft({ commSegment: k })}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cat-filter-section cat-filter-section--muted">
                  <h3 className="cat-filter-section-title">{lang === "tj" ? "Бештар" : "Ещё"}</h3>
                  <label className="category-filter-checkbox">
                    <input
                      type="checkbox"
                      checked={draft.includeSubcats}
                      onChange={(e) => updateDraft({ includeSubcats: e.target.checked })}
                    />
                    <span>{lang === "tj" ? "Ҳамроҳ бо зеркатегорияҳо" : "Включая подкатегории"}</span>
                  </label>
                  <label className="category-filter-field cat-filter-field-plain cat-filter-sort-field">
                    <span className="cat-filter-field-heading">{lang === "tj" ? "Ҷудокунӣ" : "Сортировка"}</span>
                    <select value={draft.sortBy} onChange={(e) => updateDraft({ sortBy: e.target.value })}>
                      <option value="created_at">{lang === "tj" ? "Аз рӯи сана" : "По дате"}</option>
                      <option value="price">{lang === "tj" ? "Аз рӯи нарх" : "По цене"}</option>
                      <option value="views_count">{lang === "tj" ? "Аз рӯи тамошо" : "По просмотрам"}</option>
                    </select>
                  </label>
                  <label className="category-filter-field cat-filter-field-plain cat-filter-sort-field">
                    <span className="cat-filter-field-heading">{lang === "tj" ? "Тартиб" : "Порядок"}</span>
                    <select value={draft.sortOrder} onChange={(e) => updateDraft({ sortOrder: e.target.value })}>
                      <option value="desc">{lang === "tj" ? "Бо камшавӣ" : "По убыванию"}</option>
                      <option value="asc">{lang === "tj" ? "Бо афзоиш" : "По возрастанию"}</option>
                    </select>
                  </label>
                </div>

                <button
                  type="button"
                  className={`cat-filter-apply-btn${showBeautyFilters ? " cat-filter-apply-btn--beauty" : ""}`}
                  onClick={applyFilters}
                  disabled={loading}
                >
                  {loading
                    ? lang === "tj"
                      ? "Бор карда мешавад…"
                      : "Загрузка…"
                    : total > 0
                      ? lang === "tj"
                        ? `Намоиш додани ${formatIntegerGrouped(total)} эълонҳо`
                        : `Показать ${formatIntegerGrouped(total)} объявлений`
                      : lang === "tj"
                        ? "Эълонҳоро нишон диҳед"
                        : "Показать объявления"}
                </button>
                <button type="button" className="category-filters-reset ghost cat-filter-reset-link" onClick={resetFilters}>
                  {lang === "tj" ? "Аз нав танзим кардан" : "Сбросить"}
                </button>

                {offlineMode ? (
                  <p className="category-filters-offline">
                    {lang === "tj" ? "Алоқа бо сервер нест — маълумот аз кэши саҳифа." : "Нет связи с сервером — данные из кэша страницы."}
                  </p>
                ) : null}
              </div>
            </aside>

            <div className="category-catalog-main" id="category-results">
              <ListingsMapPreview
                city={displayListings[0]?.city || applied.city || "Душанбе"}
                title={lang === "tj" ? `Пешниҳодҳо · ${prettySlug}` : `Предложения · ${prettySlug}`}
                items={displayListings}
              />

              <div className="listings-head category-head category-head-bar">
                <div className="listings-title-wrap">
                  <div className="category-stats">
                    {loading ? (
                      lang === "tj" ? "Бор карда мешавад…" : "Загрузка…"
                    ) : !offlineMode && listings.length > 0 && displayListings.length < listings.length ? (
                      <>
                        {lang === "tj" ? `Ҳамагӣ аз рӯи дархост: ${total}` : `Всего по запросу: ${total}`}
                        <span className="category-stats-sub">
                          {" "}
                          {lang === "tj" ? `· дар саҳифа пас аз дақиқсозӣ: ${displayListings.length} аз ${listings.length}` : `· на странице после уточнения: ${displayListings.length} из ${listings.length}`}
                        </span>
                      </>
                    ) : (
                      lang === "tj" ? `Ёфт шуд: ${total} эълон` : `Найдено объявлений: ${total}`
                    )}
                  </div>
                  <span className="results-badge">{lang === "tj" ? `${total} натиҷа` : `${total} результатов`}</span>
                </div>
                <div className="category-head-sorts" aria-label={lang === "tj" ? "Ҷудокунӣ аз рӯи эълонҳо" : "Сортировка объявлений"}>
                  <select
                    className="category-head-sort-select"
                    value={draft.sortBy}
                    onChange={(e) => updateDraft({ sortBy: e.target.value })}
                  >
                    <option value="created_at">{lang === "tj" ? "Аз рӯи сана" : "По дате"}</option>
                    <option value="price">{lang === "tj" ? "Аз рӯи нарх" : "По цене"}</option>
                    <option value="views_count">{lang === "tj" ? "Аз рӯи тамошо" : "По просмотрам"}</option>
                  </select>
                  <select
                    className="category-head-sort-select"
                    value={draft.sortOrder}
                    onChange={(e) => updateDraft({ sortOrder: e.target.value })}
                  >
                    <option value="desc">{lang === "tj" ? "Бо камшавӣ" : "По убыванию"}</option>
                    <option value="asc">{lang === "tj" ? "Бо афзоиш" : "По возрастанию"}</option>
                  </select>
                </div>
              </div>

              <div className="avito-list">
                {displayListings.map((listing) => (
                  <Link href={`/listings/${listing.id}`} key={listing.id} className="card avito-card-row">
                    {listing.cover_image_url ? (
                      <img className="listing-image avito-thumb" src={toImageUrl(listing.cover_image_url)} alt={listing.title} />
                    ) : (
                      <div className="placeholder-image avito-thumb">{lang === "tj" ? "Акс" : "Фото"}</div>
                    )}
                    <div className="avito-card-content">
                      <div className="card-title preview-title">
                        {listing.title}
                        {listing.is_promoted ? (
                          <span className="youla-promo-pill youla-promo-pill--compact">
                            <span className="youla-promo-pill__icon" aria-hidden>
                              ✦
                            </span>
                            {lang === "tj" ? "Дар топ" : "В топе"}
                          </span>
                        ) : null}
                      </div>
                      <div className="card-price preview-price">{formatPriceFrom(listing.price, lang)}</div>
                      <div className="preview-offers">
                        {previewServices(listing.price).map((offer) => (
                          <div className="preview-offer-row" key={offer.title}>
                            <span>{offer.title}</span>
                            <strong>{formatPrice(offer.price, lang)}</strong>
                          </div>
                        ))}
                      </div>
                      <div className="card-city preview-district">{listing.city}</div>
                      <div className="avito-desc preview-desc">{listing.description}</div>
                      <div className="avito-tags preview-tags">
                        <span className="tag-soft">{lang === "tj" ? "Иҷрокунандаи боэътимод" : "Надежный исполнитель"}</span>
                        <span className="tag-soft">{lang === "tj" ? "Ҳуҷҷатҳо санҷида шудаанд" : "Документы проверены"}</span>
                      </div>
                    </div>
                    <div className="avito-card-right preview-seller-card">
                      <div className="preview-seller-name">{sellerNames[listing.id % sellerNames.length]}</div>
                      <div className="preview-seller-rating">
                        <HiOutlineStar className="preview-rating-star" size={16} aria-hidden /> 5,0 ·{" "}
                        {12 + (listing.id % 15)} {lang === "tj" ? "шарҳҳо" : "отзывов"}
                      </div>
                      <div className="preview-seller-badges">
                        <span>{lang === "tj" ? "Иҷрокунандаи боэътимод" : "Надежный исполнитель"}</span>
                        <span>{lang === "tj" ? "Ҳуҷҷатҳо санҷида шудаанд" : "Документы проверены"}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {!loading && displayListings.length === 0 ? (
                <p className={`empty-tip ${total === 0 && isFiltersPristine(applied) ? "empty-tip--category" : ""}`}>
                  {total === 0 && isFiltersPristine(applied)
                    ? lang === "tj"
                      ? "Ҳоло дар ин зербахш эълонҳо нестанд."
                      : "Пока нет объявлений в этом подразделе."
                    : lang === "tj"
                      ? "Мувофиқи филтрҳои интихобшуда эълонҳо нестанд. Шартҳоро тағйир диҳед."
                      : "По заданным фильтрам объявлений нет. Попробуйте изменить условия."}
                </p>
              ) : null}

              {totalPages > 1 ? (
                <div className="category-pagination youla-pagination">
                  <button
                    type="button"
                    className="youla-page-btn"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    {lang === "tj" ? "Қафо" : "Назад"}
                  </button>
                  <span className="youla-page-info">
                    {lang === "tj" ? `Саҳифа ${page} аз ${totalPages}` : `Страница ${page} из ${totalPages}`}
                  </span>
                  <button
                    type="button"
                    className="youla-page-btn"
                    disabled={page >= totalPages || loading}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    {lang === "tj" ? "Баъдӣ" : "Вперёд"}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
