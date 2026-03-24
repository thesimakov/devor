import CategoryPage, { getServerSideProps as getCategoryServerSideProps } from "./[slug]";

/**
 * Query-роут для категорий: /categories?slug=...&section=...
 * Нужен как стабильная точка входа для всех ссылок категорий и подкатегорий.
 */
export async function getServerSideProps(ctx) {
  const slugRaw = ctx?.query?.slug;
  const slug = typeof slugRaw === "string" ? slugRaw.trim() : "";
  const sectionRaw = ctx?.query?.section;
  const section = typeof sectionRaw === "string" && sectionRaw.trim() ? sectionRaw.trim() : "services";

  if (!slug) {
    return {
      redirect: {
        destination: `/?section=${section}#youla-categories`,
        permanent: false,
      },
    };
  }

  return getCategoryServerSideProps({
    ...ctx,
    params: { ...(ctx.params || {}), slug },
    query: { ...(ctx.query || {}), section },
  });
}

export default CategoryPage;
