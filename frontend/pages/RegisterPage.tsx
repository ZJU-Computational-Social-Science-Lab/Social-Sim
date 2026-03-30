import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  LockKeyhole,
  Mail,
  Phone,
  User,
  UserRound,
} from "lucide-react";

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
        setError(t('auth.register.failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ss-auth__card ss-auth__card--wide">
      <div className="space-y-3">
        <div className="ss-auth__hero-badge">{t("auth.register.badge")}</div>
        <div className="ss-auth__intro">
          <div className="ss-auth__intro-mark">
            <Building2 size={20} />
          </div>
          <div className="space-y-2">
            <h2 className="ss-auth__title">
              {t("auth.register.title")}
            </h2>
            <p className="ss-auth__copy">
              {t("auth.register.subtitle")}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="ss-auth__grid">
          <label className="ss-auth__field-block">
            <span className="ss-auth__label">{t("auth.register.organization")}</span>
            <div className="ss-auth__field">
              <Building2 size={16} className="ss-auth__field-icon" />
              <input
                className="ss-input ss-auth__input"
                value={form.organization}
                onChange={(e) => handleChange("organization", e.target.value)}
                placeholder={t("auth.register.organization")}
                required
              />
            </div>
          </label>

          <label className="ss-auth__field-block">
            <span className="ss-auth__label">{t("auth.register.email")}</span>
            <div className="ss-auth__field">
              <Mail size={16} className="ss-auth__field-icon" />
              <input
                className="ss-input ss-auth__input"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder={t("auth.register.emailPlaceholder")}
                required
              />
            </div>
          </label>

          <label className="ss-auth__field-block">
            <span className="ss-auth__label">{t("auth.register.username")}</span>
            <div className="ss-auth__field">
              <User size={16} className="ss-auth__field-icon" />
              <input
                className="ss-input ss-auth__input"
                value={form.username}
                onChange={(e) => handleChange("username", e.target.value)}
                placeholder={t("auth.register.username")}
                required
              />
            </div>
          </label>

          <label className="ss-auth__field-block">
            <span className="ss-auth__label">{t("auth.register.fullName")}</span>
            <div className="ss-auth__field">
              <UserRound size={16} className="ss-auth__field-icon" />
              <input
                className="ss-input ss-auth__input"
                value={form.full_name}
                onChange={(e) => handleChange("full_name", e.target.value)}
                placeholder={t("auth.register.fullName")}
                required
              />
            </div>
          </label>

          <label className="ss-auth__field-block">
            <span className="ss-auth__label">{t("auth.register.phone")}</span>
            <div className="ss-auth__field">
              <Phone size={16} className="ss-auth__field-icon" />
              <input
                className="ss-input ss-auth__input"
                value={form.phone_number}
                onChange={(e) => handleChange("phone_number", e.target.value)}
                placeholder={t("auth.register.phonePlaceholder")}
                required
                pattern="^\+?[1-9]\d{7,14}$"
                title={t("auth.register.invalidPhoneTitle") || "+123456789 (8-15 digits)"}
              />
            </div>
            <span className="ss-auth__helper">
              {t("auth.register.invalidPhoneTitle") || "+123456789 (8-15 digits)"}
            </span>
          </label>

          <label className="ss-auth__field-block">
            <span className="ss-auth__label">{t("auth.register.password")}</span>
            <div className="ss-auth__field">
              <LockKeyhole size={16} className="ss-auth__field-icon" />
              <input
                className="ss-input ss-auth__input"
                type="password"
                value={form.password}
                onChange={(e) => handleChange("password", e.target.value)}
                placeholder={t("auth.register.passwordPlaceholder")}
                required
              />
            </div>
          </label>
        </div>

        {error === "invalid_phone" ? (
          <div className="ss-auth__status ss-auth__status--error">
            {t("auth.register.invalidPhone")}
          </div>
        ) : null}

        {error && error !== "invalid_phone" ? (
          <div className="ss-auth__status ss-auth__status--error">
            {error === "register_failed"
              ? t("auth.register.failed")
              : `Error: ${String(error).toLowerCase()}`}
          </div>
        ) : null}

        {success ? (
          <div className="ss-auth__status ss-auth__status--success">
            {t("auth.register.success")}
          </div>
        ) : null}

        <button type="submit" className="ss-button w-full justify-between px-5" disabled={loading}>
          <span>{loading ? `${t("auth.register.submit")}…` : t("auth.register.submit")}</span>
          <ArrowRight size={16} />
        </button>
      </form>

      <div className="ss-auth__footer">
        <p className="ss-auth__footer-text">
          {t("auth.register.have")}{" "}
          <Link to="/login" className="ss-auth__footer-link">
            {t("auth.register.signin")}
          </Link>
        </p>
        <div className="ss-auth__footer-note">
          <span>{t("auth.register.footerLeft")}</span>
          <span>{t("auth.register.footerRight")}</span>
        </div>
      </div>
    </section>
  );
}
