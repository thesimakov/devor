/**
 * Ссылки на страницу категории: `/categories/[slug]?section=...` (совместимо со статическим экспортом).
 */
export function buildCategoryHref(slug, section = "services") {
  return `/categories/${encodeURIComponent(slug)}?section=${encodeURIComponent(section)}`;
}
