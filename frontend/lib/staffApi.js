const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const OPS_STORAGE_KEY = "devor_ops_secret";

export function getOpsSecret() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(OPS_STORAGE_KEY) || "";
}

export function setOpsSecret(value) {
  if (typeof window === "undefined") return;
  const v = String(value || "").trim();
  if (v) sessionStorage.setItem(OPS_STORAGE_KEY, v);
  else sessionStorage.removeItem(OPS_STORAGE_KEY);
}

export function clearOpsSecret() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(OPS_STORAGE_KEY);
}

function formatApiError(data) {
  const d = data?.detail;
  if (!d) return "Ошибка запроса";
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => (typeof x === "string" ? x : x.msg || JSON.stringify(x))).join("; ");
  return String(d);
}

/**
 * @param {string} path — например /admin/me
 * @param {{ method?: string, body?: object, token: string, withOps?: boolean }} opts
 */
export async function staffFetch(path, { method = "GET", body, token, withOps = false } = {}) {
  if (!token) throw new Error("Нет токена — войдите в систему");

  const headers = { Authorization: `Bearer ${token}` };
  if (body != null) headers["Content-Type"] = "application/json";
  if (withOps) {
    const s = getOpsSecret();
    if (s) headers["X-Devor-Ops-Secret"] = s;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text || res.statusText };
  }

  if (!res.ok) {
    throw new Error(formatApiError(data));
  }
  if (res.status === 204 || text === "") {
    return null;
  }
  return data;
}

export function isStaffRole(role) {
  return role === "admin" || role === "manager";
}
