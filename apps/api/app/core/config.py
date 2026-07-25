from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://cart:cart@db:5432/cartpaper"
    secret_key: str = "dev-only-secret-change-me"

    access_token_minutes: int = 15
    refresh_token_days: int = 30

    # Deliberately a plain string: pydantic-settings JSON-decodes list-typed
    # fields directly in the environment source, before any validator can run,
    # so a comma-separated CORS_ORIGINS would raise instead of being parsed.
    cors_origins: str = "http://localhost:5173"

    upload_dir: Path = Path("/data/uploads")
    public_api_url: str = "http://localhost:8000"
    public_web_url: str = "http://localhost:5173"

    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    max_upload_mb: int = 40

    # OAuth — empty by default. A provider with no credentials is reported as
    # unconfigured and its endpoints answer 501 rather than half-working.
    google_client_id: str = ""
    google_client_secret: str = ""
    facebook_app_id: str = ""
    facebook_app_secret: str = ""
    oauth_redirect_base_url: str = ""

    @property
    def allowed_origins(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]

    @property
    def is_dev(self) -> bool:
        return self.app_env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
