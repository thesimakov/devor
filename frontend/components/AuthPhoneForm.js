import { useEffect, useState } from "react";

import { apiFetch } from "../lib/api";
import { getStoredToken, getStoredUser, setAuthData } from "../lib/auth";

export default function AuthPhoneForm({ onAuthed }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedToken = getStoredToken();
    const storedUser = getStoredUser();
    if (storedToken) {
      setToken(storedToken);
      setUser(storedUser);
      onAuthed?.(storedToken, storedUser);
    }
  }, [onAuthed]);

  async function submitAuth(override = null) {
    setLoading(true);
    setMessage("");
    try {
      const effectiveMode = override?.mode || mode;
      const effectiveLogin = override?.login || login;
      const effectivePassword = override?.password || password;
      const effectiveName = override?.name ?? name;
      const endpoint = effectiveMode === "register" ? "/auth/register" : "/auth/login";
      const payload = await apiFetch(endpoint, {
        method: "POST",
        body: JSON.stringify(
          effectiveMode === "register"
            ? { login: effectiveLogin, password: effectivePassword, name: effectiveName || null }
            : { login: effectiveLogin, password: effectivePassword }
        ),
      });
      setAuthData(payload.access_token, payload.user);
      setToken(payload.access_token);
      setUser(payload.user);
      setMessage("Успешный вход");
      onAuthed?.(payload.access_token, payload.user);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function loginAsDemo() {
    setMode("login");
    setLogin("demo");
    setPassword("demo12345");
    submitAuth({ mode: "login", login: "demo", password: "demo12345" });
  }

  if (token) {
    return null;
  }

  return (
    <div className="auth-box auth-elevated">
      <div className="auth-head">
        <h3>{mode === "register" ? "Создать аккаунт" : "Вход в кабинет"}</h3>
        <p>Авторизуйтесь, чтобы публиковать и редактировать объявления.</p>
      </div>
      <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="Логин (например, user01)" />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Пароль"
        type="password"
      />
      {mode === "register" ? (
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя (необязательно)" />
      ) : null}
      <div className="row">
        <button className="primary" type="button" onClick={submitAuth} disabled={loading}>
          {loading ? "Подождите..." : mode === "register" ? "Создать аккаунт" : "Войти"}
        </button>
        <button className="ghost" type="button" onClick={loginAsDemo} disabled={loading}>
          Войти как демо
        </button>
      </div>
      <button
        className="auth-switch-link"
        type="button"
        onClick={() => setMode((prev) => (prev === "login" ? "register" : "login"))}
      >
        {mode === "login" ? "Нет аккаунта? Зарегистрироваться" : "Уже есть аккаунт? Войти"}
      </button>
      {message ? <p className="auth-message">{message}</p> : null}
    </div>
  );
}
