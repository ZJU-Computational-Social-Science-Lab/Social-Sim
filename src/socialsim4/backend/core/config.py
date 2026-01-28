from functools import lru_cache

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    debug: bool = False
    app_name: str = "SocialSim4 Backend"
    api_prefix: str = "/api"
    backend_root_path: str = ""
    frontend_dist_path: str | None = None

    backend_host: str = "0.0.0.0"
    backend_port: int = 8000

    database_url: str = "sqlite+aiosqlite:///./socialsim4.db"
    # Optional SQLAlchemy engine pool tuning
    db_pool_size: int | None = None
    db_max_overflow: int | None = None
    db_pool_timeout: int | None = None
    db_pool_recycle: int | None = None
    db_pool_pre_ping: bool | None = None

    jwt_signing_key: SecretStr = SecretStr("change-me")
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 15
    refresh_token_exp_minutes: int = 60 * 24 * 14

    email_smtp_host: str | None = None
    email_smtp_port: int | None = None
    email_smtp_username: str | None = None
    email_smtp_password: SecretStr | None = None
    email_smtp_use_tls: bool = True
    email_smtp_use_ssl: bool = False
    email_from: str | None = None

    app_base_url: str | None = None
    verification_token_exp_minutes: int = 60 * 24
    require_email_verification: bool = False

    allowed_origins: list[str] = []
    admin_emails: list[str] = []

    upload_dir: str = "uploads"
    upload_base_url: str = "/uploads"
    upload_max_mb: int = 5
    upload_docs_max_mb: int = 10
    upload_enable_ocr: bool = False
    upload_ocr_lang: str | None = None
    upload_backend: str = "local"  # local | cloud
    upload_cloud_base_url: str | None = None  # used when upload_backend = cloud; still writes locally but returns cloud URL
    upload_cloud_dir: str | None = None  # optional: when cloud backend is enabled, write to this directory (e.g., mounted bucket)

    model_config = SettingsConfigDict(
        extra="ignore",
        env_prefix="SOCIALSIM4_",
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def email_enabled(self) -> bool:
        return self.email_smtp_host is not None and self.email_smtp_port is not None and self.email_from is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]
