import uuid
from sqlalchemy import text
from sqlalchemy.orm import Session

_SCHEMA_ENSURED = False

DEFAULT_TIPOS_EQUIPAMENTO: tuple[tuple[str, str, str, str], ...] = (
    (
        "FACIAL",
        "Reconhecimento Facial",
        "facial",
        "Totem ou coletor biométrico com reconhecimento facial.",
    ),
    (
        "RELOGIO",
        "Relógio de Ponto (REP)",
        "relogio",
        "Registrador Eletrônico de Ponto físico (REP).",
    ),
    (
        "WEB",
        "Sistema Web",
        "computador",
        "Registro realizado via navegador no portal web institucional.",
    ),
    (
        "SMARTPHONE",
        "Smartphone / App",
        "celular",
        "Registro realizado via aplicativo móvel em smartphone.",
    ),
    (
        "AJUSTE",
        "Ajuste Administrativo",
        "ajuste",
        "Inclusão ou ajuste manual realizado pela administração/chefia.",
    ),
)


def ensure_tipos_equipamento_schema(session: Session) -> None:
    """Garante a existência da tabela tipos_equipamento_biometrico e da FK em equipamentos_biometricos."""
    global _SCHEMA_ENSURED
    if _SCHEMA_ENSURED:
        return

    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS tipos_equipamento_biometrico (
                id uuid PRIMARY KEY,
                codigo varchar(50) NOT NULL UNIQUE,
                nome varchar(120) NOT NULL,
                icone varchar(40) NOT NULL DEFAULT 'relogio',
                descricao text,
                ativo boolean NOT NULL DEFAULT true,
                criado_em timestamp with time zone NOT NULL DEFAULT NOW(),
                atualizado_em timestamp with time zone NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    session.execute(
        text(
            """
            ALTER TABLE equipamentos_biometricos
            ADD COLUMN IF NOT EXISTS tipo_equipamento_id uuid
            REFERENCES tipos_equipamento_biometrico(id)
            """
        )
    )

    existing_count = int(
        session.execute(text("SELECT COUNT(*) FROM tipos_equipamento_biometrico")).scalar_one()
    )
    if existing_count == 0:
        for codigo, nome, icone, descricao in DEFAULT_TIPOS_EQUIPAMENTO:
            session.execute(
                text(
                    """
                    INSERT INTO tipos_equipamento_biometrico
                        (id, codigo, nome, icone, descricao, ativo, criado_em, atualizado_em)
                    VALUES
                        (CAST(:id AS uuid), :codigo, :nome, :icone, :descricao, true, NOW(), NOW())
                    ON CONFLICT (codigo) DO NOTHING
                    """
                ),
                {
                    "id": str(uuid.uuid4()),
                    "codigo": codigo,
                    "nome": nome,
                    "icone": icone,
                    "descricao": descricao,
                },
            )

    session.commit()
    _SCHEMA_ENSURED = True
