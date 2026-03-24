import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../../components/AppHeader";
import { getStoredUser } from "../../lib/auth";
import { getStaffToken, staffLoginRequest, staffLogoutFull } from "../../lib/staffAuthShared";
import { isStaffRole } from "../../lib/staffApi";
import { staffFetch } from "../../lib/staffApi";

export default function StaffHubPage() {
  const [token, setToken] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [me, setMe] = useState(null);

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
    try {
      const data = await staffFetch("/admin/me", { token: t });
      setMe(data);
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe, token]);

  async function handleLogin(e) {
    e.preventDefault();
    setAuthError("");
    try {
      await staffLoginRequest(login, password);
      setToken(getStaffToken());
      setPassword("");
    } catch (err) {
      setAuthError(err.message || "Ошибка");
    }
  }

  const u = typeof window !== "undefined" ? getStoredUser() : null;
  const canModerate = me && (me.is_manager || me.is_super_admin);
  const canAdmin = me?.is_super_admin;

  return (
    <>
      <Head>
        <title>Служебный вход · Devor</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="app-shell youla-app-shell">
        <div className="page youla-page staff-page">
          <AppHeader />
          <main className="staff-main">
            <header className="staff-hero">
              <p className="staff-kicker">Служебная зона</p>
              <h1 className="staff-title">Панель команды Devor</h1>
              <p className="staff-lead">
                Доступ разделён: <strong>менеджер</strong> — только модерация объявлений; <strong>администратор</strong> — пользователи,
                роли, разделы и категории (нужен секрет операций).
              </p>
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
                  <p className="staff-hint">
                    Демо: <code>admin</code>/<code>admin</code>, <code>manager</code>/<code>manager_devor_change_me</code>
                  </p>
                </form>
              ) : (
                <div className="staff-session">
                  <p>
                    <strong>{u?.login}</strong> · роль <strong>{u?.role}</strong>
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

            {token && u && !isStaffRole(u.role) ? (
              <p className="staff-error staff-card">Нет прав staff.</p>
            ) : null}

            {canModerate ? (
              <nav className="staff-hub-nav staff-card">
                <h2 className="staff-h2">Куда перейти</h2>
                <ul className="staff-hub-list">
                  <li>
                    <Link className="staff-hub-link" href="/staff/manager">
                      Модерация объявлений
                    </Link>
                    <span className="staff-hub-desc">менеджер и администратор</span>
                  </li>
                  {canAdmin ? (
                    <li>
                      <Link className="staff-hub-link" href="/staff/admin">
                        Администрирование
                      </Link>
                      <span className="staff-hub-desc">пользователи, роли, разделы и подразделы + секрет</span>
                    </li>
                  ) : (
                    <li className="staff-muted">Администрирование каталога и ролей — только для учётки с ролью admin.</li>
                  )}
                </ul>
              </nav>
            ) : null}

            <footer className="staff-foot">
              <Link href="/">← На сайт</Link>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
