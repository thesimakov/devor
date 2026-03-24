import { BEAUTY_PARENT_SLUG } from "./beautyCategoryLanding";

/** Показывать расширенный блок фильтров «как в референсе» для красоты. */
export function isBeautyServicesSlug(slug) {
  return typeof slug === "string" && (slug === BEAUTY_PARENT_SLUG || slug.startsWith("beauty-"));
}

/** Значения по умолчанию для полей пресета «Красота» (мержатся в общий state фильтров). */
export const BEAUTY_FILTER_DEFAULTS = {
  beautyServiceType: "",
  needToday: false,
  needTomorrow: false,
  beautyPromoOnly: false,
  beautyOnlineBooking: false,
  beautyGender: "any",
  beautyAudience: "any",
  beautyExperience: "",
  beautyPlaceHome: false,
  beautyPlaceMasterHome: false,
  beautyPlaceSalon: false,
  beautyPlaceCowork: false,
  beautyPlaceStudio: false,
};

/**
 * Варианты выпадающего списка «Услуга» по подкатегории (value — подстрока поиска в тексте объявления).
 */
export function getBeautyServiceOptions(slug, lang = "ru") {
  const isTj = lang === "tj";
  const common = [{ value: "", label: isTj ? "Хизмат" : "Услуга" }];
  const bySlug = {
    "beauty-kosmetologiya": [
      ...common,
      { value: "чистк", label: isTj ? "Тозакунии рӯй" : "Чистка лица" },
      { value: "инъекц", label: isTj ? "Тартиботи сӯзандору" : "Инъекционные процедуры" },
      { value: "аппарат", label: isTj ? "Косметологияи бо дастгоҳ" : "Аппаратная косметология" },
      { value: "пилинг", label: "Пилинг" },
      { value: "уход", label: isTj ? "Тартиботи нигоҳубин" : "Уходовые процедуры" },
      { value: "массаж", label: isTj ? "Массажи рӯй" : "Массаж лица" },
    ],
    "beauty-manikyur-pedikyur": [
      ...common,
      { value: "маникюр", label: "Маникюр" },
      { value: "педикюр", label: "Педикюр" },
      { value: "наращивание", label: isTj ? "Дароз кардан" : "Наращивание" },
      { value: "дизайн", label: isTj ? "Тарроҳии нохунҳо" : "Дизайн ногтей" },
      { value: "гель", label: isTj ? "Пӯшиши гел-лак" : "Покрытие гель-лак" },
    ],
    "beauty-parikmaherskie-uslugi": [
      ...common,
      { value: "стрижк", label: isTj ? "Буридани мӯй" : "Стрижка" },
      { value: "окраш", label: isTj ? "Рангубор" : "Окрашивание" },
      { value: "укладк", label: isTj ? "Сохтани мӯй" : "Укладка" },
      { value: "барбер", label: isTj ? "Барбер / толори мардона" : "Барбер / мужской зал" },
    ],
    "beauty-resnitsy-brovi": [
      ...common,
      { value: "ресниц", label: isTj ? "Пилкҳо" : "Ресницы" },
      { value: "бров", label: isTj ? "Абрӯвон" : "Брови" },
      { value: "ламинат", label: isTj ? "Ламинатсия" : "Ламинирование" },
    ],
    "beauty-permanentnyy-makiyazh": [
      ...common,
      { value: "перманент", label: isTj ? "Ороиши доимӣ" : "Перманентный макияж" },
      { value: "татуаж", label: isTj ? "Татуаж" : "Татуаж" },
    ],
    "beauty-epilyatsiya": [
      ...common,
      { value: "лазер", label: isTj ? "Эпилятсияи лазерӣ" : "Лазерная эпиляция" },
      { value: "шугаринг", label: isTj ? "Шугаринг / мум" : "Шугаринг / воск" },
    ],
    "beauty-makiyazh": [
      ...common,
      { value: "макияж", label: isTj ? "Ороиш" : "Макияж" },
      { value: "вечер", label: isTj ? "Шомӣ / тӯёна" : "Вечерний / свадебный" },
    ],
    "beauty-spa-massazh": [
      ...common,
      { value: "массаж", label: "Массаж" },
      { value: "спа", label: isTj ? "Барномаҳои СПА" : "СПА-программы" },
      { value: "обёртыван", label: isTj ? "Печонданҳо" : "Обёртывания" },
    ],
    "beauty-tatu-pirsing": [
      ...common,
      { value: "тату", label: isTj ? "Тату" : "Татуировка" },
      { value: "пирсинг", label: "Пирсинг" },
    ],
    "beauty-arenda-rabochego-mesta": [
      ...common,
      { value: "аренд", label: isTj ? "Иҷораи ҷой" : "Аренда места" },
      { value: "кресл", label: isTj ? "Курсӣ / минтақа" : "Кресло / зона" },
    ],
    "beauty-drugoe": [...common, { value: "красот", label: isTj ? "Хизматҳои зебоӣ" : "Услуги красоты" }],
  };
  return bySlug[slug] || [
    ...common,
    { value: "консультац", label: isTj ? "Машварат" : "Консультация" },
    { value: "комплекс", label: isTj ? "Маҷмӯи хизматҳо" : "Комплекс услуг" },
    { value: "курс", label: isTj ? "Курс тартибот" : "Курс процедур" },
  ];
}

