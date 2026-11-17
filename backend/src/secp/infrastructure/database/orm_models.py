from datetime import date, datetime
from typing import Optional
import uuid
from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from secp.infrastructure.database.postgres_session import SecpDeclarativeBase


class OrgaoORM(SecpDeclarativeBase):
    __tablename__ = "secp_orgaos"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sigla: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    cnpj: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    unidade_ativa: Mapped[str] = mapped_column(String(255), nullable=False)
    teto_hora_extra_mensal: Mapped[str] = mapped_column(String(64), nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class UnidadeORM(SecpDeclarativeBase):
    __tablename__ = "secp_unidades"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    orgao_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("secp_orgaos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    codigo: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    raio_geofence_metros: Mapped[float] = mapped_column(Numeric(8, 2), default=150.0)


class ModuloSecpORM(SecpDeclarativeBase):
    __tablename__ = "secp_modulos"

    slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    short_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    theme_color_hex: Mapped[str] = mapped_column(String(16), nullable=False)
    tailwind_accent: Mapped[str] = mapped_column(String(32), nullable=False)
    icon: Mapped[str] = mapped_column(String(64), nullable=False)
    badge_text: Mapped[str] = mapped_column(String(120), nullable=False)
    stats_label: Mapped[str] = mapped_column(String(255), nullable=False)
    required_permission: Mapped[str] = mapped_column(String(128), nullable=False)


class UsuarioORM(SecpDeclarativeBase):
    __tablename__ = "secp_usuarios"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    matricula: Mapped[str] = mapped_column(String(32), unique=True, nullable=False, index=True)
    cpf_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    role_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    role_name: Mapped[str] = mapped_column(String(128), nullable=False)
    default_orgao_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("secp_orgaos.id"), nullable=False
    )
    avatar_initials: Mapped[str] = mapped_column(String(8), nullable=False)
    allowed_modules_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    permissions_json: Mapped[list[str]] = mapped_column(JSONB, default=list, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class NormaDocumentoChunkORM(SecpDeclarativeBase):
    """
    Tabela vetorial e lexical no PostgreSQL (pgvector + TSVECTOR) para o
    SECP Copiloto Normativo (SRAG - Structured Retrieval-Augmented Generation).
    """

    __tablename__ = "secp_norma_documento_chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    orgao_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("secp_orgaos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    modulo_slug: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    lei_codigo: Mapped[str] = mapped_column(String(255), nullable=False)
    artigo: Mapped[str] = mapped_column(String(64), nullable=False)
    paragrafo: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    inciso: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    vigencia_inicio: Mapped[date] = mapped_column(Date, nullable=False)
    vigencia_fim: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    conteudo_normativo: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[Optional[list[float]]] = mapped_column(Vector(1536), nullable=True)
    tsv_lexical: Mapped[Optional[str]] = mapped_column(TSVECTOR, nullable=True)

    __table_args__ = (
        Index(
            "idx_norma_chunk_orgao_vigencia",
            "orgao_id",
            "vigencia_inicio",
            "vigencia_fim",
        ),
        Index(
            "idx_norma_chunk_tsv_gin",
            "tsv_lexical",
            postgresql_using="gin",
        ),
    )
