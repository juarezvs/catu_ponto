"""0003_secp_ponto_full_schema_indexes

Revision ID: 0003_secp_ponto_full
Revises: 0002_secp_ponto
Create Date: 2026-11-16 19:15:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003_secp_ponto_full"
down_revision = "0002_secp_ponto"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "secp_departamentos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=32), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=180), nullable=False),
        sa.Column("orgao_sigla", sa.String(length=32), nullable=False),
        sa.Column("gestor_nome", sa.String(length=160), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("idx_secp_departamentos_orgao", "secp_departamentos", ["orgao_sigla"])

    op.create_table(
        "secp_cargos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=32), nullable=False, unique=True),
        sa.Column("cbo", sa.String(length=16), nullable=False),
        sa.Column("nome", sa.String(length=160), nullable=False),
        sa.Column("regime", sa.String(length=40), nullable=False),
        sa.Column("carga_semanal", sa.Integer(), nullable=False, server_default="35"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("idx_secp_cargos_cbo", "secp_cargos", ["cbo"])

    op.create_table(
        "secp_funcoes_confianca",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=32), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=180), nullable=False),
        sa.Column("regra_ponto", sa.String(length=80), nullable=False),
        sa.Column("dispensa_ponto", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "secp_servidores",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("matricula", sa.String(length=32), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=False, unique=True),
        sa.Column("cargo", sa.String(length=140), nullable=False),
        sa.Column("departamento", sa.String(length=160), nullable=False),
        sa.Column("orgao_sigla", sa.String(length=32), nullable=False),
        sa.Column("jornada_codigo", sa.String(length=40), nullable=False, server_default="JOR-7H"),
        sa.Column("dispensa_ponto", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="Ativo"),
    )
    op.create_index("idx_servidores_orgao_status", "secp_servidores", ["orgao_sigla", "status"])
    op.create_index("idx_servidores_nome", "secp_servidores", ["nome"])

    op.create_table(
        "secp_calendario_institucional",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("data_evento", sa.Date(), nullable=False),
        sa.Column("descricao", sa.String(length=200), nullable=False),
        sa.Column("tipo", sa.String(length=48), nullable=False),
        sa.Column("abrangencia", sa.String(length=32), nullable=False),
        sa.Column("efeito_escalas", sa.String(length=200), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index(
        "idx_calendario_data_abrangencia",
        "secp_calendario_institucional",
        ["data_evento", "abrangencia"],
    )

    op.create_table(
        "secp_equipamentos_biometricos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=40), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=160), nullable=False),
        sa.Column("modelo", sa.String(length=80), nullable=False),
        sa.Column("ip_endereco", sa.String(length=64), nullable=False),
        sa.Column("unidade_nome", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="Online"),
    )

    op.create_table(
        "secp_solicitacoes_ponto",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("protocolo", sa.String(length=40), nullable=False, unique=True),
        sa.Column("servidor_nome", sa.String(length=160), nullable=False),
        sa.Column("tipo", sa.String(length=64), nullable=False),
        sa.Column("data_referencia", sa.String(length=16), nullable=False),
        sa.Column("motivo", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="Pendente Chefia"),
    )
    op.create_index("idx_solicitacoes_status_data", "secp_solicitacoes_ponto", ["status", "data_referencia"])

    op.create_table(
        "ocorrencias_frequencia",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("servidor_nome", sa.String(length=160), nullable=False),
        sa.Column("data_referencia", sa.String(length=16), nullable=False),
        sa.Column("tipo", sa.String(length=48), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=False),
        sa.Column("minutos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="Pendente"),
    )

    op.create_table(
        "recessos_forenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("ano_exercicio", sa.Integer(), nullable=False, unique=True),
        sa.Column("periodo", sa.String(length=64), nullable=False),
        sa.Column("servidor_convocado", sa.String(length=160), nullable=False),
        sa.Column("modalidade_compensacao", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="Ativo"),
    )

    # Índices compostos adicionais nas tabelas de apuração e marcação
    op.create_index("idx_jornadas_tipo_ativo", "jornadas", ["tipo_jornada", "ativo"])
    op.create_index("idx_marcacoes_brutas_hash", "marcacoes_brutas", ["hash_sha256"])
    op.create_index("idx_marcacoes_brutas_usuario_hora", "marcacoes_brutas", ["usuario_id", "data_hora"])
    op.create_index(
        "idx_marcacoes_usuario_data_status",
        "marcacoes",
        ["usuario_id", "data_referencia", "status", "data_hora"],
    )
    op.create_index("idx_apuracoes_resultado_data", "apuracoes_diarias", ["resultado", "data_referencia"])
    op.create_index(
        "idx_bh_mov_usuario_status_data",
        "banco_horas_movimentos",
        ["usuario_id", "status", "data_referencia"],
    )
    op.create_index(
        "idx_homologacao_competencia_status",
        "homologacoes_servidores_meses",
        ["ano_referencia", "mes_referencia", "status"],
    )


def downgrade() -> None:
    op.drop_table("recessos_forenses")
    op.drop_table("ocorrencias_frequencia")
    op.drop_table("secp_solicitacoes_ponto")
    op.drop_table("secp_equipamentos_biometricos")
    op.drop_table("secp_calendario_institucional")
    op.drop_table("secp_servidores")
    op.drop_table("secp_funcoes_confianca")
    op.drop_table("secp_cargos")
    op.drop_table("secp_departamentos")
