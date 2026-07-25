from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    database_url: str = "postgresql+asyncpg://cart:cart@db:5432/cartpaper"
    secret_key: str = "dev-only-secret-change-me"

    access_token_minutes: int = 15
    refresh_token_days: int = 30

    cors_origins: list[str] = ["http://localhost:5173"]

    upload_dir: Path = Path("/data/uploads")
    public_api_url: str = "http://localhost:8000"
    public_web_url: str = "http://localhost:5173"

    cookie_secure: bool = False
    cookie_samesite: str = "lax"

    max_upload_mb: int = 40

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_dev(self) -> bool:
        return self.app_env != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
