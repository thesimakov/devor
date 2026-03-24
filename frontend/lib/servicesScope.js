/**
 * Временный режим каталога: только услуги красоты (ветка «Красота» в дереве).
 * Полное дерево категорий и данные в `servicesCategoryTree` / API не удаляются —
 * установите `SERVICES_BEAUTY_ONLY = false`, чтобы снова показать все услуги.
 */
import { BEAUTY_PARENT_SLUG } from "./beautyCategoryLanding";
import { isBeautyServicesSlug } from "./beautySubcategoryFilters";

export const SERVICES_BEAUTY_ONLY = true;

/** Оставить в дереве только узел «Красота» с подкатегориями. */
export function filterCategoryTreeToBeautyOnly(tree) {
  if (!SERVICES_BEAUTY_ONLY || !Array.isArray(tree)) return tree;
  const beauty = tree.find((n) => n && n.slug === BEAUTY_PARENT_SLUG);
  return beauty ? [beauty] : tree;
}

export function flattenCategoryNodes(nodes) {
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

/** Для полосы категорий на главной — только красота. */
export function categoriesForBeautyStrip(tree) {
  if (!SERVICES_BEAUTY_ONLY) return tree;
  return flattenCategoryNodes(filterCategoryTreeToBeautyOnly(tree)).filter(
    (c) => c.slug && isBeautyServicesSlug(c.slug)
  );
}

/** Фильтр fallback-объявлений (mock) по slug категории. */
export function filterMockListingsBeautyOnly(items) {
  if (!SERVICES_BEAUTY_ONLY || !Array.isArray(items)) return items;
  return items.filter((item) => item.category_slug && isBeautyServicesSlug(item.category_slug));
}

/** Параметр запроса к API ленты. */
export function listingsBeautyQueryParam() {
  return SERVICES_BEAUTY_ONLY ? "&beauty_scope=true" : "";
}

/** Разрешена ли страница категории (остальные скрыты, но маршрут остаётся). */
export function isCategoryRouteAllowed(slug) {
  if (!SERVICES_BEAUTY_ONLY) return true;
  return isBeautyServicesSlug(slug);
}
