import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useLanguage } from "../contexts/LanguageContext";
import { apiFetch } from "../lib/api";
import { getStoredToken } from "../lib/auth";

const PCT_STEPS = [1, 5, 10, 25, 50, 100];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function suggestFromPct(base, pct, minNext) {
  const v = round2(Number(base) * (1 + pct / 100));
  return Math.max(v, Number(minNext));
}

export default function AuctionBidModal({ listingId, onClose, onSuccess }) {
  const { t } = useLanguage();
  const [state, setState] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [me, setMe] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setError("");
    try {
      const [st, w, profile] = await Promise.all([
        apiFetch(`/auctions/listings/${listingId}/state`),
        getStoredToken() ? apiFetch("/billing/wallet").catch(() => null) : Promise.resolve(null),
        getStoredToken() ? apiFetch("/users/me").catch(() => null) : Promise.resolve(null),
      ]);
      setState(st);
      setWallet(w);
      setMe(profile);
      if (st?.min_next_bid_som != null) {
        setAmount(String(st.min_next_bid_som));
      }
    } catch (e) {
      setError(e?.message || t("auction.loadError"));
    } finally {
      setLoading(false);
    }
  }, [listingId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const baseForPct = useMemo(() => {
    if (!state) return 0;
    const h = state.current_highest_bid_som != null ? Number(state.current_highest_bid_som) : 0;
    const s = Number(state.starting_price_som || 0);
    return Math.max(h, s, 1);
  }, [state]);

  const minNext = state ? Number(state.min_next_bid_som) : 0;

  function applyPct(pct) {
    const v = suggestFromPct(baseForPct, pct, minNext);
    setAmount(String(v));
  }

  async function submit() {
    setError("");
    const raw = String(amount).replace(",", ".").trim();
    const num = Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      setError(t("auction.badAmount"));
      return;
    }
    setSubmitting(true);
    try {
      const next = await apiFetch(`/auctions/listings/${listingId}/bid`, {
        method: "POST",
        body: JSON.stringify({ amount_som: num }),
      });
      setState(next);
      if (onSuccess) onSuccess();
      onClose();
    } catch (e) {
      setError(e?.message || t("auction.bidError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!listingId) return null;

  return (
    <div
      className="auction-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auction-modal-title"
      onClick={onClose}
    >
      <div className="auction-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auction-modal-head">
          <h2 id="auction-modal-title">{t("auction.title")}</h2>
          <button type="button" className="auction-modal-close" onClick={onClose} aria-label={t("common.close")}>
            ×
          </button>
        </div>
        {loading ? (
          <p className="auction-modal-loading">{t("common.loading")}</p>
        ) : (
          <>
            {state ? (
              <div className="auction-modal-meta">
                <p>
                  {t("auction.minBid")}: <strong>{minNext}</strong> {t("common.currencySom")}
                </p>
                {state.current_highest_bid_som != null ? (
                  <p>
                    {t("auction.currentBid")}: <strong>{state.current_highest_bid_som}</strong>
                  </p>
                ) : null}
                <p className="auction-modal-wallet">
                  {t("auction.walletBalance")}:{" "}
                  <strong>{wallet != null ? wallet.balance_som : "—"}</strong>
                </p>
                {me?.verification_level === "extended" ? (
                  <p className="auction-modal-verified">{t("auction.verifiedOk")}</p>
                ) : (
                  <p className="auction-modal-verify-hint">{t("auction.verifyHint")}</p>
                )}
              </div>
            ) : null}

            <div className="auction-modal-pct-row">
              <span className="auction-modal-pct-label">{t("auction.pctQuick")}</span>
              <div className="auction-modal-pct-btns">
                {PCT_STEPS.map((p) => (
                  <button key={p} type="button" className="auction-modal-pct" onClick={() => applyPct(p)}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>

            <label className="auction-modal-field">
              <span>{t("auction.amountLabel")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoComplete="off"
              />
            </label>

            {state && !state.can_bid && state.bid_block_reason ? (
              <p className="auction-modal-block" role="alert">
                {state.bid_block_reason}
              </p>
            ) : null}

            {error ? (
              <p className="auction-modal-error" role="alert">
                {error}
              </p>
            ) : null}

            <div className="auction-modal-actions">
              <button
                type="button"
                className="auction-modal-submit"
                onClick={submit}
                disabled={submitting || !state?.can_bid}
              >
                {submitting ? t("common.loading") : t("auction.submit")}
              </button>
              <Link href="/wallet" className="auction-modal-wallet-link" onClick={onClose}>
                {t("auction.openWallet")}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
