import { writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const [a, b] = await Promise.all([
  import(join(root, "lib/servicesCategoryTree.data.part-a.js")),
  import(join(root, "lib/servicesCategoryTree.data.part-b.js")),
]);

const tree = [...a.default, ...b.default];

// Добавляем только нужные переводы «Красота» для стабильного UI/кэша.
const BEAUTY_TJ_NAMES = {
  krasota: "Зебоӣ",
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

function applyNameTj(nodes) {
  return (nodes || []).map((node) => ({
    ...node,
    name_tj: BEAUTY_TJ_NAMES[node.slug] || node.name_tj,
    children: node.children?.length ? applyNameTj(node.children) : [],
  }));
}

const out = join(root, "lib/services_category_tree.json");
writeFileSync(out, JSON.stringify(applyNameTj(tree), null, 2), "utf8");
console.log("OK:", out, "nodes root:", tree.length);
