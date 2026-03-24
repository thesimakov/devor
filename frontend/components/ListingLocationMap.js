import { buildOpenStreetMapLink, buildStaticMapImageUrl, getCityMapCoords } from "../lib/cityMap";

/**
 * Статическая карта OSM по городу объявления (координаты из справочника городов Таджикистана).
 */
export default function ListingLocationMap({ city }) {
  const { lat, lng, zoom } = getCityMapCoords(city);
  const mapSrc = buildStaticMapImageUrl(lat, lng, { zoom, width: 960, height: 340 });
  const mapHref = buildOpenStreetMapLink(lat, lng, zoom);

  return (
    <div className="listing-location-map">
      <a
        href={mapHref}
        target="_blank"
        rel="noopener noreferrer"
        className="listing-location-map-link"
        aria-label={`Открыть карту OpenStreetMap: ${city}`}
      >
        <img src={mapSrc} alt={`Район объявления на карте: ${city}`} className="listing-location-map-img" loading="lazy" />
        <span className="listing-location-map-cta">Открыть интерактивную карту</span>
      </a>
      <p className="listing-location-map-note">Точка на карте — центр города «{city}». Уточняйте адрес у продавца.</p>
    </div>
  );
}
