"""0001_initial_secp_postgres_pgvector

Revision ID: 0001_secp_pgvector
Revises:
Create Date: 2026-11-16 18:45:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "0001_secp_pgvector"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "secp_orgaos",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("sigla", sa.String(length=32), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("cnpj", sa.String(length=20), nullable=True, unique=True),
        sa.Column("unidade_ativa", sa.String(length=255), nullable=False),
        sa.Column("teto_hora_extra_mensal", sa.String(length=64), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )

    op.create_table(
        "secp_unidades",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column(
            "orgao_id",
            sa.String(length=64),
            sa.ForeignKey("secp_orgaos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("codigo", sa.String(length=32), nullable=False, unique=True),
        sa.Column("nome", sa.String(length=255), nullable=False),
        sa.Column("raio_geofence_metros", sa.Numeric(8, 2), nullable=False),
    )

    op.create_table(
        "secp_modulos",
        sa.Column("slug", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("short_name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("theme_color_hex", sa.String(length=16), nullable=False),
        sa.Column("tailwind_accent", sa.String(length=32), nullable=False),
        sa.Column("icon", sa.String(length=64), nullable=False),
        sa.Column("badge_text", sa.String(length=120), nullable=False),
        sa.Column("stats_label", sa.String(length=255), nullable=False),
        sa.Column("required_permission", sa.String(length=128), nullable=False),
    )

    op.create_table(
        "secp_usuarios",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("matricula", sa.String(length=32), nullable=False, unique=True),
        sa.Column("cpf_hash", sa.String(length=128), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("role_code", sa.String(length=64), nullable=False),
        sa.Column("role_name", sa.String(length=128), nullable=False),
        sa.Column(
            "default_orgao_id",
            sa.String(length=64),
            sa.ForeignKey("secp_orgaos.id"),
            nullable=False,
        ),
        sa.Column("avatar_initials", sa.String(length=8), nullable=False),
        sa.Column("allowed_modules_json", postgresql.JSONB(), nullable=False),
        sa.Column("permissions_json", postgresql.JSONB(), nullable=False),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "secp_norma_documento_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "orgao_id",
            sa.String(length=64),
            sa.ForeignKey("secp_orgaos.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("modulo_slug", sa.String(length=64), nullable=True),
        sa.Column("lei_codigo", sa.String(length=255), nullable=False),
        sa.Column("artigo", sa.String(length=64), nullable=False),
        sa.Column("paragrafo", sa.String(length=64), nullable=True),
        sa.Column("inciso", sa.String(length=64), nullable=True),
        sa.Column("vigencia_inicio", sa.Date(), nullable=False),
        sa.Column("vigencia_fim", sa.Date(), nullable=True),
        sa.Column("conteudo_normativo", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("tsv_lexical", postgresql.TSVECTOR(), nullable=True),
    )

    op.execute(
        "CREATE INDEX idx_secp_norma_embedding_hnsw ON secp_norma_documento_chunks USING hnsw (embedding vector_cosine_ops)"
    )
    op.create_index(
        "idx_norma_chunk_tsv_gin",
        "secp_norma_documento_chunks",
        ["tsv_lexical"],
        postgresql_using="gin",
    )


def downgrade() -> None:
    op.drop_table("secp_norma_documento_chunks")
    op.drop_table("secp_usuarios")
    op.drop_table("secp_modulos")
    op.drop_table("secp_unidades")
    op.drop_table("secp_orgaos")
