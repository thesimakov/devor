import partA from "./servicesCategoryTree.data.part-a.js";
import partB from "./servicesCategoryTree.data.part-b.js";

const BEAUTY_TJ_NAMES = {
  // Корень «Красота»
  krasota: "Зебоӣ",

  // Подразделы красоты
  "beauty-manikyur-pedikyur": "Маникюр ва педикюр",
  "beauty-parikmaherskie-uslugi": "Хизматҳои сартарош",
  "beauty-resnitsy-brovi": "Пилкҳо ва абрӯвон",
  "beauty-permanentnyy-makiyazh": "Ороиши доимӣ",
  "beauty-kosmetologiya": "Косметология",
  "beauty-epilyatsiya": "Бартарафсозии мӯй",
  "beauty-makiyazh": "Ороиш",
  "beauty-spa-massazh": "Хизматҳои СПА ва массаж",
  "beauty-tatu-pirsing": "Тату ва пирсинг",
  "beauty-arenda-rabochego-mesta": "Иҷораи ҷойи корӣ",
  "beauty-drugoe": "Дигар",
};

function withIds(nodes, ctr = { n: 1 }) {
  return nodes.map((node) => ({
    id: ctr.n++,
    name_ru: node.name_ru,
    name_tj: BEAUTY_TJ_NAMES[node.slug] || node.name_tj,
    slug: node.slug,
    children: node.children?.length ? withIds(node.children, ctr) : [],
  }));
}

const merged = [...partA, ...partB];

/** Полное дерево категорий раздела «Услуги» для fallback UI и SSR. */
export const servicesCategoryTree = withIds(merged);
