import calendar
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
from secp.modules.secp_cadastros.infrastructure.adapters.outbound.equipamentos_schema_bootstrap import (
    ensure_tipos_equipamento_schema,
)
from secp.modules.secp_ponto.infrastructure.adapters.outbound.biometria_facial_service import (
    cadastrar_biometria_servidor,
    get_biometria_status,
    verificar_biometria_servidor,
)
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    LIMITE_MARCACOES_CONTABILIZADAS_DIA,
    classificar_tipo_marcacao_por_sequencia,
)
from secp.modules.secp_ponto.domain.services.espelho_mensal_engine import (
    AfastamentoSarhInput,
    ApuracaoPersistidaInput,
    EventoCalendarioInput,
    RegraOrgaoMes,
    montar_espelho_mensal_completo,
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

    def get_real_rbac_context(
        self,
        matricula: str,
        orgao: str | None = None,
        perfil: str | None = None,
    ) -> dict[str, Any]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            perfis = session.execute(
                text(
                    """
                    SELECT p.codigo, p.nome, p.descricao, p.excecao,
                           o.id::text AS orgao_id, o.sigla AS orgao_sigla,
                           o.nome AS orgao_nome, o.fuso_horario AS orgao_fuso,
                           o.municipio AS orgao_municipio
                    FROM usuarios_perfis up
                    JOIN perfis p ON p.id = up.perfil_id
                    LEFT JOIN orgaos o ON o.id = up.orgao_id
                    WHERE up.usuario_id = CAST(:uid AS uuid)
                      AND up.ativo = true
                      AND p.ativo = true
                    ORDER BY o.sigla ASC NULLS FIRST, p.codigo ASC
                    """
                ),
                {"uid": srv["usuario_id"]},
            ).mappings().all()

            perfis_operacionais = [
                p for p in perfis
                if not p["excecao"] and not str(p["codigo"]).upper().startswith("EXCECAO_")
            ]
            if not perfis_operacionais:
                perfis_operacionais = list(perfis)

            tem_master_global = any(
                str(p["codigo"]).upper() == "MASTER" and p["orgao_id"] is None
                for p in perfis_operacionais
            )

            orgaos_map: dict[str, dict[str, Any]] = {}
            if tem_master_global:
                all_orgaos = session.execute(
                    text(
                        """
                        SELECT id::text AS id, sigla, nome, fuso_horario, municipio
                        FROM orgaos
                        WHERE ativo = true
                        ORDER BY sigla ASC
                        """
                    )
                ).mappings().all()
                for o in all_orgaos:
                    orgaos_map[o["id"]] = {
                        "id": o["id"],
                        "sigla": o["sigla"],
                        "nome": o["nome"],
                        "unidadeLabel": f"{o['sigla']} • {o['municipio'] or 'Sede'}",
                        "fusoHorario": o["fuso_horario"] or "America/Manaus",
                    }
            else:
                for p in perfis_operacionais:
                    oid = p["orgao_id"]
                    if oid and oid not in orgaos_map:
                        orgaos_map[oid] = {
                            "id": oid,
                            "sigla": p["orgao_sigla"],
                            "nome": p["orgao_nome"],
                            "unidadeLabel": f"{p['orgao_sigla']} • {p['orgao_municipio'] or 'Sede'}",
                            "fusoHorario": p["orgao_fuso"] or "America/Manaus",
                        }
                if srv["orgao_id"] and srv["orgao_id"] not in orgaos_map:
                    org_srv = session.execute(
                        text(
                            "SELECT id::text AS id, sigla, nome, fuso_horario, municipio FROM orgaos WHERE id = CAST(:oid AS uuid)"
                        ),
                        {"oid": srv["orgao_id"]},
                    ).mappings().first()
                    if org_srv:
                        orgaos_map[org_srv["id"]] = {
                            "id": org_srv["id"],
                            "sigla": org_srv["sigla"],
                            "nome": org_srv["nome"],
                            "unidadeLabel": f"{org_srv['sigla']} • {org_srv['municipio'] or 'Sede'}",
                            "fusoHorario": org_srv["fuso_horario"] or "America/Manaus",
                        }

            orgaos_acessiveis = list(orgaos_map.values())

            # Determina órgão ativo dentro dos órgãos acessíveis
            org_req = (orgao if isinstance(orgao, str) else "").strip().upper()
            orgao_ativo = None
            if org_req:
                orgao_ativo = next(
                    (
                        o
                        for o in orgaos_acessiveis
                        if o["id"].upper() == org_req or str(o["sigla"]).upper() == org_req
                    ),
                    None,
                )
            if orgao_ativo is None:
                orgao_ativo = next(
                    (o for o in orgaos_acessiveis if o["id"] == srv["orgao_id"]),
                    orgaos_acessiveis[0] if orgaos_acessiveis else None,
                )

            # Perfis disponíveis especificamente para o órgão selecionado
            perfis_no_orgao_map: dict[str, dict[str, Any]] = {}
            if orgao_ativo:
                for p in perfis_operacionais:
                    if p["orgao_id"] == orgao_ativo["id"] or p["orgao_id"] is None:
                        cod = str(p["codigo"]).upper()
                        if cod not in perfis_no_orgao_map:
                            perfis_no_orgao_map[cod] = {
                                "codigo": cod,
                                "nome": p["nome"],
                                "descricao": p["descricao"] or p["nome"],
                            }

            if not perfis_no_orgao_map:
                perfis_no_orgao_map["SERVIDOR"] = {
                    "codigo": "SERVIDOR",
                    "nome": "Servidor",
                    "descricao": "Consulta própria de frequência e espelho.",
                }

            perfis_disponiveis = list(perfis_no_orgao_map.values())
            pref_req = (perfil if isinstance(perfil, str) else "").strip().upper()
            if pref_req and pref_req in perfis_no_orgao_map:
                perfil_principal = pref_req
            else:
                perfil_principal = perfis_disponiveis[0]["codigo"]

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
                "orgaosAcessiveis": orgaos_acessiveis,
                "orgaoAtivo": orgao_ativo,
                "perfisDisponiveisNoOrgao": perfis_disponiveis,
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
            ensure_tipos_equipamento_schema(session)
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
                           COALESCE(eb.nome, mb.equipamento_codigo, m.fonte::text) AS equipamento,
                           mb.origem::text AS origem_bruta,
                           teb.icone AS tipo_equipamento_icone,
                           teb.nome AS tipo_equipamento_nome
                    FROM marcacoes m
                    LEFT JOIN marcacoes_brutas mb ON mb.marcacao_id = m.id
                    LEFT JOIN equipamentos_biometricos_eventos ebe ON ebe.marcacao_id = m.id
                    LEFT JOIN equipamentos_biometricos eb ON eb.id = ebe.equipamento_id OR eb.codigo = mb.equipamento_codigo
                    LEFT JOIN tipos_equipamento_biometrico teb ON teb.id = eb.tipo_equipamento_id
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
                    "origemIcone": self._resolver_icone_origem(
                        r["tipo_equipamento_icone"],
                        r["fonte"],
                        r["origem_bruta"],
                        r["equipamento"],
                        r["tipo"],
                    ),
                    "tipoEquipamentoNome": r["tipo_equipamento_nome"],
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

            ultima_marcacao = session.execute(
                text(
                    """
                    SELECT data_hora FROM marcacoes
                    WHERE servidor_id = CAST(:sid AS uuid)
                      AND data_referencia = :hoje
                      AND status = 'VALIDA'
                    ORDER BY data_hora DESC
                    LIMIT 1
                    """
                ),
                {"sid": srv["servidor_id"], "hoje": hoje},
            ).scalar_one_or_none()

            if ultima_marcacao is not None:
                ultima_naive = ultima_marcacao.replace(tzinfo=None) if getattr(ultima_marcacao, "tzinfo", None) else ultima_marcacao
                diff_sec = (agora - ultima_naive).total_seconds()
                if diff_sec < 300:
                    raise ValueError(
                        f"Batida duplicada bloqueada pela RN-03: aguarde 5 minutos entre registros (decorridos {max(0, int(diff_sec))}s)."
                    )

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
            is_facial = fonte in ("FACIAL", "FACIAL_WEB", "BIOMETRIA_FACIAL")
            fonte_db = "BIOMETRIA_FACIAL" if is_facial else "WEB"
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
                    "equip": "PORTAL-WEB-FACIAL" if is_facial else "PORTAL-WEB",
                    "origem": "FACIAL_AUTORIZADO" if is_facial else "WEB_AUTORIZADO",
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
                "origemIcone": "facial" if fonte == "FACIAL" else "computador",
                "imutavel": True,
            }

    def get_real_espelho_mensal(
        self, matricula: str, ano: int, mes: int
    ) -> dict[str, Any]:
        cache_key = f"secp:prod_real:espelho:v4:{matricula.upper()}:{ano}:{mes}"
        cached = self._redis.get_json(cache_key)
        if isinstance(cached, dict):
            return cached

        with ProdRealSyncSessionLocal() as session:
            ensure_tipos_equipamento_schema(session)
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
                           COALESCE(eb.nome, mb.equipamento_codigo, m.fonte::text) AS equipamento,
                           eb.localizacao AS equipamento_localizacao,
                           mb.origem::text AS origem_bruta,
                           teb.icone AS tipo_equipamento_icone,
                           teb.nome AS tipo_equipamento_nome
                    FROM marcacoes m
                    LEFT JOIN marcacoes_brutas mb ON mb.marcacao_id = m.id
                    LEFT JOIN equipamentos_biometricos_eventos ebe ON ebe.marcacao_id = m.id
                    LEFT JOIN equipamentos_biometricos eb ON eb.id = ebe.equipamento_id OR eb.codigo = mb.equipamento_codigo
                    LEFT JOIN tipos_equipamento_biometrico teb ON teb.id = eb.tipo_equipamento_id
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
                fonte_norm = self._normalizar_fonte(m["fonte"])
                loc_default = (
                    "Biometria Facial Web"
                    if fonte_norm == "FACIAL"
                    else "Portal Web Institucional"
                    if fonte_norm == "WEB"
                    else "Unidade Judiciária"
                )
                lst.append(
                    {
                        "id": m["id"],
                        "ordemDia": len(lst) + 1,
                        "horario": m["data_hora"].strftime("%H:%M:%S"),
                        "dataReferencia": d_iso,
                        "fusoHorario": m["fuso_horario"] or srv["fuso_horario"],
                        "fonte": fonte_norm,
                        "tipoClassificado": m["tipo"],
                        "hashSha256": m["hash_registro"],
                        "equipamentoOuOrigem": m["equipamento"],
                        "localizacao": m["equipamento_localizacao"] or loc_default,
                        "origemIcone": self._resolver_icone_origem(
                            m["tipo_equipamento_icone"],
                            m["fonte"],
                            m["origem_bruta"],
                            m["equipamento"],
                            m["tipo"],
                        ),
                        "tipoEquipamentoNome": m["tipo_equipamento_nome"],
                        "imutavel": True,
                    }
                )

            ap_by_day = {
                ap["data_referencia"].isoformat(): ApuracaoPersistidaInput(
                    id=ap["id"],
                    data_iso=ap["data_referencia"].isoformat(),
                    carga_prevista_minutos=int(ap["carga_prevista_minutos"]),
                    minutos_trabalhados=int(ap["minutos_trabalhados"]),
                    minutos_intervalo=int(ap["minutos_intervalo"]),
                    minutos_credito=int(ap["minutos_credito"]),
                    minutos_debito=int(ap["minutos_debito"]),
                    resultado=ap["resultado"],
                    status=ap["status"],
                    observacao=ap["observacao"],
                )
                for ap in ap_rows
            }

            cal_rows = session.execute(
                text(
                    """
                    SELECT data_referencia, tipo::text, descricao
                    FROM calendarios_institucionais
                    WHERE ativo = true
                      AND EXTRACT(YEAR FROM data_referencia) = :ano
                      AND EXTRACT(MONTH FROM data_referencia) = :mes
                      AND (orgao_id IS NULL OR orgao_id = CAST(:oid AS uuid))
                    """
                ),
                {"ano": ano, "mes": mes, "oid": srv["orgao_id"]},
            ).mappings().all()
            cal_by_day = {
                c["data_referencia"].isoformat(): EventoCalendarioInput(
                    data_iso=c["data_referencia"].isoformat(),
                    tipo=c["tipo"],
                    descricao=c["descricao"],
                )
                for c in cal_rows
            }

            afast_rows = session.execute(
                text(
                    """
                    SELECT data_inicio, data_fim, categoria::text,
                           CASE WHEN ativo THEN 'GOZADA' ELSE 'CANCELADA' END AS situacao,
                           tipo_descricao
                    FROM afastamentos_sarh
                    WHERE servidor_id = CAST(:sid AS uuid)
                      AND ativo = true
                      AND data_inicio <= MAKE_DATE(:ano, :mes, 28) + INTERVAL '4 days'
                      AND COALESCE(data_fim, data_inicio) >= MAKE_DATE(:ano, :mes, 1)
                    """
                ),
                {"sid": srv["servidor_id"], "ano": ano, "mes": mes},
            ).mappings().all()
            afast_inputs = [
                AfastamentoSarhInput(
                    data_inicio=a["data_inicio"],
                    data_fim=a["data_fim"] or a["data_inicio"],
                    categoria=a["categoria"] or "AFASTAMENTO",
                    situacao=a["situacao"] or "ATIVA",
                    descricao=a["tipo_descricao"] or "Afastamento SARH",
                )
                for a in afast_rows
            ]

            sol_rows = session.execute(
                text(
                    """
                    SELECT id::text, tipo::text, status::text, titulo, descricao, data_referencia, criado_em
                    FROM solicitacoes
                    WHERE servidor_id = CAST(:sid AS uuid)
                      AND (
                        (EXTRACT(YEAR FROM data_referencia) = :ano AND EXTRACT(MONTH FROM data_referencia) = :mes)
                        OR (EXTRACT(YEAR FROM criado_em) = :ano AND EXTRACT(MONTH FROM criado_em) = :mes)
                      )
                    ORDER BY criado_em DESC
                    LIMIT 50
                    """
                ),
                {"sid": srv["servidor_id"], "ano": ano, "mes": mes},
            ).mappings().all()
            sol_list = [
                {
                    "id": s_row["id"],
                    "dataSolicitacao": s_row["criado_em"].strftime("%d/%m/%Y %H:%M") if s_row["criado_em"] else "-",
                    "periodo": s_row["data_referencia"].strftime("%d/%m/%Y") if s_row["data_referencia"] else "-",
                    "tipoAjuste": s_row["titulo"] or s_row["tipo"],
                    "dataAfetada": s_row["data_referencia"].strftime("%d/%m/%Y") if s_row["data_referencia"] else "-",
                    "status": "APROVADO" if s_row["status"] in ("DEFERIDA", "APROVADA", "HOMOLOGADA") else ("REPROVADO" if s_row["status"] in ("INDEFERIDA", "REPROVADA") else ("CANCELADO" if s_row["status"] == "CANCELADA" else "EM_ANALISE")),
                    "statusLabel": s_row["status"].replace("_", " ").title(),
                    "aprovadoPor": "-",
                    "justificativa": s_row["descricao"] or "-",
                }
                for s_row in sol_rows
            ]

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

            status_comp = "HOMOLOGADA" if hom == "HOMOLOGADO" else ("ENVIADA_HOMOLOGACAO" if hom == "ENVIADO" else "ABERTA")
            status_comp_lbl = "Homologado" if hom == "HOMOLOGADO" else ("Enviado para homologação" if hom == "ENVIADO" else "Em andamento")

            result = montar_espelho_mensal_completo(
                ano=ano,
                mes=mes,
                hoje_referencia=date.today(),
                regra=RegraOrgaoMes(),
                marc_by_day=marc_by_day,
                ap_by_day=ap_by_day,
                calendario_by_day=cal_by_day,
                afastamentos=afast_inputs,
                solicitacoes_mes=sol_list,
                status_competencia=status_comp,
                status_competencia_label=status_comp_lbl,
                unidade_label=srv.get("unidade_nome") or srv.get("orgao_sigla", ""),
            )
            self._redis.set_json(cache_key, result, ttl_seconds=60)
            return result

    def recalcular_espelho_real(self, matricula: str, ano: int, mes: int) -> dict[str, Any]:
        self._redis.invalidate_prefix(f"secp:prod_real:espelho:v4:{matricula.upper()}:{ano}:{mes}")
        self._redis.invalidate_prefix(f"secp:prod_real:dashboard:{matricula.upper()}")
        return self.get_real_espelho_mensal(matricula=matricula, ano=ano, mes=mes)

    def enviar_homologacao_real(
        self,
        *,
        matricula: str,
        ano: int,
        mes: int,
        cargo_funcao: str = "",
        senha: str = "",
    ) -> dict[str, Any]:
        if not senha.strip():
            raise ValueError("Informe a senha de assinatura para enviar para homologação.")
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            user_row = session.execute(
                text("SELECT senha_hash FROM usuarios WHERE UPPER(matricula) = :m LIMIT 1"),
                {"m": matricula.strip().upper()},
            ).mappings().first()
            if user_row and user_row.get("senha_hash"):
                ok = bcrypt.checkpw(senha.encode("utf-8"), str(user_row["senha_hash"]).encode("utf-8"))
                if not ok:
                    raise PermissionError("Senha de assinatura inválida.")
        self._redis.invalidate_prefix(f"secp:prod_real:espelho:v4:{matricula.upper()}:{ano}:{mes}")
        return {
            "enviado": True,
            "competencia": f"{mes:02d}/{ano}",
            "assinante": srv["nome_funcional"],
            "matricula": srv["matricula"],
            "cargoFuncao": cargo_funcao or "Servidor",
            "enviadoEm": datetime.now().strftime("%d/%m/%Y %H:%M"),
            "statusCompetencia": "ENVIADA_HOMOLOGACAO",
            "statusCompetenciaLabel": "Enviado para homologação",
        }

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

    def get_chefia_escopo(self, matricula: str) -> dict[str, Any]:
        """Retorna todas as unidades geridas (e subordinadas recursivamente) e seus servidores."""
        mat_clean = (matricula or "").strip().upper()
        if not mat_clean:
            raise ValueError("Matrícula da chefia é obrigatória.")

        with ProdRealSyncSessionLocal() as session:
            gestor = session.execute(
                text(
                    """
                    SELECT id::text AS id, matricula, nome_funcional
                    FROM servidores
                    WHERE UPPER(matricula) = :mat
                    LIMIT 1
                    """
                ),
                {"mat": mat_clean},
            ).mappings().first()

            if gestor is None:
                return {
                    "gestorMatricula": mat_clean,
                    "gestorNome": mat_clean,
                    "unidades": [],
                    "subordinados": [],
                    "solicitacoesEquipe": [],
                }

            unidades_rows = session.execute(
                text(
                    """
                    WITH RECURSIVE arvore_unidades AS (
                        SELECT
                            u.id,
                            u.sigla,
                            u.nome,
                            u.tipo::text AS tipo,
                            u.unidade_pai_id,
                            0 AS nivel,
                            g.papel::text AS papel_gestor
                        FROM gestores_unidades g
                        JOIN unidades_organizacionais u ON u.id = g.unidade_id
                        WHERE g.servidor_id = CAST(:sid AS uuid)
                          AND g.ativo = true
                          AND (g.data_fim IS NULL OR g.data_fim >= CURRENT_DATE)
                          AND u.ativo = true

                        UNION ALL

                        SELECT
                            filha.id,
                            filha.sigla,
                            filha.nome,
                            filha.tipo::text AS tipo,
                            filha.unidade_pai_id,
                            pai.nivel + 1 AS nivel,
                            'SUBORDINADA'::text AS papel_gestor
                        FROM unidades_organizacionais filha
                        JOIN arvore_unidades pai ON filha.unidade_pai_id = pai.id
                        WHERE filha.ativo = true
                          AND pai.nivel < 12
                    )
                    SELECT DISTINCT ON (id)
                        id::text AS id,
                        sigla,
                        nome,
                        tipo,
                        unidade_pai_id::text AS unidade_pai_id,
                        nivel,
                        papel_gestor
                    FROM arvore_unidades
                    ORDER BY id, nivel ASC
                    """
                ),
                {"sid": gestor["id"]},
            ).mappings().all()

            unidades_sorted = sorted(
                [dict(r) for r in unidades_rows],
                key=lambda x: (x["nivel"], x["sigla"] or "", x["nome"] or ""),
            )

            unidade_ids = [u["id"] for u in unidades_sorted]
            subordinados_list: list[dict[str, Any]] = []
            solicitacoes_equipe: list[dict[str, Any]] = []

            if unidade_ids:
                subs_rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (s.id)
                            s.id::text AS id,
                            s.matricula,
                            COALESCE(s.nome_funcional, s.nome_completo_sarh, s.matricula) AS nome_funcional,
                            COALESCE(us.email, '') AS email_institucional,
                            COALESCE(s.descricao_situacao_sarh, CASE WHEN s.ativo THEN 'ATIVO' ELSE 'INATIVO' END) AS situacao,
                            u.id::text AS unidade_id,
                            u.sigla AS unidade_sigla,
                            u.nome AS unidade_nome,
                            c.descricao AS cargo_nome
                        FROM lotacoes l
                        JOIN servidores s ON s.id = l.servidor_id
                        LEFT JOIN usuarios us ON us.id = s.usuario_id
                        JOIN unidades_organizacionais u ON u.id = l.unidade_id
                        LEFT JOIN cargos c ON c.id = l.cargo_id
                        WHERE l.unidade_id = ANY(CAST(:uids AS uuid[]))
                          AND l.status::text = 'ATIVO'
                          AND (l.data_fim IS NULL OR l.data_fim >= CURRENT_DATE)
                        ORDER BY s.id, l.data_inicio DESC
                        """
                    ),
                    {"uids": unidade_ids},
                ).mappings().all()

                subordinados_list = sorted(
                    [
                        {
                            "id": r["id"],
                            "matricula": r["matricula"],
                            "nomeFuncional": r["nome_funcional"],
                            "email": r["email_institucional"] or "",
                            "situacao": r["situacao"],
                            "unidadeId": r["unidade_id"],
                            "unidadeSigla": r["unidade_sigla"] or "",
                            "unidadeNome": r["unidade_nome"] or "",
                            "cargoNome": r["cargo_nome"] or "Servidor",
                        }
                        for r in subs_rows
                    ],
                    key=lambda x: (x["unidadeSigla"], x["nomeFuncional"]),
                )

                sub_ids = [s["id"] for s in subordinados_list]
                if sub_ids:
                    sol_rows = session.execute(
                        text(
                            """
                            SELECT
                                sa.id::text AS id,
                                s.matricula,
                                s.nome_funcional,
                                sa.tipo::text AS tipo,
                                sa.status::text AS status,
                                sa.titulo,
                                sa.data_referencia,
                                sa.criado_em
                            FROM solicitacoes_ajuste sa
                            JOIN servidores s ON s.id = sa.servidor_id
                            WHERE sa.servidor_id = ANY(CAST(:sids AS uuid[]))
                            ORDER BY sa.criado_em DESC
                            LIMIT 50
                            """
                        ),
                        {"sids": sub_ids},
                    ).mappings().all()

                    solicitacoes_equipe = [
                        {
                            "id": r["id"],
                            "matricula": r["matricula"],
                            "servidorNome": r["nome_funcional"],
                            "tipo": r["tipo"],
                            "status": r["status"],
                            "titulo": r["titulo"],
                            "dataReferencia": (
                                r["data_referencia"].strftime("%d/%m/%Y")
                                if r["data_referencia"]
                                else ""
                            ),
                            "criadoEm": (
                                r["criado_em"].strftime("%d/%m/%Y %H:%M")
                                if r["criado_em"]
                                else ""
                            ),
                        }
                        for r in sol_rows
                    ]

            return {
                "gestorMatricula": gestor["matricula"],
                "gestorNome": gestor["nome_funcional"],
                "unidades": unidades_sorted,
                "subordinados": subordinados_list,
                "solicitacoesEquipe": solicitacoes_equipe,
            }

    def get_ferias_equipe(
        self,
        matricula: str,
        perfil: str = "CHEFIA",
        orgao_sigla: str = "SJAM",
        ano: int = 2026,
        servidor_matricula: str = "",
    ) -> dict[str, Any]:
        """Retorna programação de férias da equipe conforme o escopo RBAC (Chefia/Admin/Master)."""
        mat_clean = (matricula or "").strip().upper()
        perfil_clean = (perfil or "CHEFIA").strip().upper()
        orgao_clean = (orgao_sigla or "SJAM").strip().upper()
        filtro_serv = (servidor_matricula or "").strip().upper()

        with ProdRealSyncSessionLocal() as session:
            # 1. Determina servidores no escopo conforme perfil administrativo
            servidores_rows: list[Any] = []
            if perfil_clean == "MASTER":
                servidores_rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (s.id)
                            s.id::text AS id,
                            s.matricula,
                            COALESCE(s.nome_funcional, s.nome_completo_sarh, s.matricula) AS nome_funcional,
                            COALESCE(u.sigla, '') AS unidade_sigla,
                            COALESCE(u.nome, '') AS unidade_nome
                        FROM servidores s
                        LEFT JOIN lotacoes l ON l.servidor_id = s.id AND l.status = 'ATIVA'
                        LEFT JOIN unidades_organizacionais u ON u.id = l.unidade_id
                        WHERE s.ativo = true
                        ORDER BY s.id, l.data_inicio DESC NULLS LAST
                        LIMIT 400
                        """
                    )
                ).mappings().all()
            elif perfil_clean == "SECAP":
                servidores_rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (s.id)
                            s.id::text AS id,
                            s.matricula,
                            COALESCE(s.nome_funcional, s.nome_completo_sarh, s.matricula) AS nome_funcional,
                            COALESCE(u.sigla, '') AS unidade_sigla,
                            COALESCE(u.nome, '') AS unidade_nome
                        FROM servidores s
                        JOIN orgaos o ON o.id = s.orgao_id
                        LEFT JOIN lotacoes l ON l.servidor_id = s.id AND l.status = 'ATIVA'
                        LEFT JOIN unidades_organizacionais u ON u.id = l.unidade_id
                        WHERE UPPER(o.sigla) = :orgao
                          AND s.ativo = true
                        ORDER BY s.id, l.data_inicio DESC NULLS LAST
                        LIMIT 400
                        """
                    ),
                    {"orgao": orgao_clean},
                ).mappings().all()
            elif perfil_clean == "CHEFIA":
                escopo = self.get_chefia_escopo(mat_clean)
                servidores_rows = [
                    {
                        "id": s["id"],
                        "matricula": s["matricula"],
                        "nome_funcional": s["nomeFuncional"],
                        "unidade_sigla": s["unidadeSigla"],
                        "unidade_nome": s["unidadeNome"],
                    }
                    for s in escopo.get("subordinados", [])
                ]
            else:
                servidores_rows = session.execute(
                    text(
                        """
                        SELECT DISTINCT ON (s.id)
                            s.id::text AS id,
                            s.matricula,
                            COALESCE(s.nome_funcional, s.nome_completo_sarh, s.matricula) AS nome_funcional,
                            COALESCE(u.sigla, '') AS unidade_sigla,
                            COALESCE(u.nome, '') AS unidade_nome
                        FROM servidores s
                        LEFT JOIN lotacoes l ON l.servidor_id = s.id AND l.status = 'ATIVA'
                        LEFT JOIN unidades_organizacionais u ON u.id = l.unidade_id
                        WHERE UPPER(s.matricula) = :mat
                        ORDER BY s.id, l.data_inicio DESC NULLS LAST
                        """
                    ),
                    {"mat": mat_clean},
                ).mappings().all()

            serv_map = {r["id"]: dict(r) for r in servidores_rows}
            serv_ids = list(serv_map.keys())
            if filtro_serv:
                target_ids = [
                    sid for sid, info in serv_map.items()
                    if info["matricula"].upper() == filtro_serv
                ]
            else:
                target_ids = serv_ids

            periodos: list[dict[str, Any]] = []
            ultima_sync = datetime.now().strftime("%d/%m/%Y, %H:%M")

            if target_ids:
                afast_rows = session.execute(
                    text(
                        """
                        SELECT
                            a.id::text AS id,
                            a.servidor_id::text AS servidor_id,
                            a.data_inicio,
                            a.data_fim,
                            a.dias,
                            a.exercicio,
                            a.ativo,
                            a.tipo_descricao,
                            a.ultima_sincronizacao_sarh
                        FROM afastamentos_sarh a
                        WHERE a.servidor_id = ANY(CAST(:sids AS uuid[]))
                          AND a.categoria = 'FERIAS'
                          AND (
                            EXTRACT(YEAR FROM a.data_inicio) = :ano
                            OR EXTRACT(YEAR FROM a.data_fim) = :ano
                          )
                        ORDER BY a.data_inicio ASC
                        LIMIT 500
                        """
                    ),
                    {"sids": target_ids, "ano": ano},
                ).mappings().all()

                hoje = date.today()
                for r in afast_rows:
                    s_info = serv_map.get(r["servidor_id"], {})
                    dt_ini: date = r["data_inicio"]
                    dt_fim: date = r["data_fim"] or dt_ini
                    if not r["ativo"]:
                        status_cod = "INATIVA"
                        status_lbl = "Inativa"
                    elif dt_fim < hoje:
                        status_cod = "GOZADA"
                        status_lbl = "Gozada"
                    else:
                        status_cod = "PROGRAMADA"
                        status_lbl = "Programada"

                    mes_ref = dt_ini.month if dt_ini.year == ano else 1
                    dias_calc = r["dias"] or ((dt_fim - dt_ini).days + 1)
                    if r["ultima_sincronizacao_sarh"]:
                        ultima_sync = r["ultima_sincronizacao_sarh"].strftime("%d/%m/%Y, %H:%M")

                    periodos.append(
                        {
                            "id": r["id"],
                            "matricula": s_info.get("matricula", ""),
                            "servidorNome": s_info.get("nome_funcional", ""),
                            "unidadeSigla": s_info.get("unidade_sigla", ""),
                            "unidadeNome": s_info.get("unidade_nome", ""),
                            "dataInicioIso": dt_ini.isoformat(),
                            "dataFimIso": dt_fim.isoformat(),
                            "dataInicioBr": dt_ini.strftime("%d/%m"),
                            "dataFimBr": dt_fim.strftime("%d/%m"),
                            "mes": mes_ref,
                            "dias": int(dias_calc),
                            "exercicio": r["exercicio"] or str(ano - 1),
                            "status": status_cod,
                            "statusLabel": status_lbl,
                        }
                    )

            servidores_escopo = sorted(
                [
                    {
                        "matricula": v["matricula"],
                        "nomeFuncional": v["nome_funcional"],
                        "unidadeSigla": v["unidade_sigla"],
                        "unidadeNome": v["unidade_nome"],
                    }
                    for v in serv_map.values()
                ],
                key=lambda x: x["nomeFuncional"],
            )

            return {
                "ano": ano,
                "perfil": perfil_clean,
                "ultimaSincronizacao": ultima_sync,
                "servidoresEscopo": servidores_escopo,
                "periodos": periodos,
            }

    def get_biometria_facial_status(self, matricula: str) -> dict[str, Any]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            return get_biometria_status(session, srv["servidor_id"])

    def cadastrar_biometria_facial(
        self,
        *,
        matricula: str,
        embeddings: list[list[float]],
        prova_vida_tipo: str,
        prova_vida_aprovada: bool,
        frames_analisados: int,
        foto_referencia_base64: str | None = None,
    ) -> dict[str, Any]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            return cadastrar_biometria_servidor(
                session,
                servidor_id=srv["servidor_id"],
                embeddings=embeddings,
                prova_vida_tipo=prova_vida_tipo,
                prova_vida_aprovada=prova_vida_aprovada,
                frames_analisados=frames_analisados,
                foto_referencia_base64=foto_referencia_base64,
            )

    def registrar_ponto_facial_verificado(
        self,
        *,
        matricula: str,
        embedding: list[float],
        prova_vida_tipo: str,
        prova_vida_aprovada: bool,
        frames_analisados: int,
        observacao: str = "",
    ) -> dict[str, Any]:
        with ProdRealSyncSessionLocal() as session:
            srv = self._resolve_servidor(session, matricula)
            verificacao = verificar_biometria_servidor(
                session,
                servidor_id=srv["servidor_id"],
                embedding=embedding,
                prova_vida_tipo=prova_vida_tipo,
                prova_vida_aprovada=prova_vida_aprovada,
                frames_analisados=frames_analisados,
            )

        obs_final = (
            f"{observacao.strip()} | Biometria Facial ({verificacao['confiancaPct']:.1f}%, prova de vida: {prova_vida_tipo})"
            if observacao.strip()
            else f"Biometria Facial ({verificacao['confiancaPct']:.1f}%, prova de vida: {prova_vida_tipo})"
        )
        marcacao = self.registrar_ponto_real(
            matricula=matricula,
            fonte="FACIAL",
            observacao=obs_final,
        )
        return {
            "marcacao": marcacao,
            "verificacao": verificacao,
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
    def _resolver_icone_origem(
        tipo_equip_icone: str | None,
        fonte_raw: str | None,
        origem_bruta: str | None,
        equipamento: str | None,
        tipo_classificado: str | None,
    ) -> str:
        valid_icons = {"facial", "relogio", "computador", "celular", "ajuste", "afd"}
        if tipo_equip_icone:
            norm = tipo_equip_icone.strip().lower()
            if norm in valid_icons:
                return norm

        combined = " ".join(
            part.upper()
            for part in (fonte_raw, origem_bruta, equipamento, tipo_classificado)
            if part
        )
        if (tipo_classificado or "").upper() == "MANUAL" or any(
            k in combined for k in ("AJUSTE", "MANUAL", "ADMIN")
        ):
            return "ajuste"
        if any(k in combined for k in ("SMARTPHONE", "MOBILE", "CELULAR", "ANDROID", "IOS", "APP")):
            return "celular"
        if any(k in combined for k in ("FACIAL", "FACE", "TOTEM", "IDFACE", "CONTROLID")):
            return "facial"
        if any(k in combined for k in ("WEB", "PORTAL", "NAVEGADOR", "BROWSER")):
            return "computador"
        if "AFD" in combined:
            return "afd"
        return "relogio"

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
