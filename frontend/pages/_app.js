import { useEffect } from "react";
import AppFooter from "../components/AppFooter";
import { LanguageProvider } from "../contexts/LanguageContext";
import { siteBasePath } from "../lib/siteBasePath";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const swPath = `${siteBasePath || ""}/sw.js`;
    navigator.serviceWorker.register(swPath).catch(() => {});
  }, []);

  return (
    <LanguageProvider>
      <div className="site-root">
        <div className="site-root-main">
          <Component {...pageProps} />
        </div>
        <AppFooter />
      </div>
    </LanguageProvider>
  );
}
