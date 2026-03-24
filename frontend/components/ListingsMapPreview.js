import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useLanguage } from "../contexts/LanguageContext";
import { buildOsmEmbedUrl, buildOpenStreetMapLink, buildStaticMapImageUrl, getCityMapCoords } from "../lib/cityMap";
import { formatPrice } from "../lib/i18n";

export default function ListingsMapPreview({ city = "Душанбе", items = [], onExpandChange }) {
  const { lang, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [staticMapFailed, setStaticMapFailed] = useState(false);
  const { lat, lng, zoom } = useMemo(() => getCityMapCoords(city), [city]);
  const mapImageUrl = useMemo(() => buildStaticMapImageUrl(lat, lng, { zoom, width: 1200, height: 260 }), [lat, lng, zoom]);
  const mapEmbedUrl = useMemo(() => buildOsmEmbedUrl(lat, lng, zoom), [lat, lng, zoom]);
  const mapOpenUrl = useMemo(() => buildOpenStreetMapLink(lat, lng, zoom), [lat, lng, zoom]);
  const visibleItems = useMemo(() => items.slice(0, 60), [items]);
  const cardTitle = t("home.mapCardTitle");

  useEffect(() => {
    setStaticMapFailed(false);
  }, [city, mapImageUrl]);

  useEffect(() => {
    if (!expanded) return undefined;
    setSidebarCollapsed(true);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expanded]);

  useEffect(() => {
    onExpandChange?.(expanded);
  }, [expanded, onExpandChange]);

  return (
    <>
      <section className={`listings-map-preview ${expanded ? "expanded" : ""}`} aria-label={t("map.sectionAria")}>
        <div className="listings-map-preview-head">
          <h3 className="listings-map-preview-title">{t("map.titleWithCity", { city })}</h3>
          {items.length === 0 ? <p className="listings-map-preview-hint">{t("map.emptyHint")}</p> : null}
        </div>
        <button type="button" className="listings-map-hitbox" onClick={() => setExpanded(true)} aria-label={t("map.openMapAria")}>
          {staticMapFailed ? (
            <iframe
              title={t("map.mapTitle", { city })}
              className="listings-map-embed"
              src={mapEmbedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          ) : (
            <img src={mapImageUrl} alt="" className="listings-map-image" onError={() => setStaticMapFailed(true)} />
          )}
        </button>
        {staticMapFailed ? (
          <a className="listings-map-open-link" href={mapOpenUrl} target="_blank" rel="noreferrer">
            {t("map.openOsm")}
          </a>
        ) : null}
        <button type="button" className="listings-map-cta" onClick={() => setExpanded(true)}>
          {t("map.showOnMap")}
        </button>
      </section>

      {expanded ? (
        <div className="map-fullscreen-overlay" role="dialog" aria-modal="true">
          <div className={`map-fullscreen-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
            <aside className="map-fullscreen-sidebar">
              <div className="map-fullscreen-head">
                <div>
                  <small>{cardTitle}</small>
                  <h3>{city}</h3>
                </div>
                <button type="button" className="map-close-btn" onClick={() => setExpanded(false)} aria-label={t("map.closeMapAria")}>
                  ×
                </button>
              </div>

              <div className="map-fullscreen-list">
                {visibleItems.map((item) => (
                  <Link href={`/listings/${item.id}`} key={item.id} className="map-listing-card" onClick={() => setExpanded(false)}>
                    {item.cover_image_url ? (
                      <img src={item.cover_image_url} alt={item.title} className="map-listing-thumb" />
                    ) : (
                      <div className="map-listing-thumb placeholder">{t("common.photo")}</div>
                    )}
                    <div className="map-listing-meta">
                      <div className="map-listing-title">{item.title}</div>
                      <div className="map-listing-price">{t("map.fromPrice", { price: formatPrice(item.price, lang) })}</div>
                      <div className="map-listing-city">{item.city}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </aside>

            <div className="map-fullscreen-map-wrap">
              <button type="button" className="map-toggle-sidebar-btn" onClick={() => setSidebarCollapsed((prev) => !prev)}>
                {sidebarCollapsed ? t("map.showList") : t("map.collapseList")}
              </button>
              <button type="button" className="map-close-btn map-close-btn-floating" onClick={() => setExpanded(false)} aria-label={t("map.closeMapAria")}>
                ×
              </button>
              {staticMapFailed ? (
                <iframe
                  title={t("map.mapTitle", { city })}
                  className="map-fullscreen-map-embed"
                  src={mapEmbedUrl}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              ) : (
                <img src={mapImageUrl} alt="" className="map-fullscreen-map-image" onError={() => setStaticMapFailed(true)} />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
