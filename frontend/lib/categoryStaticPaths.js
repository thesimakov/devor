import { fallbackCategoriesBySection } from "./mockData";
import { flattenCategoryNodes } from "./servicesScope";

/** Все slug из fallback-дерева — для `getStaticPaths` при статическом экспорте. */
export function getAllCategorySlugs() {
  const slugs = new Set();
  for (const sec of ["services", "realty", "transport"]) {
    const tree = fallbackCategoriesBySection[sec] || [];
    for (const node of flattenCategoryNodes(tree)) {
      if (node.slug) slugs.add(node.slug);
    }
  }
  return [...slugs];
}
