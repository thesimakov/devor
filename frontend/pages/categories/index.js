import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Раньше: query `/categories?slug=...`. Редирект на `/categories/[slug]` для статического экспорта.
 */
export default function CategoriesIndexRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!router.isReady) return;
    const slug = typeof router.query.slug === "string" ? router.query.slug.trim() : "";
    const sectionRaw = router.query.section;
    const section =
      typeof sectionRaw === "string" && sectionRaw.trim() ? sectionRaw.trim() : "services";
    if (slug) {
      router.replace(`/categories/${encodeURIComponent(slug)}?section=${encodeURIComponent(section)}`);
    } else {
      router.replace(`/?section=${encodeURIComponent(section)}#youla-categories`);
    }
  }, [router, router.isReady, router.query.slug, router.query.section]);
  return null;
}
