import { getStoredToken, getStoredUser } from "./auth";
import { fallbackListings } from "./mockData";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const DEMO_FAVORITES_KEY = "devor_demo_favorites";
const DEMO_CHAT_KEY = "devor_demo_chat_messages";

function buildOfflineError() {
  return new Error("Сервер недоступен. Проверьте, что backend запущен на http://localhost:8000");
}

function toDemoListing(item) {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    price: item.price,
    city: item.city,
    category_id: 0,
    user_id: 1,
    views_count: 0,
    status: "active",
    cover_image_url: item.cover_image_url,
    image_urls: item.cover_image_url ? [item.cover_image_url] : [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    promoted_until: null,
    is_promoted: false,
  };
}

function getDemoFavorites() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(DEMO_FAVORITES_KEY) || "[]");
  } catch {
    return [];
  }
}

function setDemoFavorites(ids) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_FAVORITES_KEY, JSON.stringify(ids));
}

function getDemoChatStore() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(DEMO_CHAT_KEY) || "{}");
  } catch {
    return {};
  }
}

function setDemoChatStore(payload) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_CHAT_KEY, JSON.stringify(payload));
}

function parseBody(body) {
  if (!body || body instanceof FormData) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function offlineApi(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = parseBody(options.body);
  const parsed = new URL(path, "http://offline.local");
  const pathname = parsed.pathname;
  const user = getStoredUser();

  if (path === "/auth/login" && method === "POST") {
    if (body.login === "demo" && body.password === "demo12345") {
      return {
        access_token: "offline-demo-token",
        token_type: "bearer",
        user: { id: 1, login: "demo", name: "Demo Seller", role: "user", phone: "+992 90 111 22 33" },
      };
    }
    throw new Error("Офлайн доступен только для демо-аккаунта: demo / demo12345");
  }

  if (!user) {
    throw new Error("Требуется вход в профиль");
  }

  if (pathname === "/users/me/listings" && method === "GET") {
    return fallbackListings.slice(0, 2).map(toDemoListing);
  }

  if (pathname === "/users/me/favorites" && method === "GET") {
    const ids = getDemoFavorites();
    return fallbackListings.filter((item) => ids.includes(item.id)).map(toDemoListing);
  }

  if (pathname.startsWith("/favorites/") && method === "POST") {
    const listingId = Number(pathname.split("/").pop());
    const ids = getDemoFavorites();
    if (!ids.includes(listingId)) ids.push(listingId);
    setDemoFavorites(ids);
    return { message: "Добавлено в избранное (офлайн-демо)" };
  }

  if (pathname.startsWith("/favorites/") && method === "DELETE") {
    const listingId = Number(pathname.split("/").pop());
    const ids = getDemoFavorites().filter((id) => id !== listingId);
    setDemoFavorites(ids);
    return null;
  }

  if (pathname.startsWith("/listings/") && method === "GET") {
    const listingId = Number(pathname.split("/").pop());
    const listing = fallbackListings.find((item) => item.id === listingId);
    if (!listing) throw new Error("Объявление не найдено");
    return {
      ...toDemoListing(listing),
      phone: "+992 90 111 22 33",
      seller_name: "Demo Seller",
    };
  }

  if (pathname.startsWith("/chat/listings/") && pathname.endsWith("/messages")) {
    const chunks = pathname.split("/");
    const listingId = Number(chunks[3]);
    const participantId = Number(parsed.searchParams.get("participant_id") || 1);
    const dialogKey = `${listingId}:${[user.id, participantId].sort((a, b) => a - b).join(":")}`;
    const store = getDemoChatStore();
    const dialogItems = store[dialogKey] || [];

    if (method === "GET") {
      const marked = dialogItems.map((item) => {
        if (item.recipient_id === user.id && !item.is_read) {
          return { ...item, is_read: true };
        }
        return item;
      });
      store[dialogKey] = marked;
      setDemoChatStore(store);
      return marked;
    }

    if (method === "POST") {
      const text = String(body.text || "").trim();
      if (!text) throw new Error("Введите сообщение");
      const recipientId = participantId === user.id ? 1 : participantId;
      const newItem = {
        id: Date.now(),
        listing_id: listingId,
        sender_id: user.id,
        recipient_id: recipientId,
        text,
        is_read: false,
        created_at: new Date().toISOString(),
      };
      store[dialogKey] = [...dialogItems, newItem];
      setDemoChatStore(store);
      return newItem;
    }
  }

  if (pathname === "/chat/conversations" && method === "GET") {
    const store = getDemoChatStore();
    const dialogs = Object.entries(store)
      .filter(([key]) => key.split(":").slice(1).includes(String(user.id)))
      .map(([key, items]) => {
        const [listingPart, firstUser, secondUser] = key.split(":");
        const listingId = Number(listingPart);
        const a = Number(firstUser);
        const b = Number(secondUser);
        const participantId = a === user.id ? b : a;
        const last = (items || [])[items.length - 1];
        const listing = fallbackListings.find((it) => it.id === listingId);
        return {
          listing_id: listingId,
          listing_title: listing?.title || `Объявление #${listingId}`,
          participant_id: participantId,
          participant_name: participantId === 1 ? "Demo Seller" : `Пользователь #${participantId}`,
          participant_login: participantId === 1 ? "demo" : `user${participantId}`,
          last_message_text: last?.text || "",
          last_message_created_at: last?.created_at || new Date().toISOString(),
          last_message_sender_id: last?.sender_id || participantId,
          unread_count: (items || []).filter((msg) => msg.recipient_id === user.id && !msg.is_read).length,
        };
      })
      .sort((a, b) => new Date(b.last_message_created_at).getTime() - new Date(a.last_message_created_at).getTime());
    return dialogs;
  }

  if (pathname === "/chat/unread-count" && method === "GET") {
    const store = getDemoChatStore();
    const unread = Object.entries(store)
      .filter(([key]) => key.split(":").slice(1).includes(String(user.id)))
      .reduce((acc, [, items]) => acc + (items || []).filter((msg) => msg.recipient_id === user.id && !msg.is_read).length, 0);
    return { unread_count: unread };
  }

  throw buildOfflineError();
}

export function getApiUrl() {
  return API_URL;
}

export function getWsApiUrl() {
  if (API_URL.startsWith("https://")) return API_URL.replace("https://", "wss://");
  if (API_URL.startsWith("http://")) return API_URL.replace("http://", "ws://");
  if (API_URL.startsWith("wss://") || API_URL.startsWith("ws://")) return API_URL;
  return `ws://${API_URL}`;
}

export function withApiPrefix(url) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_URL}${url}`;
}

export async function apiFetch(path, options = {}) {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof TypeError && error.message.toLowerCase().includes("fetch")) {
      return offlineApi(path, options);
    }
    throw buildOfflineError();
  }

  if (!response.ok) {
    let detail = "Ошибка API";
    try {
      const payload = await response.json();
      detail = payload.detail || payload.message || detail;
    } catch {
      // noop
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}
