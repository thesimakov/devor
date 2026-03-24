import { useEffect } from "react";
import AppFooter from "../components/AppFooter";
import { LanguageProvider } from "../contexts/LanguageContext";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
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
