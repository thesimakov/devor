/**
 * Иконки категорий: Heroicons 2 outline (react-icons/hi2) — единый стиль с шапкой и кнопками.
 */
import {
  HiOutlineFaceSmile,
  HiOutlineSparkles,
  HiOutlineSwatch,
  HiOutlineScissors,
  HiOutlineEye,
  HiOutlinePaintBrush,
  HiOutlineBeaker,
  HiOutlineBolt,
  HiOutlineSun,
  HiOutlinePencilSquare,
  HiOutlineBuildingOffice2,
  HiOutlineEllipsisHorizontal,
  HiOutlineSquares2X2,
} from "react-icons/hi2";

const SLUG_TO_ICON = {
  krasota: HiOutlineFaceSmile,
  "beauty-spa-massazh": HiOutlineSparkles,
  "beauty-manikyur-pedikyur": HiOutlineSwatch,
  "beauty-parikmaherskie-uslugi": HiOutlineScissors,
  "beauty-resnitsy-brovi": HiOutlineEye,
  "beauty-permanentnyy-makiyazh": HiOutlinePaintBrush,
  "beauty-kosmetologiya": HiOutlineBeaker,
  "beauty-epilyatsiya": HiOutlineBolt,
  "beauty-makiyazh": HiOutlineSun,
  "beauty-tatu-pirsing": HiOutlinePencilSquare,
  "beauty-arenda-rabochego-mesta": HiOutlineBuildingOffice2,
  "beauty-drugoe": HiOutlineEllipsisHorizontal,
};

export function getCategoryStripIcon(slug) {
  if (typeof slug !== "string") return HiOutlineSquares2X2;
  return SLUG_TO_ICON[slug] || HiOutlineSquares2X2;
}

/**
 * @param {{ slug: string; className?: string; size?: number }} props
 */
export function CategoryStripIcon({ slug, className = "", size = 28 }) {
  const Icon = getCategoryStripIcon(slug);
  return <Icon className={`youla-cat-icon-svg ${className}`.trim()} size={size} aria-hidden />;
}
