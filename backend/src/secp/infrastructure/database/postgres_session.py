from typing import AsyncGenerator
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from secp.infrastructure.config.settings import get_secp_settings


class SecpDeclarativeBase(DeclarativeBase):
    """Classe base declarativa do SQLAlchemy 2.0 para os modelos PostgreSQL + pgvector."""


settings = get_secp_settings()

async_engine: AsyncEngine = create_async_engine(
    settings.POSTGRES_ASYNC_DSN,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

sync_engine = create_engine(
    settings.POSTGRES_SYNC_DSN,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 1},
    echo=False,
)

SyncSessionLocal = sessionmaker(
    bind=sync_engine,
    class_=Session,
    expire_on_commit=False,
)

prod_real_sync_engine = create_engine(
    settings.POSTGRES_PROD_REAL_SYNC_DSN,
    pool_pre_ping=True,
    pool_size=8,
    max_overflow=16,
    connect_args={"connect_timeout": 3},
    echo=False,
)

ProdRealSyncSessionLocal = sessionmaker(
    bind=prod_real_sync_engine,
    class_=Session,
    expire_on_commit=False,
)


async def get_async_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session


import time

_LAST_PG_CHECK_TS: float = -1000.0
_LAST_PG_STATUS: bool = False


def check_postgres_connection(ttl_seconds: float = 10.0) -> bool:
    """Verifica conectividade ativa com o servidor PostgreSQL com cache leve de probe."""
    global _LAST_PG_CHECK_TS, _LAST_PG_STATUS
    now = time.monotonic()
    if now - _LAST_PG_CHECK_TS < ttl_seconds:
        return _LAST_PG_STATUS
    try:
        with sync_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        _LAST_PG_STATUS = True
    except Exception:
        _LAST_PG_STATUS = False
    _LAST_PG_CHECK_TS = now
    return _LAST_PG_STATUS
