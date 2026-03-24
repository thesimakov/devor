/**
 * Кнопка «избранное»: Heroicons 2 (outline / solid), по клику не всплывает переход по родительской ссылке.
 */
import { HiHeart, HiOutlineHeart } from "react-icons/hi2";

export default function FavoriteHeartButton({ listingId, active, onToggle, variant = "strip" }) {
  const grid = variant === "grid";
  const Icon = active ? HiHeart : HiOutlineHeart;

  return (
    <button
      type="button"
      className={`favorite-heart-btn youla-fav-btn ${grid ? "youla-fav-btn--grid" : ""} ${active ? "favorite-heart-btn--active" : ""}`}
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      aria-pressed={active}
      data-listing-id={listingId}
      onClick={(e) => onToggle(listingId, e)}
    >
      <Icon className="favorite-heart-icon" size={22} aria-hidden focusable="false" />
    </button>
  );
}
