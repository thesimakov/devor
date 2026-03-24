/**
 * Иконки полосы категорий на главной: Material Design (react-icons/md), привязка по slug.
 * Эмодзи и старый массив CATEGORY_ICONS по индексу не используются — иначе метки и картинки расходятся.
 */
import {
  MdAutoAwesome,
  MdBolt,
  MdBrush,
  MdChair,
  MdContentCut,
  MdFace,
  MdFormatPaint,
  MdHealing,
  MdMoreHoriz,
  MdPalette,
  MdRemoveRedEye,
  MdScience,
  MdSpa,
  MdCategory,
} from "react-icons/md";

/** slug → компонент иконки (Material Icons). */
const SLUG_TO_ICON = {
  krasota: MdFace,
  "beauty-spa-massazh": MdSpa,
  "beauty-manikyur-pedikyur": MdPalette,
  "beauty-parikmaherskie-uslugi": MdContentCut,
  "beauty-resnitsy-brovi": MdRemoveRedEye,
  "beauty-permanentnyy-makiyazh": MdBrush,
  "beauty-kosmetologiya": MdScience,
  "beauty-epilyatsiya": MdBolt,
  "beauty-makiyazh": MdAutoAwesome,
  "beauty-tatu-pirsing": MdFormatPaint,
  "beauty-arenda-rabochego-mesta": MdChair,
  "beauty-drugoe": MdMoreHoriz,
};

export function getCategoryStripIcon(slug) {
  if (typeof slug !== "string") return MdCategory;
  return SLUG_TO_ICON[slug] || MdCategory;
}

/**
 * @param {{ slug: string; className?: string; size?: number }} props
 */
export function CategoryStripIcon({ slug, className = "", size = 28 }) {
  const Icon = getCategoryStripIcon(slug);
  return <Icon className={`youla-cat-icon-svg ${className}`.trim()} size={size} aria-hidden />;
}
