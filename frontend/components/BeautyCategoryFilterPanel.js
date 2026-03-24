import Link from "next/link";

import { BEAUTY_PARENT_SLUG } from "../lib/beautyCategoryLanding";
import { buildCategoryHref } from "../lib/categoryLinks";
import { getBeautyServiceOptions } from "../lib/beautySubcategoryFilters";
import { useLanguage } from "../contexts/LanguageContext";

/**
 * Левая колонка фильтров для раздела «Красота» и подкатегорий beauty-* (референс UI).
 */
export default function BeautyCategoryFilterPanel({ draft, updateDraft, slug, prettySlug, sectionKey, cities }) {
  const { lang } = useLanguage();
  const isTj = lang === "tj";
  const serviceOptions = getBeautyServiceOptions(slug, lang);
  const isRootBeauty = slug === BEAUTY_PARENT_SLUG;

  return (
    <>
      <div className="cat-filter-beauty-nav">
        <div className="cat-filter-beauty-back-row">
          <Link href={`/?section=${sectionKey}`} className="cat-filter-beauty-back">
            {isTj ? "‹ Хизматҳо" : "‹ Услуги"}
          </Link>
          {!isRootBeauty ? (
            <Link href={buildCategoryHref(BEAUTY_PARENT_SLUG, sectionKey)} className="cat-filter-beauty-back">
              {isTj ? "‹ Зебоӣ" : "‹ Красота"}
            </Link>
          ) : null}
        </div>
        <h2 className="cat-filter-beauty-current">{prettySlug}</h2>
      </div>

      <p className="category-filters-hint cat-filter-beauty-hint">
        {isTj
          ? "Филтрҳо барои категорияи «Зебоӣ»: натиҷаҳоро дар ин саҳифа дақиқ мекунанд. Қисме аз шартҳо аз рӯи матни эълон кор мекунанд (мантиқи намоишӣ)."
          : "Фильтры для категории «Красота»: уточняют выдачу на этой странице. Часть условий работает по тексту объявления (демо-логика)."}
      </p>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Хизмат" : "Услуга"}</h3>
        <label className="category-filter-field cat-filter-field-plain cat-filter-beauty-select-wrap">
          <select
            className="cat-filter-beauty-select"
            value={draft.beautyServiceType}
            onChange={(e) => updateDraft({ beautyServiceType: e.target.value })}
            aria-label={isTj ? "Хизмат" : "Услуга"}
          >
            {serviceOptions.map((o) => (
              <option key={o.value || "__any"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Кай ба хизмат лозим аст" : "Когда нужна услуга"}</h3>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.needToday} onChange={(e) => updateDraft({ needToday: e.target.checked })} />
          <span>{isTj ? "Имрӯз" : "Сегодня"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.needTomorrow} onChange={(e) => updateDraft({ needTomorrow: e.target.checked })} />
          <span>{isTj ? "Фардо" : "Завтра"}</span>
        </label>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Нарх, сом." : "Стоимость, сом."}</h3>
        <div className="category-filter-price-row cat-filter-price-row">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={isTj ? "Аз" : "От"}
            value={draft.priceFrom}
            onChange={(e) => updateDraft({ priceFrom: e.target.value })}
          />
          <input
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={isTj ? "То" : "до"}
            value={draft.priceTo}
            onChange={(e) => updateDraft({ priceTo: e.target.value })}
          />
        </div>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.beautyPromoOnly} onChange={(e) => updateDraft({ beautyPromoOnly: e.target.checked })} />
          <span>{isTj ? "Аксияҳо" : "Акции"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input
            type="checkbox"
            checked={draft.beautyOnlineBooking}
            onChange={(e) => updateDraft({ beautyOnlineBooking: e.target.checked })}
          />
          <span>{isTj ? "Сабти онлайн" : "Онлайн-запись"}</span>
        </label>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Шаҳр" : "Город"}</h3>
        <label className="category-filter-field cat-filter-field-plain">
          <select value={draft.city} onChange={(e) => updateDraft({ city: e.target.value })}>
            <option value="">{isTj ? "Ҳама шаҳрҳо" : "Все города"}</option>
            {cities.filter(Boolean).map((c) => (
              <option value={c} key={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="cat-filter-section">
        <div className="cat-filter-section-head">
          <h3 className="cat-filter-section-title">{isTj ? "Кӣ хизмат мерасонад" : "Кто оказывает услуги"}</h3>
          <span className="cat-filter-new-badge">{isTj ? "Нав" : "Новое"}</span>
        </div>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.cbPrivate} onChange={(e) => updateDraft({ cbPrivate: e.target.checked })} />
          <span>{isTj ? "Иҷрокунандаи хусусӣ" : "Частный исполнитель"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.cbCompany} onChange={(e) => updateDraft({ cbCompany: e.target.checked })} />
          <span>{isTj ? "Ширкат ё гурӯҳ" : "Компания или команда"}</span>
        </label>
      </div>

      <div className="cat-filter-reliable-card">
        <div className="cat-filter-reliable-icon" aria-hidden>
          🏅
        </div>
        <div className="cat-filter-reliable-text">
          <div className="cat-filter-reliable-title">{isTj ? "Иҷрокунандаи боэътимод" : "Надёжный исполнитель"}</div>
          <div className="cat-filter-reliable-sub">{isTj ? "Репутацияро нигоҳ медорад" : "Следит за репутацией"}</div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.reliableOnly}
          className={`cat-filter-toggle ${draft.reliableOnly ? "is-on" : ""}`}
          onClick={() => updateDraft({ reliableOnly: !draft.reliableOnly })}
        />
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Рейтинги иҷрокунанда" : "Рейтинг исполнителя"}</h3>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.stars4Plus} onChange={(e) => updateDraft({ stars4Plus: e.target.checked })} />
          <span>{isTj ? "Рейтинг 4 ситора ва бештар" : "Рейтинг 4 звезды и выше"}</span>
        </label>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Ҷинси иҷрокунанда" : "Пол исполнителя"}</h3>
        <div
          className="cat-filter-segment-group cat-filter-beauty-seg"
          role="group"
          aria-label={isTj ? "Ҷинси иҷрокунанда" : "Пол исполнителя"}
        >
          {[
            { k: "any", l: isTj ? "Фарқ надорад" : "Неважно" },
            { k: "female", l: isTj ? "Занона" : "Женский" },
            { k: "male", l: isTj ? "Мардона" : "Мужской" },
          ].map(({ k, l }) => (
            <button
              key={k}
              type="button"
              className={`cat-filter-seg ${draft.beautyGender === k ? "is-active" : ""}`}
              onClick={() => updateDraft({ beautyGender: k })}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Бо кӣ кор мекунад иҷрокунанда" : "С кем работает исполнитель"}</h3>
        <div
          className="cat-filter-segment-group cat-filter-beauty-seg"
          role="group"
          aria-label={isTj ? "Гурӯҳи аудиторияи иҷрокунанда" : "Аудитория исполнителя"}
        >
          {[
            { k: "any", l: isTj ? "Фарқ надорад" : "Неважно" },
            { k: "women", l: isTj ? "Занҳо" : "Женщины" },
            { k: "men", l: isTj ? "Мардҳо" : "Мужчины" },
          ].map(({ k, l }) => (
            <button
              key={k}
              type="button"
              className={`cat-filter-seg ${draft.beautyAudience === k ? "is-active" : ""}`}
              onClick={() => updateDraft({ beautyAudience: k })}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Таҷрибаи корӣ" : "Опыт работы"}</h3>
        <label className="category-filter-field cat-filter-field-plain cat-filter-beauty-select-wrap">
          <select
            className="cat-filter-beauty-select"
            value={draft.beautyExperience}
            onChange={(e) => updateDraft({ beautyExperience: e.target.value })}
            aria-label={isTj ? "Таҷрибаи корӣ" : "Опыт работы"}
          >
            <option value="">{isTj ? "Таҷрибаи корӣ" : "Опыт работы"}</option>
            <option value="lt1">{isTj ? "То 1 сол" : "До 1 года"}</option>
            <option value="1-3">{isTj ? "1–3 сол" : "1–3 года"}</option>
            <option value="3-5">{isTj ? "3–5 сол" : "3–5 лет"}</option>
            <option value="5plus">{isTj ? "Зиёда аз 5 сол" : "Более 5 лет"}</option>
          </select>
        </label>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Ҷои мулоқот" : "Место встречи"}</h3>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.beautyPlaceHome} onChange={(e) => updateDraft({ beautyPlaceHome: e.target.checked })} />
          <span>{isTj ? "Дар хонаам" : "У меня дома"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input
            type="checkbox"
            checked={draft.beautyPlaceMasterHome}
            onChange={(e) => updateDraft({ beautyPlaceMasterHome: e.target.checked })}
          />
          <span>{isTj ? "Дар хонаи иҷрокунанда" : "У исполнителя дома"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.beautyPlaceSalon} onChange={(e) => updateDraft({ beautyPlaceSalon: e.target.checked })} />
          <span>{isTj ? "Дар салон" : "В салоне"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.beautyPlaceCowork} onChange={(e) => updateDraft({ beautyPlaceCowork: e.target.checked })} />
          <span>{isTj ? "Дар коворкинг" : "В коворкинге"}</span>
        </label>
        <label className="category-filter-checkbox cat-filter-checkbox-square">
          <input type="checkbox" checked={draft.beautyPlaceStudio} onChange={(e) => updateDraft({ beautyPlaceStudio: e.target.checked })} />
          <span>{isTj ? "Дар студия ё кабинет" : "В студии или кабинете"}</span>
        </label>
      </div>

      <div className="cat-filter-section cat-filter-beauty">
        <h3 className="cat-filter-section-title">{isTj ? "Калимаҳо дар тавсиф" : "Слова в описании"}</h3>
        <input
          type="search"
          className="cat-filter-input-full cat-filter-beauty-input"
          placeholder={isTj ? "Барои шумо чизи муҳим" : "Что-то важное для вас"}
          value={draft.q}
          onChange={(e) => updateDraft({ q: e.target.value })}
          autoComplete="off"
        />
      </div>
    </>
  );
}
