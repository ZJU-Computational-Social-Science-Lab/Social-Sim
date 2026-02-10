import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { apiClient } from "../services/client";
import { useAuthStore } from "../store/auth";

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation() as { state?: { from?: { pathname?: string } } };
  const setSession = useAuthStore((state) => state.setSession);
  const updateTokens = useAuthStore((state) => state.updateTokens);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const loginRes = await apiClient.post<LoginResponse>("/auth/login", {
        email,
        password,
      });
      const { access_token, refresh_token } = loginRes.data;
      updateTokens(access_token, refresh_token);

      const meRes = await apiClient.get("/auth/me");
      setSession({
        accessToken: access_token,
        refreshToken: refresh_token,
        user: meRes.data,
      });
      const redirectTo = location.state?.from?.pathname ?? "/dashboard";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(t('auth.login.invalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ maxWidth: 420, margin: "0 auto", gap: "0.75rem" }}>
      <div className="panel-title">{t('auth.login.welcome')}</div>
      <form onSubmit={onSubmit} className="card" style={{ gap: "0.5rem" }}>
        <label>
          {t('auth.login.email')}
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          {t('auth.login.password')}
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <div style={{ color: "#f87171" }}>{t('auth.login.invalid')}</div>}
        <button type="submit" className="button" disabled={loading}>
          {loading ? t('auth.login.signin') + '…' : t('auth.login.signin')}
        </button>
      </form>
      <div style={{ color: "var(--muted)" }}>
        {t('auth.login.noAccount')} <Link to="/register">{t('auth.login.create')}</Link>
      </div>
    </section>
  );
}
