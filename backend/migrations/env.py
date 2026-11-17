from logging.config import fileConfig
from alembic import context
from sqlalchemy import engine_from_config, pool
from secp.infrastructure.config.settings import get_secp_settings
from secp.infrastructure.database.orm_models import (
    ModuloSecpORM,
    NormaDocumentoChunkORM,
    OrgaoORM,
    UnidadeORM,
    UsuarioORM,
)
from secp.infrastructure.database.postgres_session import SecpDeclarativeBase

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

settings = get_secp_settings()
config.set_main_option("sqlalchemy.url", settings.POSTGRES_SYNC_DSN)

target_metadata = SecpDeclarativeBase.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
