/**
 * Кнопка «избранное»: SVG-сердце, по клику не всплывает переход по родительской ссылке.
 */
export default function FavoriteHeartButton({ listingId, active, onToggle, variant = "strip" }) {
  const grid = variant === "grid";

  return (
    <button
      type="button"
      className={`favorite-heart-btn youla-fav-btn ${grid ? "youla-fav-btn--grid" : ""} ${active ? "favorite-heart-btn--active" : ""}`}
      aria-label={active ? "Убрать из избранного" : "В избранное"}
      aria-pressed={active}
      data-listing-id={listingId}
      onClick={(e) => onToggle(listingId, e)}
    >
      <svg className="favorite-heart-svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden focusable="false">
        <path
          className="favorite-heart-path"
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      </svg>
    </button>
  );
}
