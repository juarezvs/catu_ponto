import json
import math
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

# Limiar recomendado: 85% de similaridade de cosseno (equivalente a distância euclidiana <= 0.547
# para vetores L2-normalizados de 128 dimensões). Tolera variações naturais de iluminação/webcam
# (mesma pessoa tipicamente 88%-96%), enquanto bloqueia terceiros (<80%), e exige prova de vida
# ativa + micro-movimento passivo para impedir fraude com foto estática.
CONFIABILIDADE_MINIMA_PADRAO_PCT = 85.0
EMBEDDING_DIM = 128

_BIOMETRIA_SCHEMA_ENSURED = False


def ensure_biometria_facial_schema(session: Session) -> None:
    """Garante de forma idempotente as tabelas de biometria facial e auditoria de tentativas."""
    global _BIOMETRIA_SCHEMA_ENSURED
    if _BIOMETRIA_SCHEMA_ENSURED:
        return

    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS biometria_facial_servidores (
                id uuid PRIMARY KEY,
                servidor_id uuid NOT NULL UNIQUE REFERENCES servidores(id) ON DELETE CASCADE,
                embedding_json jsonb NOT NULL,
                confiabilidade_minima numeric(5,2) NOT NULL DEFAULT 85.00,
                prova_vida_cadastro varchar(40) NOT NULL DEFAULT 'PISCAR',
                amostras_coletadas int4 NOT NULL DEFAULT 1,
                foto_referencia_base64 text,
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
            CREATE TABLE IF NOT EXISTS biometria_facial_tentativas (
                id uuid PRIMARY KEY,
                servidor_id uuid NOT NULL REFERENCES servidores(id) ON DELETE CASCADE,
                acao varchar(30) NOT NULL,
                sucesso boolean NOT NULL,
                confianca_pct numeric(5,2) NOT NULL DEFAULT 0.00,
                limiar_pct numeric(5,2) NOT NULL DEFAULT 85.00,
                prova_vida_tipo varchar(40) NOT NULL,
                prova_vida_aprovada boolean NOT NULL,
                motivo_rejeicao text,
                criado_em timestamp with time zone NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    session.commit()
    _BIOMETRIA_SCHEMA_ENSURED = True


def validate_and_normalize_embedding(vec: list[float]) -> list[float]:
    """Valida que o descritor facial possui 128 dimensões finitas e retorna o vetor L2-normalizado."""
    if not isinstance(vec, list) or len(vec) != EMBEDDING_DIM:
        raise ValueError(f"Descritor facial inválido: esperado vetor de {EMBEDDING_DIM} dimensões.")
    cleaned: list[float] = []
    sq_sum = 0.0
    for val in vec:
        f = float(val)
        if not math.isfinite(f):
            raise ValueError("Descritor facial contém valores não finitos.")
        cleaned.append(f)
        sq_sum += f * f
    norm = math.sqrt(sq_sum)
    if norm <= 1e-8:
        raise ValueError("Descritor facial nulo.")
    return [v / norm for v in cleaned]


def compute_centroid_embedding(vectors: list[list[float]]) -> list[float]:
    """Calcula a média L2-normalizada de múltiplas capturas faciais do servidor."""
    if not vectors:
        raise ValueError("Nenhuma amostra facial fornecida para cadastro.")
    normalized = [validate_and_normalize_embedding(v) for v in vectors]
    acc = [0.0] * EMBEDDING_DIM
    for v in normalized:
        for i, val in enumerate(v):
            acc[i] += val
    count = float(len(normalized))
    avg = [x / count for x in acc]
    return validate_and_normalize_embedding(avg)


def cosine_similarity_pct(vec_a: list[float], vec_b: list[float]) -> float:
    """Calcula similaridade de cosseno convertida para escala percentual [0.0, 100.0]."""
    a = validate_and_normalize_embedding(vec_a)
    b = validate_and_normalize_embedding(vec_b)
    dot = sum(x * y for x, y in zip(a, b))
    clamped = max(-1.0, min(1.0, dot))
    return round(max(0.0, clamped) * 100.0, 2)


def get_biometria_status(session: Session, servidor_id: str) -> dict[str, Any]:
    ensure_biometria_facial_schema(session)
    row = session.execute(
        text(
            """
            SELECT id::text, confiabilidade_minima, prova_vida_cadastro,
                   amostras_coletadas, foto_referencia_base64, ativo, atualizado_em
            FROM biometria_facial_servidores
            WHERE servidor_id = CAST(:sid AS uuid)
              AND ativo = true
            LIMIT 1
            """
        ),
        {"sid": servidor_id},
    ).mappings().first()

    if not row:
        return {
            "cadastrado": False,
            "confiabilidadeMinimaPct": CONFIABILIDADE_MINIMA_PADRAO_PCT,
            "amostrasColetadas": 0,
            "atualizadoEm": None,
            "fotoReferenciaBase64": None,
        }

    return {
        "cadastrado": True,
        "confiabilidadeMinimaPct": float(row["confiabilidade_minima"]),
        "amostrasColetadas": int(row["amostras_coletadas"]),
        "atualizadoEm": row["atualizado_em"].isoformat() if row["atualizado_em"] else None,
        "fotoReferenciaBase64": row["foto_referencia_base64"],
    }


def registrar_tentativa_biometria(
    session: Session,
    *,
    servidor_id: str,
    acao: str,
    sucesso: bool,
    confianca_pct: float,
    limiar_pct: float,
    prova_vida_tipo: str,
    prova_vida_aprovada: bool,
    motivo_rejeicao: str | None = None,
) -> None:
    session.execute(
        text(
            """
            INSERT INTO biometria_facial_tentativas (
                id, servidor_id, acao, sucesso, confianca_pct, limiar_pct,
                prova_vida_tipo, prova_vida_aprovada, motivo_rejeicao, criado_em
            ) VALUES (
                CAST(:id AS uuid), CAST(:sid AS uuid), :acao, :sucesso, :conf, :limiar,
                :pv_tipo, :pv_ok, :motivo, NOW()
            )
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "sid": servidor_id,
            "acao": acao,
            "sucesso": sucesso,
            "conf": round(confianca_pct, 2),
            "limiar": round(limiar_pct, 2),
            "pv_tipo": prova_vida_tipo,
            "pv_ok": prova_vida_aprovada,
            "motivo": motivo_rejeicao,
        },
    )


def cadastrar_biometria_servidor(
    session: Session,
    *,
    servidor_id: str,
    embeddings: list[list[float]],
    prova_vida_tipo: str,
    prova_vida_aprovada: bool,
    frames_analisados: int,
    foto_referencia_base64: str | None = None,
) -> dict[str, Any]:
    ensure_biometria_facial_schema(session)

    if not prova_vida_aprovada or frames_analisados < 3:
        registrar_tentativa_biometria(
            session,
            servidor_id=servidor_id,
            acao="CADASTRO",
            sucesso=False,
            confianca_pct=0.0,
            limiar_pct=CONFIABILIDADE_MINIMA_PADRAO_PCT,
            prova_vida_tipo=prova_vida_tipo,
            prova_vida_aprovada=prova_vida_aprovada,
            motivo_rejeicao="Prova de vida não concluída durante o cadastro facial.",
        )
        session.commit()
        raise ValueError("Prova de vida não concluída. Execute o movimento solicitado na câmera.")

    centroid = compute_centroid_embedding(embeddings)
    foto_safe = (
        foto_referencia_base64[:120000]
        if foto_referencia_base64 and foto_referencia_base64.startswith("data:image/")
        else None
    )

    session.execute(
        text(
            """
            INSERT INTO biometria_facial_servidores (
                id, servidor_id, embedding_json, confiabilidade_minima,
                prova_vida_cadastro, amostras_coletadas, foto_referencia_base64,
                ativo, criado_em, atualizado_em
            ) VALUES (
                CAST(:id AS uuid), CAST(:sid AS uuid), CAST(:emb AS jsonb), :limiar,
                :pv_tipo, :amostras, :foto, true, NOW(), NOW()
            )
            ON CONFLICT (servidor_id) DO UPDATE SET
                embedding_json = EXCLUDED.embedding_json,
                prova_vida_cadastro = EXCLUDED.prova_vida_cadastro,
                amostras_coletadas = EXCLUDED.amostras_coletadas,
                foto_referencia_base64 = COALESCE(EXCLUDED.foto_referencia_base64, biometria_facial_servidores.foto_referencia_base64),
                ativo = true,
                atualizado_em = NOW()
            """
        ),
        {
            "id": str(uuid.uuid4()),
            "sid": servidor_id,
            "emb": json.dumps(centroid),
            "limiar": CONFIABILIDADE_MINIMA_PADRAO_PCT,
            "pv_tipo": prova_vida_tipo,
            "amostras": len(embeddings),
            "foto": foto_safe,
        },
    )

    registrar_tentativa_biometria(
        session,
        servidor_id=servidor_id,
        acao="CADASTRO",
        sucesso=True,
        confianca_pct=100.0,
        limiar_pct=CONFIABILIDADE_MINIMA_PADRAO_PCT,
        prova_vida_tipo=prova_vida_tipo,
        prova_vida_aprovada=True,
    )
    session.commit()

    return get_biometria_status(session, servidor_id)


def verificar_biometria_servidor(
    session: Session,
    *,
    servidor_id: str,
    embedding: list[float],
    prova_vida_tipo: str,
    prova_vida_aprovada: bool,
    frames_analisados: int,
) -> dict[str, Any]:
    ensure_biometria_facial_schema(session)

    bio = session.execute(
        text(
            """
            SELECT embedding_json, confiabilidade_minima
            FROM biometria_facial_servidores
            WHERE servidor_id = CAST(:sid AS uuid)
              AND ativo = true
            LIMIT 1
            """
        ),
        {"sid": servidor_id},
    ).mappings().first()

    if not bio:
        raise ValueError(
            "Biometria facial ainda não cadastrada para este servidor. "
            "Realize o cadastro facial antes de registrar o ponto."
        )

    limiar = float(bio["confiabilidade_minima"] or CONFIABILIDADE_MINIMA_PADRAO_PCT)

    if not prova_vida_aprovada or frames_analisados < 3:
        registrar_tentativa_biometria(
            session,
            servidor_id=servidor_id,
            acao="MARCACAO",
            sucesso=False,
            confianca_pct=0.0,
            limiar_pct=limiar,
            prova_vida_tipo=prova_vida_tipo,
            prova_vida_aprovada=False,
            motivo_rejeicao="Prova de vida reprovada ou insuficiente (possível foto estática).",
        )
        session.commit()
        raise PermissionError(
            "Prova de vida não concluída. Olhe para a câmera e execute o movimento solicitado."
        )

    stored_vec = bio["embedding_json"]
    if isinstance(stored_vec, str):
        stored_vec = json.loads(stored_vec)

    confianca_pct = cosine_similarity_pct(stored_vec, embedding)

    if confianca_pct < limiar:
        registrar_tentativa_biometria(
            session,
            servidor_id=servidor_id,
            acao="MARCACAO",
            sucesso=False,
            confianca_pct=confianca_pct,
            limiar_pct=limiar,
            prova_vida_tipo=prova_vida_tipo,
            prova_vida_aprovada=True,
            motivo_rejeicao=f"Similaridade facial ({confianca_pct:.1f}%) abaixo do mínimo ({limiar:.1f}%).",
        )
        session.commit()
        raise PermissionError(
            f"Reconhecimento facial não atingiu a confiabilidade mínima "
            f"(obtido {confianca_pct:.1f}%, mínimo exigido {limiar:.0f}%). "
            f"Tente novamente em local iluminado."
        )

    registrar_tentativa_biometria(
        session,
        servidor_id=servidor_id,
        acao="MARCACAO",
        sucesso=True,
        confianca_pct=confianca_pct,
        limiar_pct=limiar,
        prova_vida_tipo=prova_vida_tipo,
        prova_vida_aprovada=True,
    )
    session.commit()

    return {
        "aprovado": True,
        "confiancaPct": confianca_pct,
        "limiarPct": limiar,
        "provaVidaTipo": prova_vida_tipo,
    }
