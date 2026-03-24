export default function SceneIllustration({ compact = false }) {
  return (
    <svg
      className={`scene-illustration ${compact ? "compact" : ""}`}
      viewBox="0 0 320 180"
      role="img"
      aria-label="Иллюстрация сервиса объявлений"
    >
      <defs>
        <linearGradient id="bgG" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#dbeafe" />
          <stop offset="100%" stopColor="#ccfbf1" />
        </linearGradient>
        <linearGradient id="cardG" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f8fafc" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="320" height="180" rx="20" fill="url(#bgG)" />
      <circle cx="56" cy="40" r="20" className="scene-bubble bubble-a" />
      <circle cx="268" cy="34" r="14" className="scene-bubble bubble-b" />
      <circle cx="290" cy="122" r="22" className="scene-bubble bubble-c" />

      <rect x="36" y="40" width="248" height="112" rx="14" fill="url(#cardG)" stroke="#bae6fd" />
      <rect x="52" y="58" width="70" height="52" rx="10" fill="#e2e8f0" />
      <rect x="132" y="58" width="134" height="12" rx="6" fill="#0f766e" opacity="0.85" />
      <rect x="132" y="78" width="92" height="10" rx="5" fill="#94a3b8" opacity="0.8" />
      <rect x="132" y="96" width="116" height="10" rx="5" fill="#94a3b8" opacity="0.6" />
      <rect x="52" y="120" width="92" height="16" rx="8" fill="#0ea5e9" />
      <rect x="152" y="120" width="58" height="16" rx="8" fill="#f0fdfa" stroke="#5eead4" />
    </svg>
  );
}
