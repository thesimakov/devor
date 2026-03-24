/**
 * Демо-сценарий MVP (TypeScript): телефон → заявка → (остальное через API /docs).
 * Tojik / рус: тексты можно вынести в locales (tj/common.json).
 */
import Head from "next/head";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { clearAuthData, setAuthData } from "../lib/auth";
import { filterCategoryTreeToBeautyOnly, flattenCategoryNodes } from "../lib/servicesScope";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type UserBrief = { id: number; login: string; name?: string | null };

export default function MvpPage() {
  const [phone, setPhone] = useState("+992 90 000 00 00");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState<UserBrief | null>(null);
  const [categories, setCategories] = useState<{ id: number; name_ru: string }[]>([]);
  const [title, setTitle] = useState("Маникюр на дому");
  const [description, setDescription] = useState("Опишите задачу подробно (минимум 10 символов).");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [listingId, setListingId] = useState<number | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const r = await fetch(`${API}/categories?section=services`);
      const data = await r.json();
      const tree = filterCategoryTreeToBeautyOnly(Array.isArray(data) ? data : []);
      const flat = flattenCategoryNodes(tree).map((n) => ({ id: n.id, name_ru: n.name_ru }));
      setCategories(flat);
      if (flat[0]) setCategoryId(flat[0].id);
    } catch {
      setMsg("Не удалось загрузить категории");
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  async function requestCode(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await fetch(`${API}/auth/request-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    if (!r.ok) {
      setMsg("Ошибка отправки кода");
      return;
    }
    setMsg("Код отправлен (в режиме mock смотрите консоль backend: SHOW_DEBUG_OTP=true).");
  }

  async function verifyCode(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await fetch(`${API}/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, name: "MVP User" }),
    });
    if (!r.ok) {
      setMsg("Неверный код или ошибка сервера");
      return;
    }
    const data = await r.json();
    setToken(data.access_token);
    setUser(data.user);
    setAuthData(data.access_token, data.user);
    setMsg("Вход выполнен.");
  }

  async function topupDemo() {
    if (!token) return;
    setMsg("");
    const r = await fetch(`${API}/billing/wallet/topup-demo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ amount_som: 500 }),
    });
    if (!r.ok) {
      setMsg("Пополнение недоступно");
      return;
    }
    setMsg("Кошелёк пополнен на 500 сом (демо).");
  }

  async function createRequest(e: FormEvent) {
    e.preventDefault();
    if (!token || !categoryId) return;
    setMsg("");
    const r = await fetch(`${API}/listings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        title,
        description,
        price: null,
        category_id: categoryId,
        city: "Душанбе",
        status: "active",
        kind: "request",
        budget_min: 100,
        budget_max: 500,
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      setMsg((err as { detail?: string }).detail || "Ошибка создания заявки");
      return;
    }
    const listing = await r.json();
    setListingId(listing.id);
    setMsg(`Заявка #${listing.id} создана. Дальше: исполнитель откликается → вы назначаете → эскроу POST /escrow/...`);
  }

  async function telegramLink() {
    if (!token) return;
    const r = await fetch(`${API}/integrations/telegram/link-request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) {
      setMsg("Telegram не настроен (TELEGRAM_BOT_TOKEN на сервере)");
      return;
    }
    const data = await r.json();
    setMsg(`Откройте в Telegram: ${data.deep_link}`);
  }

  function logout() {
    clearAuthData();
    setToken("");
    setUser(null);
    setListingId(null);
    setMsg("Вы вышли.");
  }

  return (
    <>
      <Head>
        <title>MVP — Devor</title>
      </Head>
      <main style={{ maxWidth: 520, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: "1.35rem" }}>Devor MVP</h1>
        <p style={{ color: "#475569", fontSize: 14 }}>
          Рус / Тоҷик: интерфейс основного сайта — в{" "}
          <a href="/">каталоге</a>. Здесь — краткий тестовый сценарий (TypeScript).
        </p>

        <section style={{ marginTop: 20 }}>
          <h2>1. Телефон</h2>
          <form onSubmit={requestCode} style={{ display: "grid", gap: 8 }}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+992 …"
              style={{ padding: 8 }}
            />
            <button type="submit">Получить код (SMS mock)</button>
          </form>
          <form onSubmit={verifyCode} style={{ display: "grid", gap: 8, marginTop: 12 }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код" style={{ padding: 8 }} />
            <button type="submit">Войти</button>
          </form>
        </section>

        {user ? (
          <section style={{ marginTop: 24 }}>
            <p>
              <strong>Пользователь:</strong> {user.name || user.login} (id {user.id})
            </p>
            <button type="button" onClick={topupDemo}>
              Пополнить кошелёк (демо +500 сом)
            </button>
            <button type="button" onClick={telegramLink} style={{ marginLeft: 8 }}>
              Получить ссылку Telegram
            </button>
            <button type="button" onClick={logout} style={{ marginLeft: 8 }}>
              Выйти
            </button>
          </section>
        ) : null}

        {token ? (
          <section style={{ marginTop: 24 }}>
            <h2>2. Заявка заказчика</h2>
            <form onSubmit={createRequest} style={{ display: "grid", gap: 8 }}>
              <select
                value={categoryId === "" ? "" : String(categoryId)}
                onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name_ru}
                  </option>
                ))}
              </select>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ padding: 8 }} />
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} style={{ padding: 8 }} />
              <button type="submit">Создать заявку (kind=request)</button>
            </form>
            {listingId ? (
              <p style={{ marginTop: 12 }}>
                Открыть:{" "}
                <a href={`/listings/${listingId}`} target="_blank" rel="noreferrer">
                  /listings/{listingId}
                </a>{" "}
                · Эскроу и отзывы — см. Swagger{" "}
                <a href={`${API}/docs`} target="_blank" rel="noreferrer">
                  /docs
                </a>
              </p>
            ) : null}
          </section>
        ) : null}

        {msg ? (
          <p style={{ marginTop: 20, padding: 12, background: "#f1f5f9", borderRadius: 8, whiteSpace: "pre-wrap" }}>{msg}</p>
        ) : null}
      </main>
    </>
  );
}
