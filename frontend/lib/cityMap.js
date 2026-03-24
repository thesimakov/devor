/**
 * Приблизительные координаты городов Таджикистана для статической карты OSM.
 * Точных координат объявления в API нет — привязка по полю city.
 */
const CITY_COORDS = {
  Душанбе: { lat: 38.5598, lng: 68.787, zoom: 12 },
  Худжанд: { lat: 40.285, lng: 69.622, zoom: 12 },
  Бохтар: { lat: 37.8364, lng: 68.7803, zoom: 12 },
  Кулоб: { lat: 37.9146, lng: 69.7849, zoom: 12 },
  Истаравшан: { lat: 39.9142, lng: 69.0014, zoom: 12 },
  Турсунзода: { lat: 38.5108, lng: 68.2303, zoom: 12 },
};

const DEFAULT = { lat: 38.5598, lng: 68.787, zoom: 11 };

export function getCityMapCoords(cityName) {
  if (!cityName || typeof cityName !== "string") return { ...DEFAULT };
  const key = cityName.trim();
  return CITY_COORDS[key] ? { ...CITY_COORDS[key] } : { ...DEFAULT };
}

/** Статичная карта OpenStreetMap (как на главной). */
export function buildStaticMapImageUrl(lat, lng, options = {}) {
  const zoom = options.zoom ?? 12;
  const w = options.width ?? 900;
  const h = options.height ?? 320;
  const marker = `${lat},${lng},blue`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=${w}x${h}&maptype=mapnik&markers=${marker}`;
}

/** Ссылка на интерактивную карту в браузере. */
export function buildOpenStreetMapLink(lat, lng, zoom = 12) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=${zoom}/${lat}/${lng}`;
}

/**
 * Встраиваемая карта OSM (часто работает, когда staticmap.openstreetmap.de недоступен).
 * bbox в формате minLon,minLat,maxLon,maxLat
 */
export function buildOsmEmbedUrl(lat, lng, zoom = 12) {
  const span = 0.42 / Math.max(1, zoom - 8);
  const minLon = lng - span;
  const maxLon = lng + span;
  const minLat = lat - span * 0.62;
  const maxLat = lat + span * 0.62;
  const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;
  const marker = `${lat},${lng}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
}
