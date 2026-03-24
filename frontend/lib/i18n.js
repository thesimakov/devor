import { deepMerge } from "./deepMerge";

import ruCommon from "../locales/ru/common.json";
import ruHeader from "../locales/ru/header.json";
import ruFooter from "../locales/ru/footer.json";
import ruHome from "../locales/ru/home.json";
import ruMap from "../locales/ru/map.json";
import ruHow from "../locales/ru/how.json";
import ruAccount from "../locales/ru/account.json";

import tjCommon from "../locales/tj/common.json";
import tjHeader from "../locales/tj/header.json";
import tjFooter from "../locales/tj/footer.json";
import tjHome from "../locales/tj/home.json";
import tjMap from "../locales/tj/map.json";
import tjHow from "../locales/tj/how.json";
import tjAccount from "../locales/tj/account.json";

/** Собранные словари: модульные JSON склеены по корню. */
const ru = deepMerge({}, ruCommon, ruHeader, ruFooter, ruHome, ruMap, ruHow, ruAccount);
const tj = deepMerge({}, tjCommon, tjHeader, tjFooter, tjHome, tjMap, tjHow, tjAccount);

export const dictionaries = { ru, tj };

function buildFlatLocale(lang) {
  const d = dictionaries[lang] || dictionaries.ru;
  return {
    services: d.home?.sectionServices,
    latestListings: d.home?.latestListings,
    searchPlaceholder: d.header?.searchPlaceholder,
    createListing: d.header?.postListing,
    login: d.header?.login,
    profile: d.header?.profile,
    priceNegotiable: d.common?.negotiable,
    call: d.header?.call,
    cities: d.common?.cities,
  };
}

/** @deprecated Используйте t(lang, key). Оставлено для совместимости со старым кодом. */
export const locales = {
  ru: buildFlatLocale("ru"),
  tj: buildFlatLocale("tj"),
};

function lookup(dict, path) {
  const parts = path.split(".");
  let cur = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * @param {string} lang  'ru' | 'tj'
 * @param {string} key   путь вида "header.searchPlaceholder"
 * @param {Record<string, string | number>} [vars]  подстановка {{name}}
 */
export function t(lang, key, vars) {
  const primary = dictionaries[lang] || dictionaries.ru;
  let s = lookup(primary, key);
  if (typeof s !== "string") s = lookup(dictionaries.ru, key);
  if (typeof s !== "string") return key;
  if (vars && typeof s === "string") {
    return s.replace(/\{\{(\w+)\}\}/g, (_, name) => (vars[name] != null ? String(vars[name]) : ""));
  }
  return s;
}

export function getDict(lang = "ru") {
  return dictionaries[lang] || dictionaries.ru;
}

/** @deprecated предпочтительно t(lang, …) */
export function getLocale(lang = "ru") {
  return locales[lang] || locales.ru;
}

const numberLocale = (lang) => (lang === "tj" ? "tg-TJ" : "ru-RU");

/**
 * @param {unknown} price
 * @param {string} [lang]
 */
export function formatPrice(price, lang = "ru") {
  if (price === null || price === undefined || price === "") {
    return t(lang, "common.negotiable");
  }
  const num = new Intl.NumberFormat(numberLocale(lang)).format(Number(price));
  return `${num} ${t(lang, "common.currencyShort")}`;
}

/**
 * Строка вида «от 1 200 смн» / «аз 1 200 сом.»
 * @param {unknown} price
 * @param {string} [lang]
 */
export function formatPriceFrom(price, lang = "ru") {
  if (price === null || price === undefined || price === "") {
    return t(lang, "common.negotiable");
  }
  const num = new Intl.NumberFormat(numberLocale(lang)).format(Number(price));
  return `${t(lang, "common.from")} ${num} ${t(lang, "common.currencyShort")}`;
}

export const CITY_KEYS = ["dushanbe", "khujand", "bokhtar", "kulob", "istaravshan", "tursunzoda"];

export function cityLabel(lang, key) {
  return t(lang, `common.cities.${key}`) || key;
}
