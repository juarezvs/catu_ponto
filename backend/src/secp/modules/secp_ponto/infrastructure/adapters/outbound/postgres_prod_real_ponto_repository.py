from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
import hashlib
import json
from typing import Any, Optional
import uuid
import bcrypt
from sqlalchemy import text
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.infrastructure.database.postgres_session import ProdRealSyncSessionLocal
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    LIMITE_MARCACOES_CONTABILIZADAS_DIA,
    classificar_tipo_marcacao_por_sequencia,
)


class PostgresProdRealPontoRepository:
    """
    Outbound Adapter Hexagonal conectado diretamente às tabelas reais restauradas no
    PostgreSQL 18 (`secp_prod_real`) + Cache Distribuído Redis.
    """

    def __init__(self, redis_gateway: SecpRedisCacheGateway) -> None:
        self._redis = redis_gateway

    def list_real_orgaos(self) -> list[dict[str, Any]]:
        cache_key = "secp:prod_real:orgaos_ativos"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, list):
            return cached

        with ProdRealSyncSessionLocal() as session:
            rows = session.execute(
                text(
                    """
                    SELECT id::text, sigla, nome, fuso_horario, COALESCE(municipio, 'Sede') AS municipio, COALESCE(uf, '') AS uf
                    FROM orgaos
                    WHERE ativo = true
                    ORDER BY CASE WHEN sigla = 'SJAM' THEN 0 ELSE 1 END, sigla
                    """
                )
            ).mappings().all()
            result = [
                {
                    "id": r["id"],
                    "sigla": r["sigla"],
                    "nome": r["nome"],
                    "fusoHorario": r["fuso_horario"] or "America/Manaus",
                    "unidadeLabel": f"{r['sigla']} • {r['municipio']} • Sede",
                }
                for r in rows
            ]
            self._redis.set_json(cache_key, result, ttl_seconds=120)
            return result

    def list_servidores_sample(
        self, orgao_sigla: str = "SJAM", search: str = "", limit: int = 20
    ) -> list[dict[str, Any]]:
        with ProdRealSyncSessionLocal() as session:
            rows = session.execute(
                text(
                    """
                    SELECT s.id::text, s.matricula, s.nome_funcional, o.sigla AS orgao_sigla,
                           o.fuso_horario, COALESCE(u.nome, 'Sede') AS unidade_nome,
                           COALESCE(c.descricao, 'Servidor Público') AS cargo_nome
                    FROM servidores s
                    JOIN orgaos o ON o.id = s.orgao_id
                    LEFT JOIN lotacoes l ON l.servidor_id = s.id AND l.status = 'ATIVO'
                    LEFT JOIN unidades_organizacionais u ON u.id = l.unidade_id
                    LEFT JOIN cargos c ON c.id = s.cargo_id
                    WHERE s.ativo = true
                      AND o.sigla = :orgao_sigla
                      AND (:search = '' OR s.matricula ILIKE :pattern OR s.nome_funcional ILIKE :pattern)
                    ORDER BY s.nome_funcional
                    LIMIT :limit
                    """
                ),
                {
                    "orgao_sigla": orgao_sigla.upper(),
                    "search": search.strip(),
                    "pattern": f"%{search.strip()}%",
                    "limit": limit,
                },
            ).mappings().all()
            return [dict(r) for r in rows]

    def get_regulamentacao_orgao(self, orgao_sigla: str = "SJAM") -> dict[str, Any]:
        cache_key = f"secp:prod_real:reg:{orgao_sigla.upper()}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return cached

        with ProdRealSyncSessionLocal() as session:
            row = session.execute(
                text(
                    """
                    SELECT r.*, o.sigla AS orgao_sigla, o.fuso_horario
                    FROM regulamentacoes_ponto_orgaos r
                    JOIN orgaos o ON o.id = r.orgao_id
                    WHERE o.sigla = :sigla AND r.ativo = true
                    LIMIT 1
                    """
                ),
                {"sigla": orgao_sigla.upper()},
            ).mappings().first()

            if row is None:
                row = session.execute(
                    text(
                        """
                        SELECT r.*, o.sigla AS orgao_sigla, o.fuso_horario
                        FROM regulamentacoes_ponto_orgaos r
                        JOIN orgaos o ON o.id = r.orgao_id
                        WHERE o.sigla = 'SJAM'
                        LIMIT 1
                        """
                    )
                ).mappings().first()

            if row is None:
                return {
                    "orgaoSigla": orgao_sigla.upper(),
                    "numeroPortaria": "Portaria SJAM-DIREF 135/2025",
                    "limiteCreditoMensalMinutos": 960,
                    "mesesExpiracaoCompensacao": 3,
                    "jornada7hCreditoMinimoMinutos": 480,
                    "exigeAutorizacaoPreviaCredito": True,
                    "expedientePadraoInicio": "08:00",
                    "expedientePadraoFim": "15:00",
                    "entradaMinimaPermitida": "06:00",
                    "saidaMaximaPermitida": "19:00",
                    "prazoHomologacaoDiaMesSeguinte": 10,
                    "percentualCreditoSabado": 50,
                    "percentualCreditoDomingoFeriado": 100,
                    "percentualCreditoRecesso": 100,
                    "limiteMarcacoesDia": LIMITE_MARCACOES_CONTABILIZADAS_DIA,
                }

            res = {
                "orgaoId": str(row["orgao_id"]),
                "orgaoSigla": row["orgao_sigla"],
                "numeroPortaria": row["numero_portaria"],
                "limiteCreditoMensalMinutos": int(row["limite_credito_mensal_minutos"]),
                "mesesExpiracaoCompensacao": int(row["meses_expiracao_compensacao"]),
                "jornada7hCreditoMinimoMinutos": int(row["jornada_7h_credito_minimo_minutos"]),
                "exigeAutorizacaoPreviaCredito": bool(row["exige_autorizacao_previa_credito"]),
                "expedientePadraoInicio": str(row["expediente_padrao_inicio"]),
                "expedientePadraoFim": str(row["expediente_padrao_fim"]),
                "entradaMinimaPermitida": str(row["entrada_minima_permitida"]),
                "saidaMaximaPermitida": str(row["saida_maxima_permitida"]),
                "prazoHomologacaoDiaMesSeguinte": int(row["prazo_homologacao_dia_mes_seguinte"]),
                "limiteViradaMadrugada": str(row["limite_virada_madrugada"]),
                "percentualCreditoSabado": int(row["percentual_credito_sabado"]),
                "percentualCreditoDomingoFeriado": int(row["percentual_credito_domingo_feriado"]),
                "percentualCreditoRecesso": int(row["percentual_credito_recesso"]),
                "limiteMarcacoesDia": LIMITE_MARCACOES_CONTABILIZADAS_DIA,
            }
            self._redis.set_json(cache_key, res, ttl_seconds=120)
            return res

    def _resolve_servidor(self, session: Any, matricula: str) -> dict[str, Any]:
        mat_clean = matricula.strip().upper()
        if mat_clean == "SECP.MASTER":
            # Mapeia SECP.MASTER para demonstração em servidor real da SJAM quando visualizando ponto próprio
            mat_clean = "AM200385"

        row = session.execute(
            text(
                """
                SELECT s.id::text AS servidor_id, s.usuario_id::text, s.matricula,
                       s.nome_funcional, s.cpf, o.id::text AS orgao_id, o.sigla AS orgao_sigla,
                       o.nome AS orgao_nome,
                       COALESCE(NULLIF(TRIM(u.fuso_horario), ''), NULLIF(TRIM(o.fuso_horario), ''), 'America/Manaus') AS fuso_horario,
                       COALESCE(u.nome, 'Sede') AS unidade_nome,
                       COALESCE(c.descricao, 'Servidor') AS cargo_nome
                FROM servidores s
                JOIN orgaos o ON o.id = s.orgao_id
                LEFT JOIN lotacoes l ON l.servidor_id = s.id AND l.status = 'ATIVO'
                LEFT JOIN unidades_organizacionais u ON u.id = l.unidade_id
                LEFT JOIN cargos c ON c.id = s.cargo_id
                WHERE UPPER(s.matricula) = :mat AND s.ativo = true
                LIMIT 1
                """
            ),
            {"mat": mat_clean},
        ).mappings().first()

        if row is None:
            row = session.execute(
                text(
                    """
                    SELECT s.id::text AS servidor_id, s.usuario_id::text, s.matricula,
                           s.nome_funcional, s.cpf, o.id::text AS orgao_id, o.sigla AS orgao_sigla,
                           o.nome AS orgao_nome, o.fuso_horario,
                           COALESCE(u.nome, 'Sede') AS unidade_nome,
                           COALESCE(c.descricao, 'Servidor') AS cargo_nome
                    FROM servidores s
                    JOIN orgaos o ON o.id = s.orgao_id
                    LEFT JOIN lotacoes l ON l.servidor_id = s.id AND l.status = 'ATIVO'
                    LEFT JOIN unidades_organizacionais u ON u.id = l.unidade_id
                    LEFT JOIN cargos c ON c.id = s.cargo_id
                    WHERE o.sigla = 'SJAM' AND s.ativo = true
                    LIMIT 1
                    """
                )
            ).mappings().first()

        if row is None:
            raise ValueError("Nenhum servidor ativo encontrado na base secp_prod_real.")
        return dict(row)

    def autenticar_usuario_real(self, matricula: str, senha: str) -> dict[str, Any]:
        mat_clean = (matricula or "").strip().upper()
        pwd_clean = (senha or "").strip()
        if not mat_clean or not pwd_clean:
            raise ValueError("Informe matrícula e senha.")

        with ProdRealSyncSessionLocal() as session:
            user = session.execute(
                text(
                    """
                    SELECT id::text, matricula, nome, email, tipo::text AS tipo, senha_hash, ativo
                    FROM usuarios
                    WHERE UPPER(matricula) = :mat AND ativo = true
                    LIMIT 1
                    """
                ),
                {"mat": mat_clean},
            ).mappings().first()

            if user is None:
                raise ValueError("Matrícula ou senha inválida.")

            stored_hash = user["senha_hash"]
            if not stored_hash:
                raise ValueError(
                    "Usuário não possui senha local cadastrada. Defina uma senha no cadastro de Usuários."
                )

            try:
                ok = bcrypt.checkpw(
                    pwd_clean.encode("utf-8"), str(stored_hash).encode("utf-8")
                )
            except ValueError:
                ok = False

            if not ok:
                raise ValueError("Matrícula ou senha inválida.")

            perfil_row = session.execute(
                text(
                    """
                    SELECT p.codigo, o.sigla AS orgao_sigla
                    FROM usuarios_perfis up
                    JOIN perfis p ON p.id = up.perfil_id
                    LEFT JOIN orgaos o ON o.id = up.orgao_id
                    WHERE up.usuario_id = CAST(:uid AS uuid) AND up.ativo = true
                    ORDER BY p.codigo ASC
                    LIMIT 1
                    """
                ),
                {"uid": user["id"]},
            ).mappings().first()

            perfil_cod = perfil_row["codigo"] if perfil_row else "SERVIDOR"
            if perfil_cod not in ("SERVIDOR", "CHEFIA", "SECAP", "MASTER"):
                perfil_cod = "SERVIDOR"

            return {
                "authenticated": True,
                "matricula": user["matricula"],
                "nome": user["nome"],
                "tipo": user["tipo"],
                "perfilPrincipal": perfil_cod,
                "orgaoSigla": (perfil_row["orgao_sigla"] if perfil_row else None) or "SJAM",
            }

    def get_real_rbac_context(self, matricula: str) -> dict[str, Any]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            perfis = session.execute(
                text(
                    """
                    SELECT p.codigo, p.nome, o.sigla AS orgao_sigla
                    FROM usuarios_perfis up
                    JOIN perfis p ON p.id = up.perfil_id
                    LEFT JOIN orgaos o ON o.id = up.orgao_id
                    WHERE up.usuario_id = CAST(:uid AS uuid) AND up.ativo = true
                    """
                ),
                {"uid": srv["usuario_id"]},
            ).mappings().all()

            perfil_principal = perfis[0]["codigo"] if perfis else "SERVIDOR"
            perms = session.execute(
                text(
                    """
                    SELECT DISTINCT pm.codigo
                    FROM perfis p
                    JOIN perfis_permissoes pp ON pp.perfil_id = p.id
                    JOIN permissoes pm ON pm.id = pp.permissao_id
                    WHERE p.codigo = :codigo
                    ORDER BY pm.codigo
                    """
                ),
                {"codigo": perfil_principal},
            ).scalars().all()

            return {
                "servidor": srv,
                "perfisVinculados": [dict(p) for p in perfis],
                "perfilAtivo": perfil_principal,
                "permissoes": list(perms),
            }

    def get_real_dashboard(self, matricula: str) -> dict[str, Any]:
        cache_key = f"secp:prod_real:dashboard:{matricula.upper()}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return cached

        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            reg = self.get_regulamentacao_orgao(srv["orgao_sigla"])
            fuso_srv = srv["fuso_horario"] or "America/Manaus"
            try:
                hoje = datetime.now(ZoneInfo(fuso_srv)).date()
            except Exception:
                hoje = date.today()

            marcacoes_rows = session.execute(
                text(
                    """
                    SELECT m.id::text, m.data_hora, m.tipo::text, m.fonte::text, m.fuso_horario,
                           COALESCE(mb.hash_registro, md5(m.id::text)) AS hash_registro,
                           COALESCE(mb.equipamento_codigo, m.fonte::text) AS equipamento
                    FROM marcacoes m
                    LEFT JOIN marcacoes_brutas mb ON mb.marcacao_id = m.id
                    WHERE m.servidor_id = CAST(:sid AS uuid)
                      AND m.data_referencia = :hoje
                      AND m.status = 'VALIDA'
                    ORDER BY m.data_hora ASC
                    LIMIT 6
                    """
                ),
                {"sid": srv["servidor_id"], "hoje": hoje},
            ).mappings().all()

            marcacoes_hoje = [
                {
                    "id": r["id"],
                    "ordemDia": idx + 1,
                    "horario": r["data_hora"].strftime("%H:%M:%S"),
                    "dataReferencia": hoje.strftime("%d/%m/%Y"),
                    "fusoHorario": r["fuso_horario"] or fuso_srv,
                    "fonte": self._normalizar_fonte(r["fonte"]),
                    "tipoClassificado": r["tipo"],
                    "hashSha256": r["hash_registro"],
                    "equipamentoOuOrigem": r["equipamento"],
                    "imutavel": True,
                }
                for idx, r in enumerate(marcacoes_rows)
            ]

            bh = session.execute(
                text(
                    """
                    SELECT saldo_minutos, creditos_validados_minutos, debitos_validados_minutos,
                           horas_acima_limite_minutos, horas_nao_autorizadas_minutos
                    FROM banco_horas_saldos
                    WHERE servidor_id = CAST(:sid AS uuid)
                    LIMIT 1
                    """
                ),
                {"sid": srv["servidor_id"]},
            ).mappings().first()

            # Estatística do mês mais recente com apuração
            ap_stats = session.execute(
                text(
                    """
                    SELECT EXTRACT(YEAR FROM data_referencia)::int AS ano,
                           EXTRACT(MONTH FROM data_referencia)::int AS mes,
                           COUNT(*) AS total_dias,
                           COUNT(*) FILTER (WHERE resultado IN ('REGULAR', 'CREDITO')) AS dias_regulares
                    FROM apuracoes_diarias
                    WHERE servidor_id = CAST(:sid AS uuid)
                    GROUP BY 1, 2
                    ORDER BY 1 DESC, 2 DESC
                    LIMIT 1
                    """
                ),
                {"sid": srv["servidor_id"]},
            ).mappings().first()

            total_dias = int(ap_stats["total_dias"]) if ap_stats else 20
            dias_reg = int(ap_stats["dias_regulares"]) if ap_stats else 18
            freq_pct = round((dias_reg / max(1, total_dias)) * 100, 1)

            res = {
                "servidor": {
                    "id": srv["servidor_id"],
                    "matricula": srv["matricula"],
                    "nome": srv["nome_funcional"],
                    "orgaoSigla": srv["orgao_sigla"],
                    "orgaoNome": srv["orgao_nome"],
                    "unidadeNome": srv["unidade_nome"],
                    "cargoNome": srv["cargo_nome"],
                    "fusoHorario": srv["fuso_horario"],
                },
                "regulamentacao": reg,
                "marcacoesHoje": marcacoes_hoje,
                "bancoHoras": {
                    "saldoMinutos": int(bh["saldo_minutos"]) if bh else 0,
                    "creditosValidadosMinutos": int(bh["creditos_validados_minutos"]) if bh else 0,
                    "debitosValidadosMinutos": int(bh["debitos_validados_minutos"]) if bh else 0,
                    "horasAcimaLimiteMinutos": int(bh["horas_acima_limite_minutos"]) if bh else 0,
                },
                "frequenciaMes": {
                    "ano": int(ap_stats["ano"]) if ap_stats else 2026,
                    "mes": int(ap_stats["mes"]) if ap_stats else 11,
                    "percentual": freq_pct,
                    "diasRegulares": dias_reg,
                    "totalDias": total_dias,
                },
            }
            self._redis.set_json(cache_key, res, ttl_seconds=30)
            return res

    def registrar_ponto_real(
        self, matricula: str, fonte: str = "FACIAL", observacao: Optional[str] = None
    ) -> dict[str, Any]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            fuso_local = srv["fuso_horario"] or "America/Manaus"
            try:
                agora_tz = datetime.now(ZoneInfo(fuso_local))
            except Exception:
                agora_tz = datetime.now(timezone(timedelta(hours=-4)))
            agora = agora_tz.replace(tzinfo=None)
            hoje = agora.date()

            qtd_hoje = session.execute(
                text(
                    """
                    SELECT count(*) FROM marcacoes
                    WHERE servidor_id = CAST(:sid AS uuid)
                      AND data_referencia = :hoje
                      AND status = 'VALIDA'
                    """
                ),
                {"sid": srv["servidor_id"], "hoje": hoje},
            ).scalar_one()

            if int(qtd_hoje) >= LIMITE_MARCACOES_CONTABILIZADAS_DIA:
                raise ValueError("Limite diário de 6 marcações contabilizadas já atingido.")

            tipo = classificar_tipo_marcacao_por_sequencia(
                int(qtd_hoje), jornada_ininterrupta=True
            )
            if tipo == "SAIDA" and int(qtd_hoje) == 1:
                tipo_db = "SAIDA"
            elif int(qtd_hoje) >= 4:
                tipo_db = "ENTRADA" if int(qtd_hoje) % 2 == 0 else "SAIDA"
            else:
                tipo_db = tipo

            marcacao_id = str(uuid.uuid4())
            bruta_id = str(uuid.uuid4())
            fonte_db = "FACIAL_WEB" if fonte in ("FACIAL", "FACIAL_WEB") else "WEB"
            hash_reg = hashlib.sha256(
                f"{srv['matricula']}|{agora.isoformat()}|{fonte_db}|{tipo_db}".encode("utf-8")
            ).hexdigest()

            session.execute(
                text(
                    """
                    INSERT INTO marcacoes (
                        id, servidor_id, data_hora, data_referencia, fuso_horario,
                        tipo, fonte, status, observacao, criado_em, atualizado_em
                    ) VALUES (
                        CAST(:id AS uuid), CAST(:sid AS uuid), :dh, :dr, :fuso,
                        CAST(:tipo AS "TipoMarcacao"), CAST(:fonte AS "FonteMarcacao"),
                        CAST('VALIDA' AS "StatusMarcacao"), :obs, NOW(), NOW()
                    )
                    """
                ),
                {
                    "id": marcacao_id,
                    "sid": srv["servidor_id"],
                    "dh": agora,
                    "dr": hoje,
                    "fuso": srv["fuso_horario"] or "America/Manaus",
                    "tipo": tipo_db,
                    "fonte": fonte_db,
                    "obs": observacao,
                },
            )

            session.execute(
                text(
                    """
                    INSERT INTO marcacoes_brutas (
                        id, cpf, matricula, data_hora, equipamento_codigo,
                        origem, hash_registro, processada, processada_em,
                        servidor_id, marcacao_id, payload_original, criado_em
                    ) VALUES (
                        CAST(:bid AS uuid), :cpf, :mat, :dh, :equip,
                        CAST(:origem AS "OrigemMarcacaoBruta"), :hash_reg, true, NOW(),
                        CAST(:sid AS uuid), CAST(:mid AS uuid), CAST(:payload AS jsonb), NOW()
                    )
                    """
                ),
                {
                    "bid": bruta_id,
                    "cpf": srv["cpf"],
                    "mat": srv["matricula"],
                    "dh": agora,
                    "equip": "PORTAL-WEB-FACIAL" if fonte == "FACIAL" else "PORTAL-WEB",
                    "origem": "FACIAL" if fonte == "FACIAL" else "WEB",
                    "hash_reg": hash_reg,
                    "sid": srv["servidor_id"],
                    "mid": marcacao_id,
                    "payload": json.dumps({"tipo": tipo_db, "fuso": srv["fuso_horario"]}),
                },
            )
            session.commit()

            self._redis.invalidate_prefix(f"secp:prod_real:dashboard:{matricula.upper()}")
            self._redis.invalidate_prefix(f"secp:prod_real:espelho:{matricula.upper()}")

            return {
                "id": marcacao_id,
                "ordemDia": int(qtd_hoje) + 1,
                "horario": agora.strftime("%H:%M:%S"),
                "dataReferencia": hoje.strftime("%d/%m/%Y"),
                "fusoHorario": fuso_local,
                "fonte": self._normalizar_fonte(fonte_db),
                "tipoClassificado": tipo_db,
                "hashSha256": hash_reg,
                "equipamentoOuOrigem": "Biometria Facial Web" if fonte == "FACIAL" else "Portal Web Institucional",
                "imutavel": True,
            }

    def get_real_espelho_mensal(
        self, matricula: str, ano: int, mes: int
    ) -> dict[str, Any]:
        cache_key = f"secp:prod_real:espelho:{matricula.upper()}:{ano}:{mes}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return cached

        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            ap_rows = session.execute(
                text(
                    """
                    SELECT id::text, data_referencia, carga_prevista_minutos, minutos_trabalhados,
                           minutos_intervalo, minutos_credito, minutos_debito,
                           resultado::text, status::text, observacao
                    FROM apuracoes_diarias
                    WHERE servidor_id = CAST(:sid AS uuid)
                      AND EXTRACT(YEAR FROM data_referencia) = :ano
                      AND EXTRACT(MONTH FROM data_referencia) = :mes
                    ORDER BY data_referencia DESC
                    """
                ),
                {"sid": srv["servidor_id"], "ano": ano, "mes": mes},
            ).mappings().all()

            marc_rows = session.execute(
                text(
                    """
                    SELECT m.id::text, m.data_referencia, m.data_hora, m.tipo::text, m.fonte::text,
                           m.fuso_horario, COALESCE(mb.hash_registro, md5(m.id::text)) AS hash_registro,
                           COALESCE(mb.equipamento_codigo, m.fonte::text) AS equipamento
                    FROM marcacoes m
                    LEFT JOIN marcacoes_brutas mb ON mb.marcacao_id = m.id
                    WHERE m.servidor_id = CAST(:sid AS uuid)
                      AND EXTRACT(YEAR FROM m.data_referencia) = :ano
                      AND EXTRACT(MONTH FROM m.data_referencia) = :mes
                      AND m.status = 'VALIDA'
                    ORDER BY m.data_hora ASC
                    """
                ),
                {"sid": srv["servidor_id"], "ano": ano, "mes": mes},
            ).mappings().all()

            marc_by_day: dict[str, list[dict[str, Any]]] = {}
            for m in marc_rows:
                d_iso = m["data_referencia"].isoformat()
                lst = marc_by_day.setdefault(d_iso, [])
                lst.append(
                    {
                        "id": m["id"],
                        "ordemDia": len(lst) + 1,
                        "horario": m["data_hora"].strftime("%H:%M:%S"),
                        "dataReferencia": d_iso,
                        "fusoHorario": m["fuso_horario"] or srv["fuso_horario"],
                        "fonte": self._normalizar_fonte(m["fonte"]),
                        "tipoClassificado": m["tipo"],
                        "hashSha256": m["hash_registro"],
                        "equipamentoOuOrigem": m["equipamento"],
                        "imutavel": True,
                    }
                )

            dias = []
            total_prev = 0
            total_trab = 0
            total_cred = 0
            total_deb = 0
            inconsistencias = 0

            dias_semana_pt = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"]

            for ap in ap_rows:
                dt: date = ap["data_referencia"]
                d_iso = dt.isoformat()
                prev = int(ap["carga_prevista_minutos"])
                trab = int(ap["minutos_trabalhados"])
                cred = int(ap["minutos_credito"])
                deb = int(ap["minutos_debito"])
                res_raw = ap["resultado"]

                total_prev += prev
                total_trab += trab
                total_cred += cred
                total_deb += deb

                status_ui, status_label = self._map_resultado_ui(res_raw, cred, deb)
                if status_ui in ("INCOMPLETA", "DEBITO"):
                    inconsistencias += 1

                dias.append(
                    {
                        "id": ap["id"],
                        "dataIso": d_iso,
                        "dataFormatada": dt.strftime("%d/%m/%Y"),
                        "diaSemana": dias_semana_pt[dt.weekday()],
                        "diaUtil": dt.weekday() < 5,
                        "cargaPrevistaMinutos": prev,
                        "trabalhadoMinutos": trab,
                        "creditoMinutos": cred,
                        "debitoMinutos": deb,
                        "status": status_ui,
                        "statusLabel": status_label,
                        "marcacoes": marc_by_day.get(d_iso, []),
                        "memoriaCalculo": {
                            "jornadaAplicada": f"{prev // 60}h ({prev} min)",
                            "janelaExpediente": "Portaria SJAM-DIREF 135/2025 (08:00–15:00)",
                            "intervaloExigidoMinutos": 0 if prev <= 420 else 60,
                            "intervaloRealizadoMinutos": int(ap["minutos_intervalo"]),
                            "toleranciaAplicadaMinutos": 0,
                            "regraPortaria": f"Resultado oficial apurado no PostgreSQL: {res_raw}",
                            "observacoes": [ap["observacao"]] if ap["observacao"] else [],
                        },
                    }
                )

            hom = session.execute(
                text(
                    """
                    SELECT h.status::text
                    FROM homologacoes_servidores_meses h
                    JOIN fechamentos_mensais_unidades f ON f.id = h.fechamento_id
                    WHERE h.servidor_id = CAST(:sid AS uuid)
                      AND f.ano_referencia = :ano
                      AND f.mes_referencia = :mes
                    LIMIT 1
                    """
                ),
                {"sid": srv["servidor_id"], "ano": ano, "mes": mes},
            ).scalar_one_or_none()

            status_comp = "HOMOLOGADA" if hom == "HOMOLOGADO" else "ABERTA"

            result = {
                "competencia": f"{mes:02d}/{ano}",
                "competenciaLabel": f"{mes:02d}/{ano}",
                "statusCompetencia": status_comp,
                "ultimaSincronizacaoSarh": "Integrado secp_prod_real",
                "ultimoRecalculo": "Calculado no PostgreSQL",
                "totalPrevistoMinutos": total_prev,
                "totalTrabalhadoMinutos": total_trab,
                "totalCreditoMinutos": total_cred,
                "totalDebitoMinutos": total_deb,
                "bancoComputavelMinutos": max(0, total_cred - total_deb),
                "faltasOuInconsistencias": inconsistencias,
                "dias": dias,
            }
            self._redis.set_json(cache_key, result, ttl_seconds=60)
            return result

    def list_real_solicitacoes(self, matricula: str) -> list[dict[str, Any]]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            rows = session.execute(
                text(
                    """
                    SELECT id::text, tipo::text, status::text, titulo, descricao,
                           data_referencia, criado_em
                    FROM solicitacoes
                    WHERE servidor_id = CAST(:sid AS uuid)
                    ORDER BY criado_em DESC
                    LIMIT 25
                    """
                ),
                {"sid": srv["servidor_id"]},
            ).mappings().all()
            return [
                {
                    "id": r["id"],
                    "tipo": r["tipo"],
                    "status": r["status"],
                    "titulo": r["titulo"] or r["tipo"],
                    "descricao": r["descricao"],
                    "dataReferencia": r["data_referencia"].strftime("%d/%m/%Y") if r["data_referencia"] else "--",
                    "criadoEm": r["criado_em"].strftime("%d/%m/%Y %H:%M"),
                }
                for r in rows
            ]

    def criar_solicitacao_real(
        self,
        matricula: str,
        tipo: str,
        data_referencia: str,
        descricao: str,
        titulo: str | None = None,
    ) -> dict[str, Any]:
        desc_clean = (descricao or "").strip()
        if len(desc_clean) < 10 or len(desc_clean) > 3000:
            raise ValueError(
                "A justificativa/descrição da solicitação deve ter entre 10 e 3000 caracteres."
            )

        tipos_validos = {
            "AJUSTE_PONTO",
            "COMPENSACAO",
            "ABONO_JUSTIFICATIVA",
            "ATIVIDADE_EXTERNA",
            "VIAGEM_SERVICO",
            "CAPACITACAO",
            "DISPENSA_PONTO",
            "HORA_CREDITO_PREVIA",
            "FOLGA_BANCO_HORAS",
            "EXCLUSAO_MARCACAO",
            "CONVERSAO_DIA_ESPECIAL_BANCO_HORAS",
            "CONVERSAO_EXCEDENTE_BANCO_HORAS",
        }
        tipo_map = {
            "AJUSTE_MARCACAO": "AJUSTE_PONTO",
            "ABONO": "ABONO_JUSTIFICATIVA",
            "AUTORIZACAO_CREDITO": "HORA_CREDITO_PREVIA",
            "AUTORIZACAO_PREVIA_CREDITO": "HORA_CREDITO_PREVIA",
        }
        tipo_norm = tipo_map.get(tipo.strip().upper(), tipo.strip().upper())
        if tipo_norm not in tipos_validos:
            tipo_norm = "AJUSTE_PONTO"

        data_ref_obj = date.fromisoformat(data_referencia[:10]) if data_referencia else date.today()
        titulo_clean = (titulo or "").strip() or f"{tipo_norm.replace('_', ' ').title()} ({data_ref_obj.strftime('%d/%m/%Y')})"

        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            unidade_id = session.execute(
                text(
                    """
                    SELECT unidade_id::text
                    FROM lotacoes
                    WHERE servidor_id = CAST(:sid AS uuid) AND status = 'ATIVO'
                    LIMIT 1
                    """
                ),
                {"sid": srv["servidor_id"]},
            ).scalar_one_or_none()

            sol_id = str(uuid.uuid4())
            session.execute(
                text(
                    """
                    INSERT INTO solicitacoes (
                        id, servidor_id, usuario_solicitante_id, unidade_id,
                        tipo, status, titulo, descricao, data_referencia,
                        criado_em, atualizado_em
                    ) VALUES (
                        CAST(:id AS uuid),
                        CAST(:sid AS uuid),
                        CAST(:uid AS uuid),
                        CAST(:unid AS uuid),
                        CAST(:tipo AS "TipoSolicitacao"),
                        CAST('ENVIADA' AS "StatusSolicitacao"),
                        :titulo,
                        :descricao,
                        :data_ref,
                        NOW(),
                        NOW()
                    )
                    """
                ),
                {
                    "id": sol_id,
                    "sid": srv["servidor_id"],
                    "uid": srv["usuario_id"],
                    "unid": unidade_id,
                    "tipo": tipo_norm,
                    "titulo": titulo_clean[:255],
                    "descricao": desc_clean,
                    "data_ref": data_ref_obj,
                },
            )
            session.commit()

            return {
                "id": sol_id,
                "tipo": tipo_norm,
                "status": "ENVIADA",
                "titulo": titulo_clean[:255],
                "descricao": desc_clean,
                "dataReferencia": data_ref_obj.strftime("%d/%m/%Y"),
                "criadoEm": datetime.now().strftime("%d/%m/%Y %H:%M"),
            }

    @staticmethod
    def _normalizar_fonte(fonte_raw: str) -> str:
        f = fonte_raw.upper()
        if "FACIAL" in f or "TOTEM" in f:
            return "FACIAL"
        if "AFD" in f:
            return "AFD"
        if "WEB" in f:
            return "WEB"
        return "REP"

    @staticmethod
    def _map_resultado_ui(resultado: str, cred: int, deb: int) -> tuple[str, str]:
        r = resultado.upper()
        if r in ("FERIAS", "AFASTAMENTO", "FERIADO", "RECESSO_FORENSE", "PONTO_FACULTATIVO", "ABONADA"):
            return ("ABONADA_FERIAS_RECESSO", r.replace("_", " ").title())
        if r in ("INCOMPLETA", "FALTA"):
            return ("INCOMPLETA", "Incompleta / Sem saída" if r == "INCOMPLETA" else "Falta")
        if cred > 0 or r == "CREDITO":
            return ("CREDITO", f"Crédito (+{cred // 60:02d}h{cred % 60:02d})")
        if deb > 0 or r == "DEBITO":
            return ("DEBITO", f"Débito (-{deb // 60:02d}h{deb % 60:02d})")
        return ("REGULAR", "Regular")
