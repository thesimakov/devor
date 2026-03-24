import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../../components/AppHeader";
import { getStoredUser } from "../../lib/auth";
import { getStaffToken, staffLoginRequest, staffLogoutFull } from "../../lib/staffAuthShared";
import { isStaffRole, staffFetch } from "../../lib/staffApi";

export default function StaffManagerPage() {
  const [token, setToken] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState("");
  const [listings, setListings] = useState({ items: [], total: 0 });
  const [listLoading, setListLoading] = useState(false);

  const sync = useCallback(() => setToken(getStaffToken()), []);

  useEffect(() => {
    sync();
  }, [sync]);

  const loadMe = useCallback(async () => {
    const t = getStaffToken();
    if (!t) {
      setMe(null);
      return;
    }
    setMeError("");
    try {
      const data = await staffFetch("/admin/me", { token: t });
      setMe(data);
      if (!data.is_manager && !data.is_super_admin) {
        setMeError("Эта страница только для менеджера или администратора.");
      }
    } catch (e) {
      setMe(null);
      setMeError(e.message || "Нет доступа");
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe, token]);

  const loadListings = useCallback(async () => {
    const t = getStaffToken();
    if (!t || !me || (!me.is_manager && !me.is_super_admin)) return;
    setListLoading(true);
    try {
      const data = await staffFetch(`/admin/listings?page=1&page_size=100`, { token: t });
      setListings(data);
    } catch {
      setListings({ items: [], total: 0 });
    } finally {
      setListLoading(false);
    }
  }, [me]);

  useEffect(() => {
    if (me && (me.is_manager || me.is_super_admin)) loadListings();
  }, [me, loadListings]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError("");
    try {
      await staffLoginRequest(login, password);
      setToken(getStaffToken());
      setPassword("");
    } catch (err) {
      setAuthError(err.message || "Ошибка входа");
    }
  }

  async function setListingStatus(listingId, status) {
    const t = getStaffToken();
    try {
      await staffFetch(`/admin/listings/${listingId}/status`, {
        method: "PATCH",
        body: { status },
        token: t,
      });
      await loadListings();
    } catch (e) {
      window.alert(e.message);
    }
  }

  const u = typeof window !== "undefined" ? getStoredUser() : null;
  const allowed = me && (me.is_manager || me.is_super_admin);

  return (
    <>
      <Head>
        <title>Менеджер · модерация · Devor</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="app-shell youla-app-shell">
        <div className="page youla-page staff-page">
          <AppHeader />
          <main className="staff-main">
            <nav className="staff-breadcrumb">
              <Link href="/staff">Служебный вход</Link>
              <span> / </span>
              <span>Менеджер</span>
            </nav>

            <header className="staff-hero">
              <h1 className="staff-title">Модерация объявлений</h1>
              <p className="staff-lead">Просмотр всех объявлений и смена статуса. Роли: <strong>manager</strong> или <strong>admin</strong>.</p>
            </header>

            <section className="staff-card">
              <h2 className="staff-h2">Вход</h2>
              {!token ? (
                <form className="staff-form" onSubmit={handleLogin}>
                  <label className="staff-label">
                    Логин
                    <input className="staff-input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" />
                  </label>
                  <label className="staff-label">
                    Пароль
                    <input
                      className="staff-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                    />
                  </label>
                  <button type="submit" className="staff-btn staff-btn--primary">
                    Войти
                  </button>
                  {authError ? <p className="staff-error">{authError}</p> : null}
                </form>
              ) : (
                <div className="staff-session">
                  <p>
                    <strong>{u?.login}</strong> · {u?.role}
                  </p>
                  <button
                    type="button"
                    className="staff-btn staff-btn--ghost"
                    onClick={() => {
                      staffLogoutFull();
                      setToken("");
                      setMe(null);
                    }}
                  >
                    Выйти
                  </button>
                </div>
              )}
            </section>

            {token && meError ? <p className="staff-error staff-card">{meError}</p> : null}
            {token && u && !isStaffRole(u.role) ? <p className="staff-error staff-card">Нет прав staff.</p> : null}

            {allowed ? (
              <section className="staff-card">
                <h2 className="staff-h2">Все объявления</h2>
                <p className="staff-muted">{listLoading ? "Загрузка…" : `Всего: ${listings.total}`}</p>
                <div className="staff-table-wrap">
                  <table className="staff-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Заголовок</th>
                        <th>Статус</th>
                        <th>Действия</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(listings.items || []).map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>
                            <Link href={`/listings/${row.id}`}>{row.title}</Link>
                          </td>
                          <td>{row.status}</td>
                          <td className="staff-actions">
                            <button type="button" className="staff-linkish" onClick={() => setListingStatus(row.id, "active")}>
                              Активно
                            </button>
                            <button type="button" className="staff-linkish" onClick={() => setListingStatus(row.id, "moderated")}>
                              Модерация
                            </button>
                            <button type="button" className="staff-linkish" onClick={() => setListingStatus(row.id, "archived")}>
                              Архив
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <footer className="staff-foot">
              <Link href="/staff">← К служебному входу</Link>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
