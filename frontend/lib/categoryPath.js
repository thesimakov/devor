/**
 * Цепочка категорий от корня дерева до узла с slug (включительно).
 * @param {Array<{ slug: string, name_ru: string, name_tj?: string, children?: any[] }>} nodes
 * @param {string} targetSlug
 * @param {Array<{ slug: string, name_ru: string, name_tj?: string }>} [ancestors]
 * @returns {Array<{ slug: string, name_ru: string, name_tj?: string }>} | null
 */
export function findCategoryTrail(nodes, targetSlug, ancestors = []) {
  if (!targetSlug || !Array.isArray(nodes)) return null;
  for (const n of nodes) {
    const step = { slug: n.slug, name_ru: n.name_ru, name_tj: n.name_tj };
    if (n.slug === targetSlug) {
      return [...ancestors, step];
    }
    if (n.children?.length) {
      const found = findCategoryTrail(n.children, targetSlug, [...ancestors, step]);
      if (found) return found;
    }
  }
  return null;
}
