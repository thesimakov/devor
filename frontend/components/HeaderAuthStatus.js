import { useEffect, useState } from "react";

import { clearAuthData, getStoredToken, getStoredUser } from "../lib/auth";

export default function HeaderAuthStatus({ onLogout }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    setToken(getStoredToken());
    setUser(getStoredUser());
  }, []);

  if (!token) return null;

  return (
    <div className="header-auth-status">
      <span className="header-auth-dot" />
      <span className="header-auth-name">{user?.name || "Пользователь"}</span>
      <span className="header-auth-login">@{user?.login || "user"}</span>
      <button
        className="header-auth-logout"
        type="button"
        onClick={() => {
          clearAuthData();
          setToken("");
          setUser(null);
          onLogout?.();
        }}
      >
        Выйти
      </button>
    </div>
  );
}
