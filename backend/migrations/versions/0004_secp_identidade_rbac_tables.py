"""0004_secp_identidade_rbac_tables

Revision ID: 0004_secp_rbac
Revises: 0003_secp_ponto_full
Create Date: 2026-11-16 19:28:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004_secp_rbac"
down_revision = "0003_secp_ponto_full"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "perfis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=80), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("sistema", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("administrativo", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("excecao", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("global", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("orgao_id", sa.String(length=64), nullable=True),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_perfis_orgao", "perfis", ["orgao_id"])

    op.create_table(
        "permissoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("codigo", sa.String(length=160), nullable=False, unique=True),
        sa.Column("recurso", sa.String(length=80), nullable=False),
        sa.Column("acao", sa.String(length=80), nullable=False),
        sa.Column("escopo", sa.String(length=80), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.UniqueConstraint("recurso", "acao", "escopo", name="uq_permissoes_recurso_acao_escopo"),
    )

    op.create_table(
        "perfis_permissoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("perfil_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("perfis.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permissao_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("permissoes.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("perfil_id", "permissao_id", name="uq_perfil_permissao"),
    )
    op.create_index("idx_perfis_permissoes_perfil", "perfis_permissoes", ["perfil_id"])

    op.create_table(
        "perfis_permissoes_orgaos",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("perfil_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("perfis.id", ondelete="CASCADE"), nullable=False),
        sa.Column("permissao_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("permissoes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("orgao_id", sa.String(length=64), nullable=False),
        sa.Column("permitida", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("perfil_id", "permissao_id", "orgao_id", name="uq_perfil_perm_orgao"),
    )
    op.create_index("idx_perfis_perm_orgao_lookup", "perfis_permissoes_orgaos", ["perfil_id", "orgao_id"])

    op.create_table(
        "usuarios_perfis",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("usuario_id", sa.String(length=64), nullable=False),
        sa.Column("perfil_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("perfis.id", ondelete="CASCADE"), nullable=False),
        sa.Column("orgao_id", sa.String(length=64), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.create_index("idx_usuarios_perfis_lookup", "usuarios_perfis", ["usuario_id", "perfil_id", "orgao_id"])

    op.create_table(
        "rotinas_liberacoes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tipo", sa.String(length=48), nullable=False),
        sa.Column("chave", sa.String(length=160), nullable=False),
        sa.Column("liberada", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.UniqueConstraint("tipo", "chave", name="uq_rotina_tipo_chave"),
    )
    op.create_index("idx_rotinas_liberacoes_tipo_liberada", "rotinas_liberacoes", ["tipo", "liberada"])


def downgrade() -> None:
    op.drop_table("rotinas_liberacoes")
    op.drop_table("usuarios_perfis")
    op.drop_table("perfis_permissoes_orgaos")
    op.drop_table("perfis_permissoes")
    op.drop_table("permissoes")
    op.drop_table("perfis")
