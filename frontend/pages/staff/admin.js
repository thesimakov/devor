import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import AppHeader from "../../components/AppHeader";
import { getStoredUser } from "../../lib/auth";
import { getStaffToken, staffLoginRequest, staffLogoutFull } from "../../lib/staffAuthShared";
import { getOpsSecret, isStaffRole, setOpsSecret, staffFetch } from "../../lib/staffApi";

export default function StaffAdminPage() {
  const [token, setToken] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [me, setMe] = useState(null);
  const [meError, setMeError] = useState("");
  const [opsInput, setOpsInput] = useState("");
  const [opsOk, setOpsOk] = useState(false);
  const [opsMessage, setOpsMessage] = useState("");
  const [tab, setTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [sections, setSections] = useState([]);
  const [sectionKey, setSectionKey] = useState("services");
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [newSection, setNewSection] = useState({ key: "", name_ru: "", name_tj: "", slug: "" });
  const [newCat, setNewCat] = useState({ name_ru: "", name_tj: "", slug: "", parent_id: "" });

  const sync = useCallback(() => setToken(getStaffToken()), []);

  useEffect(() => {
    sync();
    setOpsInput(getOpsSecret());
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
      if (!data.is_super_admin) {
        setMeError("Страница только для главного администратора (роль admin).");
      }
    } catch (e) {
      setMe(null);
      setMeError(e.message || "Нет доступа");
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
      setAuthError(err.message || "Ошибка входа");
    }
  }

  async function verifyOps() {
    const t = getStaffToken();
    setOpsMessage("");
    setOpsOk(false);
    setOpsSecret(opsInput);
    try {
      const data = await staffFetch("/admin/ops/ping", { token: t, withOps: true });
      setOpsOk(true);
      setOpsMessage(data.detail || "Ок");
    } catch (e) {
      setOpsOk(false);
      setOpsMessage(e.message || "Ошибка");
    }
  }

  const loadUsers = useCallback(async () => {
    const t = getStaffToken();
    if (!t || !opsOk) return;
    setUsersLoading(true);
    try {
      const data = await staffFetch("/admin/users", { token: t, withOps: true });
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, [opsOk]);

  const loadSections = useCallback(async () => {
    const t = getStaffToken();
    if (!t || !opsOk) return;
    try {
      const data = await staffFetch("/admin/catalog/sections", { token: t, withOps: true });
      setSections(Array.isArray(data) ? data : []);
    } catch {
      setSections([]);
    }
  }, [opsOk]);

  const loadCategories = useCallback(async () => {
    const t = getStaffToken();
    if (!t || !opsOk || !sectionKey) return;
    setCatLoading(true);
    try {
      const data = await staffFetch(`/admin/catalog/categories?section_key=${encodeURIComponent(sectionKey)}`, {
        token: t,
        withOps: true,
      });
      setCategories(Array.isArray(data) ? data : []);
    } catch {
      setCategories([]);
    } finally {
      setCatLoading(false);
    }
  }, [opsOk, sectionKey]);

  useEffect(() => {
    if (opsOk && me?.is_super_admin && tab === "users") loadUsers();
  }, [opsOk, me, tab, loadUsers]);

  useEffect(() => {
    if (opsOk && me?.is_super_admin && tab === "catalog") {
      loadSections();
      loadCategories();
    }
  }, [opsOk, me, tab, loadSections, loadCategories]);

  async function setUserRole(userId, role) {
    const t = getStaffToken();
    try {
      await staffFetch(`/admin/users/${userId}/role`, {
        method: "PATCH",
        body: { role },
        token: t,
        withOps: true,
      });
      await loadUsers();
    } catch (e) {
      window.alert(e.message);
    }
  }

  async function createSection(e) {
    e.preventDefault();
    const t = getStaffToken();
    try {
      await staffFetch("/admin/catalog/sections", {
        method: "POST",
        body: {
          key: newSection.key.trim(),
          name_ru: newSection.name_ru.trim(),
          name_tj: newSection.name_tj.trim() || newSection.name_ru.trim(),
          slug: newSection.slug.trim(),
        },
        token: t,
        withOps: true,
      });
      setNewSection({ key: "", name_ru: "", name_tj: "", slug: "" });
      await loadSections();
    } catch (e) {
      window.alert(e.message);
    }
  }

  async function createCategory(e) {
    e.preventDefault();
    const t = getStaffToken();
    const pid = newCat.parent_id.trim();
    try {
      await staffFetch("/admin/catalog/categories", {
        method: "POST",
        body: {
          section_key: sectionKey,
          name_ru: newCat.name_ru.trim(),
          name_tj: newCat.name_tj.trim() || newCat.name_ru.trim(),
          slug: newCat.slug.trim(),
          parent_id: pid ? Number(pid) : null,
        },
        token: t,
        withOps: true,
      });
      setNewCat({ name_ru: "", name_tj: "", slug: "", parent_id: "" });
      await loadCategories();
    } catch (e) {
      window.alert(e.message);
    }
  }

  async function saveCategoryRow(c) {
    const t = getStaffToken();
    try {
      await staffFetch(`/admin/catalog/categories/${c.id}`, {
        method: "PATCH",
        body: { name_ru: c.name_ru, name_tj: c.name_tj, slug: c.slug },
        token: t,
        withOps: true,
      });
      await loadCategories();
    } catch (e) {
      window.alert(e.message);
    }
  }

  async function deleteCategory(id) {
    if (!window.confirm("Удалить категорию? Должна быть без подкатегорий и объявлений.")) return;
    const t = getStaffToken();
    try {
      await staffFetch(`/admin/catalog/categories/${id}`, { method: "DELETE", token: t, withOps: true });
      await loadCategories();
    } catch (e) {
      window.alert(e.message);
    }
  }

  const u = typeof window !== "undefined" ? getStoredUser() : null;
  const isAdmin = me?.is_super_admin;

  return (
    <>
      <Head>
        <title>Администратор · Devor</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div className="app-shell youla-app-shell">
        <div className="page youla-page staff-page">
          <AppHeader />
          <main className="staff-main">
            <nav className="staff-breadcrumb">
              <Link href="/staff">Служебный вход</Link>
              <span> / </span>
              <span>Администратор</span>
            </nav>

            <header className="staff-hero">
              <h1 className="staff-title">Администрирование</h1>
              <p className="staff-lead">
                Раздача ролей, список пользователей, добавление <strong>разделов</strong> и <strong>подразделов</strong> (категорий). Требуется роль{" "}
                <code>admin</code> и <strong>секрет операций</strong> (<code>DEVOR_OPS_SECRET</code>).
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
                      setOpsOk(false);
                    }}
                  >
                    Выйти
                  </button>
                </div>
              )}
            </section>

            {token && meError ? <p className="staff-error staff-card">{meError}</p> : null}
            {token && u && !isStaffRole(u.role) ? <p className="staff-error staff-card">Нет прав.</p> : null}

            {token && isAdmin ? (
              <section className="staff-card staff-card--ops">
                <h2 className="staff-h2">Секрет операций</h2>
                <p className="staff-muted">Без секрета недоступны пользователи и каталог.</p>
                <div className="staff-ops-row">
                  <input
                    className="staff-input staff-input--flex"
                    type="password"
                    placeholder="DEVOR_OPS_SECRET"
                    value={opsInput}
                    onChange={(e) => setOpsInput(e.target.value)}
                    autoComplete="off"
                  />
                  <button type="button" className="staff-btn staff-btn--dark" onClick={verifyOps}>
                    Проверить
                  </button>
                </div>
                {opsMessage ? <p className={opsOk ? "staff-success" : "staff-error"}>{opsMessage}</p> : null}
              </section>
            ) : null}

            {token && isAdmin && opsOk ? (
              <>
                <div className="staff-tabs">
                  <button type="button" className={`staff-tab ${tab === "users" ? "is-active" : ""}`} onClick={() => setTab("users")}>
                    Пользователи и роли
                  </button>
                  <button type="button" className={`staff-tab ${tab === "catalog" ? "is-active" : ""}`} onClick={() => setTab("catalog")}>
                    Разделы и подразделы
                  </button>
                </div>

                {tab === "users" ? (
                  <section className="staff-card">
                    <h2 className="staff-h2">Все пользователи</h2>
                    <p className="staff-muted">{usersLoading ? "Загрузка…" : `${users.length} записей`}</p>
                    <div className="staff-table-wrap">
                      <table className="staff-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Логин</th>
                            <th>Имя</th>
                            <th>Роль</th>
                            <th>Назначить</th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((row) => (
                            <tr key={row.id}>
                              <td>{row.id}</td>
                              <td>{row.login}</td>
                              <td>{row.name || "—"}</td>
                              <td>{row.role}</td>
                              <td>
                                <select
                                  className="staff-select"
                                  defaultValue={row.role}
                                  onChange={(e) => setUserRole(row.id, e.target.value)}
                                  aria-label={`Роль ${row.login}`}
                                >
                                  <option value="user">user</option>
                                  <option value="manager">manager</option>
                                  <option value="admin">admin</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ) : null}

                {tab === "catalog" ? (
                  <>
                    <section className="staff-card">
                      <h2 className="staff-h2">Новый раздел</h2>
                      <p className="staff-muted">key — латиница и _, slug — для URL.</p>
                      <form className="staff-grid-form" onSubmit={createSection}>
                        <input
                          className="staff-input"
                          placeholder="key (например auto)"
                          value={newSection.key}
                          onChange={(e) => setNewSection((s) => ({ ...s, key: e.target.value }))}
                        />
                        <input
                          className="staff-input"
                          placeholder="Название RU"
                          value={newSection.name_ru}
                          onChange={(e) => setNewSection((s) => ({ ...s, name_ru: e.target.value }))}
                        />
                        <input
                          className="staff-input"
                          placeholder="Название TJ"
                          value={newSection.name_tj}
                          onChange={(e) => setNewSection((s) => ({ ...s, name_tj: e.target.value }))}
                        />
                        <input
                          className="staff-input"
                          placeholder="slug"
                          value={newSection.slug}
                          onChange={(e) => setNewSection((s) => ({ ...s, slug: e.target.value }))}
                        />
                        <button type="submit" className="staff-btn staff-btn--primary">
                          Создать раздел
                        </button>
                      </form>
                      <h3 className="staff-h3">Разделы в базе</h3>
                      <ul className="staff-inline-list">
                        {sections.map((s) => (
                          <li key={s.id}>
                            <strong>{s.key}</strong> — {s.name_ru}
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section className="staff-card">
                      <h2 className="staff-h2">Категории в разделе</h2>
                      <label className="staff-label">
                        Раздел (key)
                        <select className="staff-input" value={sectionKey} onChange={(e) => setSectionKey(e.target.value)}>
                          {sections.length ? (
                            sections.map((s) => (
                              <option key={s.id} value={s.key}>
                                {s.key} ({s.name_ru})
                              </option>
                            ))
                          ) : (
                            <option value="services">services</option>
                          )}
                        </select>
                      </label>
                      <button type="button" className="staff-btn staff-btn--ghost" onClick={() => loadCategories()}>
                        Обновить список
                      </button>
                      <p className="staff-muted">{catLoading ? "Загрузка…" : `Категорий: ${categories.length}`}</p>

                      <h3 className="staff-h3">Добавить подраздел</h3>
                      <form className="staff-grid-form" onSubmit={createCategory}>
                        <input
                          className="staff-input"
                          placeholder="Название RU"
                          value={newCat.name_ru}
                          onChange={(e) => setNewCat((c) => ({ ...c, name_ru: e.target.value }))}
                        />
                        <input
                          className="staff-input"
                          placeholder="Название TJ (необяз.)"
                          value={newCat.name_tj}
                          onChange={(e) => setNewCat((c) => ({ ...c, name_tj: e.target.value }))}
                        />
                        <input
                          className="staff-input"
                          placeholder="slug (латиница-дефис)"
                          value={newCat.slug}
                          onChange={(e) => setNewCat((c) => ({ ...c, slug: e.target.value }))}
                        />
                        <input
                          className="staff-input"
                          placeholder="ID родителя (пусто = корень)"
                          value={newCat.parent_id}
                          onChange={(e) => setNewCat((c) => ({ ...c, parent_id: e.target.value }))}
                        />
                        <button type="submit" className="staff-btn staff-btn--primary">
                          Создать категорию
                        </button>
                      </form>

                      <div className="staff-table-wrap staff-table-wrap--mt">
                        <table className="staff-table staff-table--compact">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>lvl</th>
                              <th>parent</th>
                              <th>slug</th>
                              <th>RU</th>
                              <th>TJ</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {categories.map((c) => (
                              <CategoryEditorRow key={c.id} c={c} onSave={saveCategoryRow} onDelete={deleteCategory} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                ) : null}
              </>
            ) : null}

            <footer className="staff-foot">
              <Link href="/staff">← К служебному входу</Link>
              {" · "}
              <Link href="/staff/manager">Модерация</Link>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}

function CategoryEditorRow({ c, onSave, onDelete }) {
  const [nameRu, setNameRu] = useState(c.name_ru);
  const [nameTj, setNameTj] = useState(c.name_tj);
  const [slug, setSlug] = useState(c.slug);
  useEffect(() => {
    setNameRu(c.name_ru);
    setNameTj(c.name_tj);
    setSlug(c.slug);
  }, [c.id, c.name_ru, c.name_tj, c.slug]);

  return (
    <tr>
      <td>{c.id}</td>
      <td>{c.level}</td>
      <td>{c.parent_id ?? "—"}</td>
      <td>
        <input className="staff-input staff-input--table" value={slug} onChange={(e) => setSlug(e.target.value)} />
      </td>
      <td>
        <input className="staff-input staff-input--table" value={nameRu} onChange={(e) => setNameRu(e.target.value)} />
      </td>
      <td>
        <input className="staff-input staff-input--table" value={nameTj} onChange={(e) => setNameTj(e.target.value)} />
      </td>
      <td className="staff-actions">
        <button type="button" className="staff-linkish" onClick={() => onSave({ ...c, name_ru: nameRu, name_tj: nameTj, slug })}>
          Сохранить
        </button>
        <button type="button" className="staff-linkish staff-linkish--danger" onClick={() => onDelete(c.id)}>
          Удалить
        </button>
      </td>
    </tr>
  );
}
