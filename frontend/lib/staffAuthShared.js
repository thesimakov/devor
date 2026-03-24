import { clearAuthData, getStoredToken, getStoredUser, setAuthData } from "./auth";
import { clearOpsSecret, isStaffRole } from "./staffApi";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function staffLoginRequest(login, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: login.trim(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.detail === "string" ? data.detail : "Ошибка входа");
  }
  setAuthData(data.access_token, data.user);
  if (!isStaffRole(data.user?.role)) {
    throw new Error("Нужна роль manager или admin");
  }
  return data;
}

export function staffLogoutFull() {
  clearAuthData();
  clearOpsSecret();
}

export function getStaffUser() {
  return getStoredUser();
}

export function getStaffToken() {
  return getStoredToken() || "";
}

export function isAdminRole(role) {
  return role === "admin";
}
