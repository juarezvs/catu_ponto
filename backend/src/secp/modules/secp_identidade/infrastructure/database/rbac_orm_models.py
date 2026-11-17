from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from secp.infrastructure.database.postgres_session import SecpDeclarativeBase


class PerfilORM(SecpDeclarativeBase):
    """Espelha `perfis` do schema.prisma do secp_antigo."""

    __tablename__ = "perfis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(120), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sistema: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    administrativo: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    excecao: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    global_scope: Mapped[bool] = mapped_column("global", Boolean, default=True, nullable=False)
    orgao_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    criado_em: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PermissaoORM(SecpDeclarativeBase):
    """Espelha `permissoes` do schema.prisma (recurso + acao + escopo)."""

    __tablename__ = "permissoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    recurso: Mapped[str] = mapped_column(String(80), nullable=False)
    acao: Mapped[str] = mapped_column(String(80), nullable=False)
    escopo: Mapped[str] = mapped_column(String(80), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("recurso", "acao", "escopo", name="uq_permissoes_recurso_acao_escopo"),
    )


class PerfilPermissaoORM(SecpDeclarativeBase):
    """Espelha `perfis_permissoes` do schema.prisma."""

    __tablename__ = "perfis_permissoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    perfil_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("perfis.id", ondelete="CASCADE"), nullable=False
    )
    permissao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissoes.id", ondelete="CASCADE"), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("perfil_id", "permissao_id", name="uq_perfil_permissao"),
        Index("idx_perfis_permissoes_perfil", "perfil_id"),
    )


class PerfilPermissaoOrgaoORM(SecpDeclarativeBase):
    """Espelha `perfis_permissoes_orgaos` (override seccional permitida=True/False por Órgão)."""

    __tablename__ = "perfis_permissoes_orgaos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    perfil_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("perfis.id", ondelete="CASCADE"), nullable=False
    )
    permissao_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissoes.id", ondelete="CASCADE"), nullable=False
    )
    orgao_id: Mapped[str] = mapped_column(String(64), nullable=False)
    permitida: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("perfil_id", "permissao_id", "orgao_id", name="uq_perfil_perm_orgao"),
        Index("idx_perfis_perm_orgao_lookup", "perfil_id", "orgao_id"),
    )


class UsuarioPerfilORM(SecpDeclarativeBase):
    """Espelha `usuarios_perfis` (vínculo Usuário x Perfil x Órgão)."""

    __tablename__ = "usuarios_perfis"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id: Mapped[str] = mapped_column(String(64), nullable=False)
    perfil_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("perfis.id", ondelete="CASCADE"), nullable=False
    )
    orgao_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        Index("idx_usuarios_perfis_lookup", "usuario_id", "perfil_id", "orgao_id"),
    )


class LiberacaoRotinaORM(SecpDeclarativeBase):
    """Espelha `rotinas_liberacoes` (controle global de liberação de rotinas/telas)."""

    __tablename__ = "rotinas_liberacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo: Mapped[str] = mapped_column(String(48), nullable=False)  # MODULO | SUBITEM | ACAO
    chave: Mapped[str] = mapped_column(String(160), nullable=False)
    liberada: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("tipo", "chave", name="uq_rotina_tipo_chave"),
        Index("idx_rotinas_liberacoes_tipo_liberada", "tipo", "liberada"),
    )
