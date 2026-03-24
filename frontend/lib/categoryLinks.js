/**
 * Единая сборка ссылок на страницу категории.
 * Используем query-роут `/categories?slug=...`, чтобы не ломались переходы
 * в окружениях, где динамический path может отдавать 404.
 */
export function buildCategoryHref(slug, section = "services") {
  return {
    pathname: "/categories",
    query: { slug, section },
  };
}
