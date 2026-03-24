/**
 * Глубокое слияние объектов (для сборки модульных locale-файлов).
 * Массивы не сливаются — перезаписываются значением из правого аргумента.
 */
export function deepMerge(target, ...sources) {
  let out = target && typeof target === "object" ? { ...target } : {};
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of Object.keys(src)) {
      const sv = src[key];
      const ov = out[key];
      if (sv && typeof sv === "object" && !Array.isArray(sv) && ov && typeof ov === "object" && !Array.isArray(ov)) {
        out[key] = deepMerge(ov, sv);
      } else {
        out[key] = sv;
      }
    }
  }
  return out;
}