function listingText(l) {
  return `${l.title || ""} ${l.description || ""}`;
}

/**
 * Доп. фильтрация для пресета «Красота» (на клиенте, поверх applyClientPostFilters).
 */
export function applyBeautyPostFilters(items, a) {
  let rows = [...items];

  if (a.beautyServiceType && String(a.beautyServiceType).trim()) {
    const kw = String(a.beautyServiceType).trim().toLowerCase();
    rows = rows.filter((l) => listingText(l).toLowerCase().includes(kw));
  }

  if (a.needToday || a.needTomorrow) {
    rows = rows.filter((l) => {
      const id = Number(l.id) || 0;
      const okToday = a.needToday && id % 2 === 0;
      const okTom = a.needTomorrow && id % 2 === 1;
      if (a.needToday && a.needTomorrow) return okToday || okTom;
      if (a.needToday) return okToday;
      if (a.needTomorrow) return okTom;
      return true;
    });
  }

  if (a.beautyPromoOnly) {
    rows = rows.filter((l) => l.is_promoted || l.price == null || Number(l.price) === 0);
  }

  if (a.beautyOnlineBooking) {
    rows = rows.filter((l) => /онлайн|запис|whatsapp|telegram|форма|сайт|instagram/i.test(listingText(l)));
  }

  if (a.beautyGender === "female") {
    rows = rows.filter((l) => !/(барбер|мужской зал|for men)\b/i.test(listingText(l)));
  } else if (a.beautyGender === "male") {
    rows = rows.filter((l) => /(барбер|мужской|мужчин)\b/i.test(listingText(l)) || Number(l.id) % 7 === 0);
  }

  if (a.beautyAudience === "women") {
    rows = rows.filter((l) => !/(барбер|для мужчин)\b/i.test(listingText(l)));
  } else if (a.beautyAudience === "men") {
    rows = rows.filter((l) => /(барбер|мужчин|мужской)\b/i.test(listingText(l)) || Number(l.id) % 6 === 0);
  }

  if (a.beautyExperience === "lt1") {
    rows = rows.filter((l) => Number(l.id) % 5 === 0);
  } else if (a.beautyExperience === "1-3") {
    rows = rows.filter((l) => {
      const m = Number(l.id) % 5;
      return m === 1 || m === 2;
    });
  } else if (a.beautyExperience === "3-5") {
    rows = rows.filter((l) => Number(l.id) % 5 === 3);
  } else if (a.beautyExperience === "5plus") {
    rows = rows.filter((l) => Number(l.id) % 5 === 4);
  }

  const placeRes = [];
  if (a.beautyPlaceHome) placeRes.push(/у вас|у клиент|выезд|на дом|у заказч|на дому у клиент/i);
  if (a.beautyPlaceMasterHome) placeRes.push(/у мастер|у исполнител|дома у мастер|у специалист/i);
  if (a.beautyPlaceSalon) placeRes.push(/салон/i);
  if (a.beautyPlaceCowork) placeRes.push(/коворк|коворкинг|cowork/i);
  if (a.beautyPlaceStudio) placeRes.push(/студи|кабинет/i);
  if (placeRes.length) {
    rows = rows.filter((l) => {
      const text = listingText(l);
      return placeRes.some((re) => re.test(text));
    });
  }

  return rows;
}
