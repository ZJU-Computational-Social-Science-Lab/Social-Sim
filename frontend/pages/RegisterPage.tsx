import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiClient } from "../services/client";
import { useTranslation } from "react-i18next";

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    organization: "",
    email: "",
    username: "",
    full_name: "",
    phone_number: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // simple client-side validation for phone (E.164-like)
      const phone = String(form.phone_number || '').trim();
      const phoneOk = /^\+?[1-9]\d{7,14}$/.test(phone);
      if (!phoneOk) {
        setLoading(false);
        setError('invalid_phone');
        return;
      }
      await apiClient.post("/auth/register", {
        organization: form.organization,
        email: form.email,
        username: form.username,
        full_name: form.full_name,
        phone_number: form.phone_number,
        password: form.password,
      });
      setSuccess(true);
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      // Prefer server-provided detail message if available
      const detail = (err?.response?.data?.detail ?? err?.response?.data?.message) as any;
      if (typeof detail === 'string' && detail.trim()) {
        setError(detail.trim());
      } else if (Array.isArray(detail) && detail.length) {
        const first = detail[0];
        const msg = String(first?.msg || first?.message || 'Registration failed');
        setError(msg);
      } else {
        setError("register_failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="panel" style={{ maxWidth: 520, margin: "0 auto", gap: "0.75rem" }}>
      <div className="panel-title">{t('auth.register.title')}</div>
      <form onSubmit={onSubmit} className="card" style={{ gap: "0.5rem" }}>
        <label>
          {t('auth.register.organization')}
          <input className="input" value={form.organization} onChange={(e) => handleChange("organization", e.target.value)} required />
        </label>
        <label>
          {t('auth.register.email')}
          <input className="input" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} required />
        </label>
        <label>
          {t('auth.register.username')}
          <input className="input" value={form.username} onChange={(e) => handleChange("username", e.target.value)} required />
        </label>
        <label>
          {t('auth.register.fullName')}
          <input className="input" value={form.full_name} onChange={(e) => handleChange("full_name", e.target.value)} required />
        </label>
        <label>
          {t('auth.register.phone')}
          <input className="input" value={form.phone_number} onChange={(e) => handleChange("phone_number", e.target.value)} required pattern="^\+?[1-9]\d{7,14}$" title={t('auth.register.invalidPhoneTitle') || '+123456789 (8-15 digits)'} />
        </label>
        <label>
          {t('auth.register.password')}
          <input className="input" type="password" value={form.password} onChange={(e) => handleChange("password", e.target.value)} required />
        </label>
        {error === 'invalid_phone' && <div style={{ color: "#f87171" }}>{t('auth.register.invalidPhone')}</div>}
        {error && error !== 'invalid_phone' && (
          <div style={{ color: "#f87171" }}>
            {error === 'register_failed' ? t('auth.register.failed') : `Error: ${String(error).toLowerCase()}`}
          </div>
        )}
        {success && <div style={{ color: "#34d399" }}>{t('auth.register.success')}</div>}
        <button type="submit" className="button" disabled={loading}>
          {loading ? t('auth.register.submit') + '…' : t('auth.register.submit')}
        </button>
      </form>
      <div style={{ color: "var(--muted)" }}>
        {t('auth.register.have')} <Link to="/login">{t('auth.register.signin')}</Link>
      </div>
    </section>
  );
}
