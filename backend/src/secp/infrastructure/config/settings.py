from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class SecpSettings(BaseSettings):
    """Configurações centralizadas da stack PostgreSQL (pgvector) + Redis do SECP."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "secp_user"
    POSTGRES_PASSWORD: str = "secp_pass"
    POSTGRES_DB: str = "secp_db"

    POSTGRES_ASYNC_DSN: str = (
        "postgresql+asyncpg://secp_user:secp_pass@127.0.0.1:5432/secp_db"
    )
    POSTGRES_SYNC_DSN: str = (
        "postgresql+psycopg://secp_user:secp_pass@127.0.0.1:5432/secp_db"
    )
    POSTGRES_PROD_REAL_ASYNC_DSN: str = (
        "postgresql+asyncpg://secp_user:secp_pass@127.0.0.1:5432/secp_prod_real"
    )
    POSTGRES_PROD_REAL_SYNC_DSN: str = (
        "postgresql+psycopg://secp_user:secp_pass@127.0.0.1:5432/secp_prod_real"
    )

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_RBAC_TTL_SECONDS: int = 300
    REDIS_SRAG_TTL_SECONDS: int = 600


@lru_cache(maxsize=1)
def get_secp_settings() -> SecpSettings:
    return SecpSettings()
