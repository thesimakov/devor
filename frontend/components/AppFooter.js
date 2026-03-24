import Link from "next/link";

import { useLanguage } from "../contexts/LanguageContext";

export default function AppFooter() {
  const year = new Date().getFullYear();
  const { t } = useLanguage();

  return (
    <footer className="site-footer" role="contentinfo">
      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <Link href="/" className="site-footer-logo">
            DEVOR
          </Link>
          <p className="site-footer-tagline">{t("footer.tagline")}</p>
        </div>

        <nav className="site-footer-nav" aria-label={t("footer.navInfoAria")}>
          <div className="site-footer-col">
            <h3 className="site-footer-heading">{t("footer.sections")}</h3>
            <ul className="site-footer-list">
              <li>
                <Link href={{ pathname: "/", query: { section: "services" } }}>{t("footer.services")}</Link>
              </li>
              <li>
                <Link href={{ pathname: "/", query: { section: "realty" } }}>{t("footer.realty")}</Link>
              </li>
              <li>
                <Link href={{ pathname: "/", query: { section: "transport" } }}>{t("footer.transport")}</Link>
              </li>
            </ul>
          </div>

          <div className="site-footer-col">
            <h3 className="site-footer-heading">{t("footer.forUsers")}</h3>
            <ul className="site-footer-list">
              <li>
                <Link href="/create-listing">{t("footer.postListing")}</Link>
              </li>
              <li>
                <Link href="/my-listings">{t("footer.myListings")}</Link>
              </li>
              <li>
                <Link href="/favorites">{t("footer.favorites")}</Link>
              </li>
              <li>
                <Link href="/chat">{t("footer.messages")}</Link>
              </li>
              <li>
                <Link href="/profile">{t("footer.profile")}</Link>
              </li>
            </ul>
          </div>

          <div className="site-footer-col">
            <h3 className="site-footer-heading">{t("footer.about")}</h3>
            <ul className="site-footer-list">
              <li>
                <a href="#">{t("footer.terms")}</a>
              </li>
              <li>
                <a href="#">{t("footer.ads")}</a>
              </li>
              <li>
                <a href="#">{t("footer.help")}</a>
              </li>
              <li>
                <a href="#">{t("footer.rules")}</a>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="site-footer-bottom">
        <div className="site-footer-bottom-inner">
          <p className="site-footer-copy">{t("footer.copyright", { year })}</p>
          <div className="site-footer-social">
            <a href="#" className="site-footer-social-link" aria-label={t("footer.telegram")}>
              TG
            </a>
            <a href="#" className="site-footer-social-link" aria-label={t("footer.vk")}>
              VK
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
