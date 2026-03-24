/**
 * Шапка страницы: заголовок + фото (герой-блок).
 */
export default function PageIntroBanner({ title, subtitle, imageUrl, imageAlt = "" }) {
  return (
    <header className="page-intro-banner">
      <div className="page-intro-banner-copy">
        <h1 className="page-intro-banner-title">{title}</h1>
        {subtitle ? <p className="page-intro-banner-sub">{subtitle}</p> : null}
      </div>
      <div className="page-intro-banner-media" aria-hidden={!imageAlt}>
        <img src={imageUrl} alt={imageAlt} className="page-intro-banner-img" width={560} height={320} loading="lazy" />
      </div>
    </header>
  );
}
