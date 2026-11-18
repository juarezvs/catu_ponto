"""0005_portaria_135_2025_compliance

Revision ID: 0005_portaria_135_2025
Revises: 0004_secp_rbac
Create Date: 2026-11-18 16:35:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0005_portaria_135_2025"
down_revision = "0004_secp_rbac"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "secp_audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("active_profile", sa.String(length=40), nullable=False),
        sa.Column("action", sa.String(length=120), nullable=False),
        sa.Column("entity_type", sa.String(length=80), nullable=False),
        sa.Column("entity_id", sa.String(length=120), nullable=False),
        sa.Column("before_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("after_state", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.String(length=80), nullable=False, server_default="0.0.0.0"),
        sa.Column("user_agent", sa.String(length=255), nullable=False, server_default="unknown"),
        sa.Column("integrity_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_audit_logs_user_created", "secp_audit_logs", ["user_id", "created_at"])
    op.create_index("idx_audit_logs_entity", "secp_audit_logs", ["entity_type", "entity_id"])

    op.create_table(
        "secp_unidades_lotacao",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=40), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=180), nullable=False),
        sa.Column("fuso_horario", sa.String(length=64), nullable=False),
        sa.Column("tolerancia_diaria_minutos", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "secp_autorizacoes_hora_extra",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("authorized_by_manager_id", sa.String(length=64), nullable=False),
        sa.Column("reference_date", sa.Date(), nullable=False),
        sa.Column("max_authorized_minutes", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("approved", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "reference_date", name="uq_autorizacao_he_user_date"),
    )

    op.create_table(
        "secp_abonos_workflow",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("protocol", sa.String(length=48), nullable=False, unique=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("lotacao_codigo", sa.String(length=40), nullable=False),
        sa.Column("reason_code", sa.String(length=64), nullable=False),
        sa.Column("reference_date", sa.Date(), nullable=False),
        sa.Column("minutes_requested", sa.Integer(), nullable=False),
        sa.Column("justification", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="DRAFT"),
        sa.Column("cid_code", sa.String(length=32), nullable=True),
        sa.Column("clinical_notes", sa.Text(), nullable=True),
        sa.Column("decision_notes", sa.Text(), nullable=True),
        sa.Column("decided_by", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "secp_abonos_anexos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "abono_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("secp_abonos_workflow.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=120), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("sha256_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "secp_fechamentos_mensais",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", sa.String(length=64), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="OPEN"),
        sa.Column("snapshot_sha256", sa.String(length=64), nullable=True),
        sa.Column("signed_by_server_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("homologated_by_manager_id", sa.String(length=64), nullable=True),
        sa.Column("closed_by_rh_id", sa.String(length=64), nullable=True),
        sa.Column("sei_rectification_process", sa.String(length=80), nullable=True),
        sa.Column("sei_rectification_justification", sa.Text(), nullable=True),
        sa.UniqueConstraint("user_id", "year", "month", name="uq_fechamento_user_competence"),
    )


def downgrade() -> None:
    op.drop_table("secp_fechamentos_mensais")
    op.drop_table("secp_abonos_anexos")
    op.drop_table("secp_abonos_workflow")
    op.drop_table("secp_autorizacoes_hora_extra")
    op.drop_table("secp_unidades_lotacao")
    op.drop_index("idx_audit_logs_entity", table_name="secp_audit_logs")
    op.drop_index("idx_audit_logs_user_created", table_name="secp_audit_logs")
    op.drop_table("secp_audit_logs")
