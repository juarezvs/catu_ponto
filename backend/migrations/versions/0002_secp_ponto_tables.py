"""0002_secp_ponto_tables

Revision ID: 0002_secp_ponto
Revises: 0001_secp_pgvector
Create Date: 2026-11-16 19:05:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_secp_ponto"
down_revision = "0001_secp_pgvector"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "jornadas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=40), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=160), nullable=False),
        sa.Column("tipo_jornada", sa.String(length=40), nullable=False),
        sa.Column("carga_diaria_minutos", sa.Integer(), nullable=False),
        sa.Column("intervalo_minimo_minutos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("intervalo_maximo_minutos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tolerancia_minutos", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "marcacoes_brutas",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("data_hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("fonte", sa.String(length=40), nullable=False),
        sa.Column("hash_sha256", sa.String(length=64), nullable=False),
        sa.Column("ip", sa.String(length=80), nullable=True),
        sa.Column("metadados", postgresql.JSONB(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "marcacoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False, index=True),
        sa.Column(
            "marcacao_bruta_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("marcacoes_brutas.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column("data_hora", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_referencia", sa.Date(), nullable=False, index=True),
        sa.Column("fuso_horario", sa.String(length=80), nullable=False),
        sa.Column("tipo", sa.String(length=32), nullable=False),
        sa.Column("fonte", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "apuracoes_diarias",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("data_referencia", sa.Date(), nullable=False, index=True),
        sa.Column("carga_prevista_minutos", sa.Integer(), nullable=False),
        sa.Column("minutos_trabalhados", sa.Integer(), nullable=False),
        sa.Column("minutos_intervalo", sa.Integer(), nullable=False),
        sa.Column("minutos_credito", sa.Integer(), nullable=False),
        sa.Column("minutos_debito", sa.Integer(), nullable=False),
        sa.Column("resultado", sa.String(length=40), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("primeira_entrada", sa.String(length=16), nullable=True),
        sa.Column("saida_intervalo", sa.String(length=16), nullable=True),
        sa.Column("retorno_intervalo", sa.String(length=16), nullable=True),
        sa.Column("ultima_saida", sa.String(length=16), nullable=True),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.UniqueConstraint("usuario_id", "data_referencia", name="uq_apuracao_usuario_data"),
    )

    op.create_table(
        "banco_horas_saldos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("saldo_minutos", sa.Integer(), nullable=False),
        sa.Column("creditos_mes_minutos", sa.Integer(), nullable=False),
        sa.Column("debitos_mes_minutos", sa.Integer(), nullable=False),
        sa.Column("creditos_a_vencer_minutos", sa.Integer(), nullable=False),
        sa.Column("horas_acima_limite_minutos", sa.Integer(), nullable=False),
        sa.Column("horas_nao_autorizadas_minutos", sa.Integer(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        "banco_horas_movimentos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("tipo", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("data_referencia", sa.Date(), nullable=False),
        sa.Column("minutos", sa.Integer(), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("expira_em", sa.Date(), nullable=True),
    )

    op.create_table(
        "homologacoes_servidores_meses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False, index=True),
        sa.Column("servidor_nome", sa.String(length=160), nullable=False),
        sa.Column("matricula", sa.String(length=32), nullable=False),
        sa.Column("unidade", sa.String(length=120), nullable=False),
        sa.Column("ano_referencia", sa.Integer(), nullable=False),
        sa.Column("mes_referencia", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("carga_prevista_minutos", sa.Integer(), nullable=False),
        sa.Column("minutos_trabalhados", sa.Integer(), nullable=False),
        sa.Column("minutos_credito", sa.Integer(), nullable=False),
        sa.Column("minutos_debito", sa.Integer(), nullable=False),
        sa.Column("faltas", sa.Integer(), nullable=False),
        sa.Column("pendencias_resumo", sa.Text(), nullable=True),
        sa.Column("homologado_por", sa.String(length=64), nullable=True),
        sa.Column("homologado_em", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("usuario_id", "ano_referencia", "mes_referencia", name="uq_homologacao_mes"),
    )


def downgrade() -> None:
    op.drop_table("homologacoes_servidores_meses")
    op.drop_table("banco_horas_movimentos")
    op.drop_table("banco_horas_saldos")
    op.drop_table("apuracoes_diarias")
    op.drop_table("marcacoes")
    op.drop_table("marcacoes_brutas")
    op.drop_table("jornadas")
