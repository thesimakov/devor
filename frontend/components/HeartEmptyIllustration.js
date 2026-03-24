/** Простая SVG-иллюстрация для пустого избранного */
export default function HeartEmptyIllustration() {
  return (
    <svg className="heart-empty-svg" viewBox="0 0 200 160" aria-hidden>
      <defs>
        <linearGradient id="hbg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#e0e7ff" />
        </linearGradient>
      </defs>
      <rect width="200" height="160" rx="20" fill="url(#hbg)" />
      <path
        d="M100 128s-32-22-44-38c-10-14-8-32 8-40 12-6 26-2 36 8 10-10 24-14 36-8 16 8 18 26 8 40-12 16-44 38-44 38z"
        fill="none"
        stroke="#f472b6"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="52" cy="48" r="8" fill="#fda4af" opacity="0.6" />
      <circle cx="156" cy="56" r="6" fill="#a5b4fc" opacity="0.7" />
    </svg>
  );
}
