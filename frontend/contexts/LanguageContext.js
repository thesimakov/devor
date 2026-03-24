import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { t as translate } from "../lib/i18n";

const STORAGE_KEY = "devor_lang";

const LanguageContext = createContext({
  lang: "ru",
  setLang: () => {},
  t: (key, vars) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState("ru");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "tj" || saved === "ru") setLangState(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang === "tj" ? "tg" : "ru";
    }
  }, [lang, ready]);

  const setLang = useCallback((next) => {
    if (next === "tj" || next === "ru") setLangState(next);
  }, []);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
