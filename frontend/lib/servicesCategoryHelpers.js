/** Узел категории без id (id назначаются в servicesCategoryTree.js). */
export function cat(name_ru, slug, children) {
  return { name_ru, slug, children: children ?? [] };
}
