from datetime import date, datetime
from typing import Optional
import uuid
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from secp.infrastructure.database.postgres_session import SecpDeclarativeBase


class AuditLogORM(SecpDeclarativeBase):
    """RNF-Auditoria Imutável: trilha append-only de todas as mutações."""

    __tablename__ = "secp_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    active_profile: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    entity_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    before_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str] = mapped_column(String(80), nullable=False, default="0.0.0.0")
    user_agent: Mapped[str] = mapped_column(String(255), nullable=False, default="unknown")
    integrity_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )


class UnidadeLotacaoORM(SecpDeclarativeBase):
    """RN-01: Lotações oficiais SJAM-MANAUS, SSJ-TABATINGA (UTC-5) e UAA-TEFE."""

    __tablename__ = "secp_unidades_lotacao"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    codigo: Mapped[str] = mapped_column(String(40), unique=True, nullable=False)
    nome: Mapped[str] = mapped_column(String(180), nullable=False)
    fuso_horario: Mapped[str] = mapped_column(String(64), nullable=False)
    tolerancia_diaria_minutos: Mapped[int] = mapped_column(Integer, default=10, nullable=False)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AutorizacaoHoraExtraORM(SecpDeclarativeBase):
    """RN-05: Autorização prévia da chefia para crédito no Banco de Horas."""

    __tablename__ = "secp_autorizacoes_hora_extra"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    authorized_by_manager_id: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    max_authorized_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    approved: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("user_id", "reference_date", name="uq_autorizacao_he_user_date"),
    )


class AbonoWorkflowORM(SecpDeclarativeBase):
    """RN-06 & RNF-LGPD: Solicitações de abono com máquina de estados e dados clínicos restritos."""

    __tablename__ = "secp_abonos_workflow"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    protocol: Mapped[str] = mapped_column(String(48), unique=True, nullable=False)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    lotacao_codigo: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    reason_code: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    minutes_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    justification: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="DRAFT", nullable=False, index=True)
    cid_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decision_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    decided_by: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AbonoAnexoORM(SecpDeclarativeBase):
    """RN-06 & RNF-SHA256: Anexos comprobatórios com hash SHA-256 de integridade."""

    __tablename__ = "secp_abonos_anexos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    abono_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("secp_abonos_workflow.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FechamentoMensalORM(SecpDeclarativeBase):
    """RN-07: Ciclo de fechamento e imutabilidade mensal com suporte a processo SEI."""

    __tablename__ = "secp_fechamentos_mensais"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="OPEN", nullable=False, index=True)
    snapshot_sha256: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    signed_by_server_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    homologated_by_manager_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    closed_by_rh_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    sei_rectification_process: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    sei_rectification_justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_fechamento_user_competence"),
        Index("idx_fechamento_competence_status", "year", "month", "status"),
    )
