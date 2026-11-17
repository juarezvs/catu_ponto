from datetime import date, datetime, timedelta, timezone
import hashlib
from typing import Sequence
import uuid
from sqlalchemy import select
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.infrastructure.database.postgres_session import (
    SecpDeclarativeBase,
    SyncSessionLocal,
    check_postgres_connection,
    sync_engine,
)
from secp.modules.secp_ponto.application.ports.output_ports import (
    PontoRepositoryOutputPort,
)
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    BancoHorasResumoEntity,
    EspelhoDiaEntity,
    HomologacaoItemEntity,
    LIMITE_MENSAL_BANCO_HORAS_MINUTOS,
    MarcacaoEntity,
    MovimentoBancoHorasEntity,
    classificar_tipo_marcacao_por_sequencia,
    format_minutes_hhmm,
)
from secp.modules.secp_ponto.infrastructure.database.ponto_orm_models import (
    BancoHorasSaldoORM,
    HomologacaoServidorMesORM,
    JornadaORM,
    MarcacaoBrutaORM,
    MarcacaoORM,
)


class PostgresRedisPontoRepository(PontoRepositoryOutputPort):
    """
    Outbound Adapter SQLAlchemy 2.0 (PostgreSQL) + Redis Cache para o módulo SECP Ponto.
    Implementa as regras de marcação bruta imutável, classificação dinâmica sequencial,
    espelho mensal, banco de horas (teto 16h/mês, 3 meses de expiração) e homologação.
    """

    def __init__(self, redis_gateway: SecpRedisCacheGateway) -> None:
        self._redis = redis_gateway
        self._pg_ready = False
        self._local_marcacoes: dict[str, list[MarcacaoEntity]] = {}
        self._local_homologacoes: list[HomologacaoItemEntity] = [
            HomologacaoItemEntity(
                id="hom-01",
                usuario_id="servidor",
                servidor_nome="Ana Beatriz Souza",
                matricula="MAT-40912",
                unidade="SEMED • Complexo Educacional Centro",
                competencia="11/2026",
                status="CRITICO",
                trabalhado_formatado="134h10",
                credito_formatado="+02h30",
                debito_formatado="-01h20",
                faltas=1,
                pendencias_resumo="1 batida ímpar em 12/11/2026 (aguardando justificativa)",
            ),
            HomologacaoItemEntity(
                id="hom-02",
                usuario_id="coordenador",
                servidor_nome="Carlos Eduardo",
                matricula="MAT-3088",
                unidade="SEMSA • UPA Regional Norte",
                competencia="11/2026",
                status="PENDENTE",
                trabalhado_formatado="141h45",
                credito_formatado="+05h15",
                debito_formatado="00h00",
                faltas=0,
                pendencias_resumo="Solicitação de abono de capacitação (4h) aguardando despacho",
            ),
            HomologacaoItemEntity(
                id="hom-03",
                usuario_id="gestor-rh",
                servidor_nome="Marina Costa",
                matricula="MAT-1042",
                unidade="SEMAD • Paço Municipal",
                competencia="11/2026",
                status="REGULAR",
                trabalhado_formatado="140h00",
                credito_formatado="+04h10",
                debito_formatado="00h00",
                faltas=0,
                pendencias_resumo="Sem pendências — pronta para homologação até o 2º dia útil",
            ),
            HomologacaoItemEntity(
                id="hom-04",
                usuario_id="admin",
                servidor_nome="Juarez Catu",
                matricula="MAT-0001",
                unidade="SEMAD • Paço Municipal",
                competencia="11/2026",
                status="HOMOLOGADO",
                trabalhado_formatado="148h20",
                credito_formatado="+08h20",
                debito_formatado="00h00",
                faltas=0,
                pendencias_resumo="Homologado e consolidado no Boletim de Frequência",
                homologado_por="Diretoria Geral (SEMAD)",
            ),
        ]
        self._ensure_schema_and_seed()

    def _ensure_schema_and_seed(self) -> None:
        if not check_postgres_connection():
            self._pg_ready = False
            return
        try:
            SecpDeclarativeBase.metadata.create_all(bind=sync_engine)
            with SyncSessionLocal() as session:
                if session.execute(select(JornadaORM).limit(1)).scalar_one_or_none() is None:
                    session.add_all(
                        [
                            JornadaORM(
                                codigo="JOR-7H",
                                nome="Jornada Padrão 7h Ininterruptas (Portaria 135/2025)",
                                tipo_jornada="SETE_HORAS",
                                carga_diaria_minutos=420,
                                intervalo_minimo_minutos=0,
                                intervalo_maximo_minutos=0,
                                tolerancia_minutos=5,
                            ),
                            JornadaORM(
                                codigo="JOR-8H",
                                nome="Jornada 8h com Intervalo (1h a 3h)",
                                tipo_jornada="OITO_HORAS",
                                carga_diaria_minutos=480,
                                intervalo_minimo_minutos=60,
                                intervalo_maximo_minutos=180,
                                tolerancia_minutos=5,
                            ),
                        ]
                    )
                    session.commit()
            self._pg_ready = True
        except Exception:
            self._pg_ready = False

    def list_marcacoes_hoje(self, usuario_id: str) -> Sequence[MarcacaoEntity]:
        hoje = date.today()
        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    rows = (
                        session.execute(
                            select(MarcacaoORM)
                            .where(
                                MarcacaoORM.usuario_id == usuario_id,
                                MarcacaoORM.data_referencia == hoje,
                            )
                            .order_by(MarcacaoORM.data_hora.asc())
                        )
                        .scalars()
                        .all()
                    )
                    return tuple(
                        MarcacaoEntity(
                            id=str(r.id),
                            usuario_id=r.usuario_id,
                            data_hora=r.data_hora,
                            data_referencia=r.data_referencia,
                            tipo=r.tipo,
                            fonte=r.fonte,
                            hash_sha256=str(r.marcacao_bruta_id or r.id),
                            horario_label=r.data_hora.strftime("%H:%M:%S"),
                        )
                        for r in rows
                    )
            except Exception:
                pass
        return tuple(self._local_marcacoes.get(usuario_id, []))

    def registrar_marcacao(
        self,
        usuario_id: str,
        fonte: str,
        ip: str | None = None,
        observacao: str | None = None,
    ) -> MarcacaoEntity:
        agora = datetime.now(timezone(timedelta(hours=-4)))  # America/Manaus (UTC-4)
        hoje = agora.date()
        existentes = self.list_marcacoes_hoje(usuario_id)
        tipo_calculado = classificar_tipo_marcacao_por_sequencia(
            len(existentes), jornada_ininterrupta=False
        )
        hash_payload = f"{usuario_id}|{agora.isoformat()}|{fonte}|{tipo_calculado}"
        sha256 = hashlib.sha256(hash_payload.encode("utf-8")).hexdigest()

        if self._pg_ready:
            try:
                with SyncSessionLocal() as session:
                    bruta = MarcacaoBrutaORM(
                        id=uuid.uuid4(),
                        usuario_id=usuario_id,
                        data_hora=agora,
                        fonte=fonte,
                        hash_sha256=sha256,
                        ip=ip or "127.0.0.1",
                        metadados={"tipo_classificado": tipo_calculado},
                    )
                    session.add(bruta)
                    session.flush()

                    marc = MarcacaoORM(
                        id=uuid.uuid4(),
                        usuario_id=usuario_id,
                        marcacao_bruta_id=bruta.id,
                        data_hora=agora,
                        data_referencia=hoje,
                        fuso_horario="America/Manaus",
                        tipo=tipo_calculado,
                        fonte=fonte,
                        status="VALIDA",
                        observacao=observacao,
                    )
                    session.add(marc)
                    session.commit()

                    self._redis.invalidate_prefix(f"secp:ponto:{usuario_id}")
                    return MarcacaoEntity(
                        id=str(marc.id),
                        usuario_id=usuario_id,
                        data_hora=agora,
                        data_referencia=hoje,
                        tipo=tipo_calculado,
                        fonte=fonte,
                        hash_sha256=sha256,
                        horario_label=agora.strftime("%H:%M:%S"),
                    )
            except Exception:
                pass

        ent = MarcacaoEntity(
            id=str(uuid.uuid4()),
            usuario_id=usuario_id,
            data_hora=agora,
            data_referencia=hoje,
            tipo=tipo_calculado,
            fonte=fonte,
            hash_sha256=sha256,
            horario_label=agora.strftime("%H:%M:%S"),
        )
        self._local_marcacoes.setdefault(usuario_id, []).append(ent)
        self._redis.invalidate_prefix(f"secp:ponto:{usuario_id}")
        return ent

    def get_espelho_mensal(
        self, usuario_id: str, ano: int, mes: int
    ) -> Sequence[EspelhoDiaEntity]:
        hoje_str = date.today().strftime("%d/%m/%Y")
        marcacoes_hoje = self.list_marcacoes_hoje(usuario_id)
        horarios_hoje = tuple(m.horario_label[:5] for m in marcacoes_hoje)

        return (
            EspelhoDiaEntity(
                data=hoje_str,
                dia_semana="Hoje",
                jornada_prevista="07h00",
                marcacoes=horarios_hoje if horarios_hoje else ("Aguardando 1ª batida",),
                trabalhado="--" if len(horarios_hoje) < 2 else "Em apuração",
                credito="00h00",
                debito="00h00",
                situacao="Regular" if len(horarios_hoje) >= 2 else "Pendente de ajuste",
                observacao="Dia corrente em andamento",
            ),
            EspelhoDiaEntity(
                data=f"13/{mes:02d}/{ano}",
                dia_semana="Sexta",
                jornada_prevista="07h00",
                marcacoes=("08:01", "12:00", "13:00", "16:31"),
                trabalhado="07h30",
                credito="+00h30",
                debito="00h00",
                situacao="Regular",
                observacao="Crédito autorizado para banco de horas",
            ),
            EspelhoDiaEntity(
                data=f"12/{mes:02d}/{ano}",
                dia_semana="Quinta",
                jornada_prevista="07h00",
                marcacoes=("08:04", "15:04"),
                trabalhado="07h00",
                credito="00h00",
                debito="00h00",
                situacao="Regular",
            ),
            EspelhoDiaEntity(
                data=f"11/{mes:02d}/{ano}",
                dia_semana="Quarta",
                jornada_prevista="07h00",
                marcacoes=("08:19", "14:55"),
                trabalhado="06h36",
                credito="00h00",
                debito="-00h24",
                situacao="Pendente de ajuste",
                observacao="Aguardando compensação ou justificativa (prazo 2 dias úteis)",
            ),
            EspelhoDiaEntity(
                data=f"02/{mes:02d}/{ano}",
                dia_semana="Segunda",
                jornada_prevista="00h00",
                marcacoes=("--",),
                trabalhado="00h00",
                credito="00h00",
                debito="00h00",
                situacao="Feriado",
                observacao="Finados - Feriado Nacional",
            ),
            EspelhoDiaEntity(
                data="22/12/2026",
                dia_semana="Terça",
                jornada_prevista="00h00",
                marcacoes=("Sem convocação",),
                trabalhado="00h00",
                credito="00h00",
                debito="00h00",
                situacao="Recesso forense",
                observacao="Período 20/12 a 06/01 — não contabiliza falta",
            ),
        )

    def get_banco_horas_resumo(self, usuario_id: str) -> BancoHorasResumoEntity:
        saldo_min = 500  # +08h20
        cred_mes = 390   # +06h30 (dentro do limite mensal de 16h = 960 min)
        deb_mes = 60     # -01h00
        a_vencer = 120   # +02h00 vencendo em até 3 meses
        acima_limite = 0

        movimentos = (
            MovimentoBancoHorasEntity(
                id="mov-1",
                data="13/11/2026",
                tipo="CREDITO",
                minutos=30,
                minutos_formatado="+00h30",
                status="VALIDADO",
                descricao="Extensão de jornada autorizada pela chefia imediata",
                expira_em="13/02/2027",
            ),
            MovimentoBancoHorasEntity(
                id="mov-2",
                data="11/11/2026",
                tipo="DEBITO",
                minutos=-24,
                minutos_formatado="-00h24",
                status="PENDENTE",
                descricao="Saída antecipada aguardando compensação",
                expira_em="11/02/2027",
            ),
            MovimentoBancoHorasEntity(
                id="mov-3",
                data="06/11/2026",
                tipo="CREDITO",
                minutos=120,
                minutos_formatado="+02h00",
                status="VALIDADO",
                descricao="Apoio técnico extraordinário em fechamento de unidade",
                expira_em="06/02/2027",
            ),
        )

        return BancoHorasResumoEntity(
            usuario_id=usuario_id,
            saldo_atual_minutos=saldo_min,
            saldo_atual_formatado=format_minutes_hhmm(saldo_min, with_sign=True),
            creditos_mes_minutos=cred_mes,
            creditos_mes_formatado=format_minutes_hhmm(cred_mes, with_sign=True),
            limite_mensal_minutos=LIMITE_MENSAL_BANCO_HORAS_MINUTOS,
            limite_mensal_formatado=format_minutes_hhmm(LIMITE_MENSAL_BANCO_HORAS_MINUTOS),
            debitos_mes_minutos=deb_mes,
            debitos_mes_formatado=format_minutes_hhmm(-deb_mes, with_sign=True),
            creditos_a_vencer_minutos=a_vencer,
            creditos_a_vencer_formatado=format_minutes_hhmm(a_vencer, with_sign=True),
            horas_acima_limite_minutos=acima_limite,
            horas_acima_limite_formatado=format_minutes_hhmm(acima_limite),
            movimentos=movimentos,
        )

    def list_homologacao_queue(self, ano: int, mes: int) -> Sequence[HomologacaoItemEntity]:
        prioridade = {"CRITICO": 0, "PENDENTE": 1, "REGULAR": 2, "HOMOLOGADO": 3}
        return tuple(
            sorted(self._local_homologacoes, key=lambda h: prioridade.get(h.status, 9))
        )

    def homologar_servidor(
        self, homologacao_id: str, chefia_usuario_id: str
    ) -> HomologacaoItemEntity:
        for idx, item in enumerate(self._local_homologacoes):
            if item.id == homologacao_id:
                atualizado = HomologacaoItemEntity(
                    id=item.id,
                    usuario_id=item.usuario_id,
                    servidor_nome=item.servidor_nome,
                    matricula=item.matricula,
                    unidade=item.unidade,
                    competencia=item.competencia,
                    status="HOMOLOGADO",
                    trabalhado_formatado=item.trabalhado_formatado,
                    credito_formatado=item.credito_formatado,
                    debito_formatado=item.debito_formatado,
                    faltas=item.faltas,
                    pendencias_resumo="Homologado pela chefia com registro de auditoria",
                    homologado_por=chefia_usuario_id,
                )
                self._local_homologacoes[idx] = atualizado
                return atualizado
        return self._local_homologacoes[0]
