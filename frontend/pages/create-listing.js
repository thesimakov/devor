import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import AppHeader from "../components/AppHeader";
import AuthPhoneForm from "../components/AuthPhoneForm";
import { CONTENT_IMAGES } from "../lib/contentAssets";
import { apiFetch, getApiUrl } from "../lib/api";
import { fallbackCategoriesBySection } from "../lib/mockData";
import { filterCategoryTreeToBeautyOnly } from "../lib/servicesScope";

const CITIES = ["Душанбе", "Худжанд", "Бохтар", "Кулоб", "Истаравшан", "Турсунзода"];

function flattenCategories(items, result = [], prefix = "") {
  items.forEach((item) => {
    result.push({ id: item.id, label: `${prefix}${item.name_ru}` });
    if (item.children?.length) {
      flattenCategories(item.children, result, `${prefix}— `);
    }
  });
  return result;
}

export default function CreateListingPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState(CITIES[0]);
  const [categoryId, setCategoryId] = useState("");
  const [files, setFiles] = useState([]);
  /** offer — услуга исполнителя; request — заявка заказчика (ТЗ). */
  const [kind, setKind] = useState("offer");
  const [auctionMode, setAuctionMode] = useState(false);
  const [addressLine, setAddressLine] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);

  useEffect(() => {
    if (!router.isReady) return;
    const raw = router.query?.auction;
    const enabled = raw === "1" || raw === "true";
    if (enabled) {
      setAuctionMode(true);
      setKind("offer");
    } else {
      setAuctionMode(false);
    }
  }, [router.isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function loadCategories() {
      try {
        const response = await fetch(`${getApiUrl()}/categories?section=services`);
        if (!response.ok) throw new Error("categories api failed");
        const payload = await response.json();
        const raw = Array.isArray(payload) && payload.length ? payload : fallbackCategoriesBySection.services;
        setCategories(filterCategoryTreeToBeautyOnly(raw));
        const options = flattenCategories(safePayload);
        if (options[0]) {
          setCategoryId(String(options[0].id));
        }
      } catch {
        const fallback = filterCategoryTreeToBeautyOnly(fallbackCategoriesBySection.services);
        setCategories(fallback);
        const options = flattenCategories(fallback);
        if (options[0]) {
          setCategoryId(String(options[0].id));
        }
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    if (!categoryOptions.length) return;
    const currentExists = categoryOptions.some((item) => String(item.id) === String(categoryId));
    if (!currentExists) {
      setCategoryId(String(categoryOptions[0].id));
    }
  }, [categoryOptions, categoryId]);

  function fillGeo() {
    if (!navigator.geolocation) {
      setMessage("Геолокация недоступна в этом браузере");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(String(pos.coords.latitude.toFixed(6)));
        setLng(String(pos.coords.longitude.toFixed(6)));
        setMessage("");
      },
      () => setMessage("Не удалось получить координаты (проверьте разрешения)"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!categoryId) {
      setMessage("Выберите категорию");
      return;
    }
    if (auctionMode) {
      const parsedPrice = Number(price);
      if (!price || Number.isNaN(parsedPrice) || parsedPrice <= 0) {
        setMessage("Для аукциона укажите стартовую цену больше 0");
        return;
      }
      const dl = deadlineAt ? new Date(deadlineAt) : null;
      if (!dl || Number.isNaN(dl.getTime())) {
        setMessage("Выберите окончание аукциона");
        return;
      }
      if (dl.getTime() <= Date.now()) {
        setMessage("Окончание аукциона должно быть в будущем");
        return;
      }
    }
    setLoading(true);
    setMessage("");
    try {
      const payload = {
        title,
        description,
        price: kind === "offer" && price ? Number(price) : null,
        category_id: Number(categoryId),
        city,
        status: "active",
        kind,
        address_line: addressLine.trim() || null,
        deadline_at: deadlineAt ? new Date(deadlineAt).toISOString() : null,
        budget_min: kind === "request" && budgetMin ? Number(budgetMin) : null,
        budget_max: kind === "request" && budgetMax ? Number(budgetMax) : null,
        latitude: lat ? Number(lat) : null,
        longitude: lng ? Number(lng) : null,
      };

      const listing = await apiFetch("/listings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        await apiFetch(`/listings/${listing.id}/images`, {
          method: "POST",
          body,
        });
      }

      setMessage(`Объявление #${listing.id} создано`);
      setTitle("");
      setDescription("");
      setPrice("");
      setFiles([]);
      setAddressLine("");
      setDeadlineAt("");
      setAuctionMode(false);
      setKind("offer");
      setBudgetMin("");
      setBudgetMax("");
      setLat("");
      setLng("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  const heroSubtitle = auctionMode
    ? "Укажите стартовую цену и окончание аукциона — после дедлайна лот попадёт в корзину победителя."
    : kind === "request"
      ? "Опишите задачу, бюджет и срок — исполнители увидят заявку в ленте и смогут откликнуться."
      : "Заполните форму, добавьте фото и получите отклики от клиентов.";

  return (
    <div className="app-shell youla-app-shell">
      <div className="page youla-page create-page">
        <AppHeader />

        <main className="form-page">
          <section className="hero-card listing-hero listing-hero-split">
            <div className="listing-hero-copy">
              <div className="breadcrumbs">Главная / Подача объявления</div>
              <h1>{auctionMode ? "Разместить лот в аукцион" : "Разместить объявление"}</h1>
              <p>{heroSubtitle}</p>
              <div className="listing-hero-points">
                <span className="tag-soft">1. Авторизуйтесь</span>
                <span className="tag-soft">2. Заполните описание</span>
                <span className="tag-soft">3. Гео и голос — по желанию</span>
                <span className="tag-soft">4. Опубликуйте</span>
              </div>
            </div>
            <div className="listing-hero-photo">
              <img
                src={CONTENT_IMAGES.publish}
                alt=""
                width={640}
                height={400}
                loading="lazy"
                className="listing-hero-photo-img"
              />
            </div>
          </section>

          <AuthPhoneForm onAuthed={(token) => setAuthed(Boolean(token))} />

          {authed ? (
            <form className="listing-form listing-form-premium" onSubmit={handleSubmit}>
              <h2>Данные объявления</h2>

              <div className="form-grid">
                <div className="form-col-wide">
                  <label className="filter-label">Тип</label>
                  <div className="kind-toggle">
                    <button
                      type="button"
                      className={!auctionMode && kind === "offer" ? "primary kind-pill" : "ghost kind-pill"}
                      onClick={() => {
                        setAuctionMode(false);
                        setKind("offer");
                        setDeadlineAt("");
                      }}
                    >
                      Услуга (исполнитель)
                    </button>
                    <button
                      type="button"
                      className={!auctionMode && kind === "request" ? "primary kind-pill" : "ghost kind-pill"}
                      onClick={() => {
                        setAuctionMode(false);
                        setKind("request");
                        setDeadlineAt("");
                      }}
                    >
                      Заявка (заказчик)
                    </button>
                    <button
                      type="button"
                      className={auctionMode ? "primary kind-pill" : "ghost kind-pill"}
                      onClick={() => {
                        setAuctionMode(true);
                        setKind("offer");
                        setDeadlineAt("");
                      }}
                    >
                      Аукцион (лот)
                    </button>
                  </div>
                  <p className="file-note">
                    Заявка — когда нужен мастер; услуга — когда вы предлагаете работу.
                    Аукцион — это лот с дедлайном и стартовой ценой: после окончания время покупателю попадёт лот в корзину.
                  </p>
                </div>
              </div>

              <div className="form-grid">
                <div className="form-col-wide">
                  <label className="filter-label">Заголовок</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      kind === "request" ? "Например: нужен сантехник, протечка на кухне" : "Например: ремонт квартир под ключ"
                    }
                    required
                  />
                </div>
                <div>
                  <label className="filter-label">Категория</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
                    {categoryOptions.map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="filter-label">Описание</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  kind === "request"
                    ? "Опишите задачу, объект, удобное время для звонка."
                    : "Опишите услугу, опыт, что входит в стоимость, районы выезда и т.д."
                }
                rows={6}
                required
              />

              <div className="form-grid">
                {kind === "offer" ? (
                  <div>
                      <label className="filter-label">{auctionMode ? "Стартовая цена (смн)" : "Цена (смн)"}</label>
                    <input
                      type="number"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                        placeholder={auctionMode ? "Например 500" : "Оставьте пустым, если договорная"}
                    />
                      {auctionMode ? <p className="file-note" style={{ marginTop: 6 }}>Для аукциона нужна стартовая цена &gt; 0.</p> : null}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="filter-label">Бюджет от (смн)</label>
                      <input
                        type="number"
                        value={budgetMin}
                        onChange={(e) => setBudgetMin(e.target.value)}
                        placeholder="Необязательно"
                      />
                    </div>
                    <div>
                      <label className="filter-label">Бюджет до (смн)</label>
                      <input
                        type="number"
                        value={budgetMax}
                        onChange={(e) => setBudgetMax(e.target.value)}
                        placeholder="Необязательно"
                      />
                    </div>
                  </>
                )}
                <div>
                  <label className="filter-label">Город</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)}>
                    {CITIES.map((item) => (
                      <option value={item} key={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {kind === "request" || auctionMode ? (
                <div className="form-grid">
                  <div>
                    <label className="filter-label">{auctionMode ? "Окончание аукциона" : "Срок выполнения"}</label>
                    <input type="datetime-local" value={deadlineAt} onChange={(e) => setDeadlineAt(e.target.value)} />
                    {auctionMode ? (
                      <p className="file-note" style={{ marginTop: 6 }}>
                        Дата и время окончания — после этого лот уйдёт победителю в корзину.
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <label className="filter-label">Адрес (текст, для карты позже)</label>
              <input
                value={addressLine}
                onChange={(e) => setAddressLine(e.target.value)}
                placeholder="Улица, ориентир — для заявок важно для мастера"
              />

              <div className="form-grid">
                <div>
                  <label className="filter-label">Широта</label>
                  <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="Например 38.5590" />
                </div>
                <div>
                  <label className="filter-label">Долгота</label>
                  <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="Например 68.7740" />
                </div>
                <div className="form-col-wide geo-actions">
                  <button type="button" className="ghost" onClick={fillGeo}>
                    Определить координаты
                  </button>
                </div>
              </div>

              <label className="filter-label">Фотографии (JPEG/PNG/WEBP)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
              {files.length > 0 ? <div className="file-note">Выбрано файлов: {files.length}</div> : null}

              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Сохранение..." : "Опубликовать"}
              </button>
              {message ? <p className="auth-message">{message}</p> : null}
            </form>
          ) : (
            <div className="auth-warning">Сначала войдите по логину и паролю, затем можно публиковать объявления.</div>
          )}
        </main>
      </div>
    </div>
  );
}
