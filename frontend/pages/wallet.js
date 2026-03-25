import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../components/AppHeader";
import AuthPhoneForm from "../components/AuthPhoneForm";
import PageIntroBanner from "../components/PageIntroBanner";
import { apiFetch } from "../lib/api";
import { CONTENT_IMAGES } from "../lib/contentAssets";
import { formatAmountRuTj } from "../lib/i18n";
import { useLanguage } from "../contexts/LanguageContext";

function formatSom(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${formatAmountRuTj(Number(n))} сом.`;
}

export default function WalletPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const [authed, setAuthed] = useState(false);
  const [balance, setBalance] = useState(null);
  const [demoTopup, setDemoTopup] = useState(false);
  const [packages, setPackages] = useState([]);
  const [presets, setPresets] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  /** Пустая строка до router.isReady — иначе SSR и первый клиентский рендер расходятся по ?listing= */
  const [selectedListing, setSelectedListing] = useState("");
  const [myListings, setMyListings] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [w, pkgs, pr, lg, mine] = await Promise.all([
        apiFetch("/billing/wallet"),
        apiFetch("/billing/packages"),
        apiFetch("/billing/topup-presets"),
        apiFetch("/billing/wallet/ledger?limit=50"),
        apiFetch("/users/me/listings").catch(() => []),
      ]);
      setBalance(w.balance_som);
      setDemoTopup(Boolean(w.demo_topup_enabled));
      setPackages(pkgs || []);
      setPresets(pr || []);
      setLedger(lg || []);
      setMyListings(mine || []);
    } catch (e) {
      setMessage(e.message || "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed, refresh]);

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query.listing;
    const v = Array.isArray(raw) ? raw[0] : raw;
    if (v != null && v !== "" && Number.isFinite(Number(v))) setSelectedListing(Number(v));
  }, [router.isReady, router.query.listing]);

  async function onTopup(amount) {
    setMessage("");
    try {
      await apiFetch("/billing/wallet/topup-demo", {
        method: "POST",
        body: JSON.stringify({ amount_som: amount }),
      });
      await refresh();
      setMessage(`Зачислено ${formatSom(amount)}`);
    } catch (e) {
      setMessage(e.message || "Не удалось пополнить");
    }
  }

  async function onPromote(pkgId) {
    const lid = Number(selectedListing);
    if (!lid) {
      setMessage("Выберите объявление из списка");
      return;
    }
    setMessage("");
    try {
      await apiFetch(`/billing/listings/${lid}/promote`, {
        method: "POST",
        body: JSON.stringify({ package_id: pkgId }),
      });
      await refresh();
      setMessage("Объявление продвинуто — чаще показывается в топе выдачи.");
    } catch (e) {
      setMessage(e.message || "Ошибка продвижения");
    }
  }

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page">
        <AppHeader />

        <main className="wallet-page">
          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />

          {authed ? (
            <>
              <header className="wallet-hero">
                <div>
                  <h1>Монетизация и баланс</h1>
                  <p className="wallet-lead">
                    Кошёлёк в сомони для платного <strong>продвижения объявлений</strong> в поиске и ленте. Пополнение ниже —
                    демо-режим для разработки; в продакшене подключается эквайринг или СПО.
                  </p>
                </div>
                <div className="wallet-balance-card" aria-live="polite">
                  <span className="wallet-balance-label">Баланс</span>
                  <strong className="wallet-balance-value">{loading ? "…" : formatSom(balance)}</strong>
                  <Link href="/my-listings" className="ghost wallet-link-secondary">
                    Мои объявления
                  </Link>
                </div>
              </header>

              {demoTopup ? (
                <section className="wallet-section">
                  <h2>Пополнить (демо)</h2>
                  <p className="wallet-muted">Кнопки мгновенно увеличивают баланс без реального списания карты.</p>
                  <div className="wallet-presets">
                    {presets.map((amt) => (
                      <button key={amt} type="button" className="primary wallet-preset-btn" onClick={() => onTopup(amt)}>
                        +{formatSom(amt)}
                      </button>
                    ))}
                  </div>
                </section>
              ) : (
                <section className="wallet-section wallet-banner-muted">
                  <h2>Платёжный провайдер</h2>
                  <p>Демо-пополнение отключено (<code>DEVOR_DEMO_TOPUP=false</code>). Подключите приём оплаты на бэкенде.</p>
                </section>
              )}

              <section className="wallet-section">
                <h2>Продвинуть объявление</h2>
                <p className="wallet-muted">Продвигаемые карточки показываются выше обычных при любой сортировке.</p>

                <label className="wallet-field">
                  <span>Объявление</span>
                  <select
                    value={selectedListing === "" || selectedListing == null ? "" : String(selectedListing)}
                    onChange={(e) => setSelectedListing(e.target.value ? Number(e.target.value) : "")}
                  >
                    <option value="">— выберите —</option>
                    {myListings.map((l) => (
                      <option value={l.id} key={l.id}>
                        #{l.id} · {l.title.slice(0, 60)}
                        {l.is_promoted ? " · в топе" : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="wallet-packages">
                  {packages.map((p) => (
                    <article key={p.id} className="wallet-package-card">
                      <h3>{p.title}</h3>
                      <p className="wallet-package-desc">{p.description}</p>
                      <div className="wallet-package-meta">
                        <span className="wallet-package-days">{p.days} дн.</span>
                        <span className="wallet-package-price">{formatSom(p.price_som)}</span>
                      </div>
                      <button type="button" className="ghost strong wallet-promote-btn" onClick={() => onPromote(p.id)}>
                        Оплатить с баланса
                      </button>
                    </article>
                  ))}
                </div>
              </section>

              <section className="wallet-section">
                <h2>История операций</h2>
                {ledger.length === 0 ? (
                  <p className="wallet-muted">Пока нет движений по счёту.</p>
                ) : (
                  <ul className="wallet-ledger">
                    {ledger.map((row) => (
                      <li key={row.id} className="wallet-ledger-row">
                        <span className={`wallet-ledger-delta ${Number(row.delta_som) >= 0 ? "plus" : "minus"}`}>
                          {Number(row.delta_som) >= 0 ? "+" : ""}
                          {formatSom(row.delta_som)}
                        </span>
                        <span className="wallet-ledger-note">{row.note}</span>
                        <span className="wallet-ledger-bal">итого {formatSom(row.balance_after_som)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {message ? <p className="auth-message">{message}</p> : null}
            </>
          ) : (
            <div className="favorites-guest">
              <PageIntroBanner
                title={t("header.walletTitle")}
                subtitle={t("account.walletGuestSubtitle")}
                imageUrl={CONTENT_IMAGES.profile}
                imageAlt=""
              />
              <p className="favorites-guest-tip">{t("account.walletGuestTip")}</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
