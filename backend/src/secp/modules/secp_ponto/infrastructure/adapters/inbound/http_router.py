from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from secp.modules.secp_ponto.application.ports.crud_ports import (
    PontoCrudUseCaseInputPort,
)
from secp.modules.secp_ponto.application.ports.input_ports import (
    GetBancoHorasInputPort,
    GetEspelhoPontoInputPort,
    GetPontoDashboardInputPort,
    HomologarServidorMesInputPort,
    ListHomologacaoQueueInputPort,
    RegistrarPontoInputPort,
)
from secp.modules.secp_ponto.domain.entities.ponto_models import format_minutes_hhmm
from secp.modules.secp_ponto.infrastructure.di_container import (
    get_banco_horas_use_case,
    get_espelho_ponto_use_case,
    get_homologar_servidor_use_case,
    get_list_homologacao_use_case,
    get_ponto_crud_use_case,
    get_ponto_dashboard_use_case,
    get_registrar_ponto_use_case,
)

ponto_router = APIRouter(prefix="/api/v1/secp/ponto", tags=["SECP Ponto"])


class TimelinePosicaoDTO(BaseModel):
    ordem: int
    tipo: str
    titulo: str
    horario: Optional[str] = None
    fonte: Optional[str] = None
    concluido: bool


class MarcacaoDTO(BaseModel):
    id: str
    tipo: str
    fonte: str
    horarioLabel: str
    hashSha256: str


class PontoDashboardResponseDTO(BaseModel):
    usuarioId: str
    servidorNome: str
    unidadeLabel: str
    jornadaNome: str
    jornadaPrevistaFormatado: str
    trabalhadoHojeFormatado: str
    saldoBancoFormatado: str
    pendenciasCount: int
    proximaAcaoCodigo: str
    proximaAcaoLabel: str
    exigeBiometriaFacial: bool
    frequenciaMesPercentual: float
    diasRegularesMes: int
    diasUteisMes: int
    timelineDia: list[TimelinePosicaoDTO]
    marcacoesHoje: list[MarcacaoDTO]


class RegistrarPontoRequestDTO(BaseModel):
    user_id: str = "admin"
    fonte: str = "BIOMETRIA_FACIAL"
    observacao: Optional[str] = None


class EspelhoDiaDTO(BaseModel):
    data: str
    diaSemana: str
    jornadaPrevista: str
    marcacoes: list[str]
    trabalhado: str
    credito: str
    debito: str
    situacao: str
    observacao: Optional[str] = None


class MovimentoBancoDTO(BaseModel):
    id: str
    data: str
    tipo: str
    minutosFormatado: str
    status: str
    descricao: str
    expiraEm: Optional[str] = None


class BancoHorasResponseDTO(BaseModel):
    saldoAtualFormatado: str
    creditosMesFormatado: str
    limiteMensalFormatado: str
    percentualLimiteUsado: float
    debitosMesFormatado: str
    creditosAVencerFormatado: str
    horasAcimaLimiteFormatado: str
    movimentos: list[MovimentoBancoDTO]


class HomologacaoItemDTO(BaseModel):
    id: str
    usuarioId: str
    servidorNome: str
    matricula: str
    unidade: str
    competencia: str
    status: str
    trabalhadoFormatado: str
    creditoFormatado: str
    debitoFormatado: str
    faltas: int
    pendenciasResumo: Optional[str] = None
    homologadoPor: Optional[str] = None


@ponto_router.get("/dashboard", response_model=PontoDashboardResponseDTO)
def get_ponto_dashboard(
    user_id: str = Query(default="admin"),
    use_case: GetPontoDashboardInputPort = Depends(get_ponto_dashboard_use_case),
) -> PontoDashboardResponseDTO:
    d = use_case.execute(usuario_id=user_id)
    return PontoDashboardResponseDTO(
        usuarioId=d.usuario_id,
        servidorNome=d.servidor_nome,
        unidadeLabel=d.unidade_label,
        jornadaNome=d.jornada_nome,
        jornadaPrevistaFormatado=format_minutes_hhmm(d.jornada_prevista_minutos),
        trabalhadoHojeFormatado=format_minutes_hhmm(d.trabalhado_hoje_minutos),
        saldoBancoFormatado=format_minutes_hhmm(d.saldo_banco_minutos, with_sign=True),
        pendenciasCount=d.pendencias_count,
        proximaAcaoCodigo=d.proxima_acao_codigo,
        proximaAcaoLabel=d.proxima_acao_label,
        exigeBiometriaFacial=d.exige_biometria_facial,
        frequenciaMesPercentual=d.frequencia_mes_percentual,
        diasRegularesMes=d.dias_regulares_mes,
        diasUteisMes=d.dias_uteis_mes,
        timelineDia=[
            TimelinePosicaoDTO(
                ordem=t.ordem,
                tipo=t.tipo,
                titulo=t.titulo,
                horario=t.horario,
                fonte=t.fonte,
                concluido=t.concluido,
            )
            for t in d.timeline_dia
        ],
        marcacoesHoje=[
            MarcacaoDTO(
                id=m.id,
                tipo=m.tipo,
                fonte=m.fonte,
                horarioLabel=m.horario_label,
                hashSha256=m.hash_sha256,
            )
            for m in d.marcacoes_hoje
        ],
    )


@ponto_router.post("/registrar", response_model=MarcacaoDTO)
def registrar_ponto(
    payload: RegistrarPontoRequestDTO,
    use_case: RegistrarPontoInputPort = Depends(get_registrar_ponto_use_case),
) -> MarcacaoDTO:
    m = use_case.execute(
        usuario_id=payload.user_id,
        fonte=payload.fonte,
        observacao=payload.observacao,
    )
    return MarcacaoDTO(
        id=m.id,
        tipo=m.tipo,
        fonte=m.fonte,
        horarioLabel=m.horario_label,
        hashSha256=m.hash_sha256,
    )


@ponto_router.get("/espelho", response_model=list[EspelhoDiaDTO])
def get_espelho_ponto(
    user_id: str = Query(default="admin"),
    ano: int = Query(default=2026),
    mes: int = Query(default=11),
    use_case: GetEspelhoPontoInputPort = Depends(get_espelho_ponto_use_case),
) -> list[EspelhoDiaDTO]:
    dias = use_case.execute(usuario_id=user_id, ano=ano, mes=mes)
    return [
        EspelhoDiaDTO(
            data=dia.data,
            diaSemana=dia.dia_semana,
            jornadaPrevista=dia.jornada_prevista,
            marcacoes=list(dia.marcacoes),
            trabalhado=dia.trabalhado,
            credito=dia.credito,
            debito=dia.debito,
            situacao=dia.situacao,
            observacao=dia.observacao,
        )
        for dia in dias
    ]


@ponto_router.get("/banco-horas", response_model=BancoHorasResponseDTO)
def get_banco_horas(
    user_id: str = Query(default="admin"),
    use_case: GetBancoHorasInputPort = Depends(get_banco_horas_use_case),
) -> BancoHorasResponseDTO:
    b = use_case.execute(usuario_id=user_id)
    pct = min(
        100.0,
        round((b.creditos_mes_minutos / max(1, b.limite_mensal_minutos)) * 100, 1),
    )
    return BancoHorasResponseDTO(
        saldoAtualFormatado=b.saldo_atual_formatado,
        creditosMesFormatado=b.creditos_mes_formatado,
        limiteMensalFormatado=b.limite_mensal_formatado,
        percentualLimiteUsado=pct,
        debitosMesFormatado=b.debitos_mes_formatado,
        creditosAVencerFormatado=b.creditos_a_vencer_formatado,
        horasAcimaLimiteFormatado=b.horas_acima_limite_formatado,
        movimentos=[
            MovimentoBancoDTO(
                id=m.id,
                data=m.data,
                tipo=m.tipo,
                minutosFormatado=m.minutos_formatado,
                status=m.status,
                descricao=m.descricao,
                expiraEm=m.expira_em,
            )
            for m in b.movimentos
        ],
    )


@ponto_router.get("/homologacao", response_model=list[HomologacaoItemDTO])
def list_homologacao(
    ano: int = Query(default=2026),
    mes: int = Query(default=11),
    use_case: ListHomologacaoQueueInputPort = Depends(get_list_homologacao_use_case),
) -> list[HomologacaoItemDTO]:
    items = use_case.execute(ano=ano, mes=mes)
    return [
        HomologacaoItemDTO(
            id=i.id,
            usuarioId=i.usuario_id,
            servidorNome=i.servidor_nome,
            matricula=i.matricula,
            unidade=i.unidade,
            competencia=i.competencia,
            status=i.status,
            trabalhadoFormatado=i.trabalhado_formatado,
            creditoFormatado=i.credito_formatado,
            debitoFormatado=i.debito_formatado,
            faltas=i.faltas,
            pendenciasResumo=i.pendencias_resumo,
            homologadoPor=i.homologado_por,
        )
        for i in items
    ]


@ponto_router.post("/homologacao/{homologacao_id}/aprovar", response_model=HomologacaoItemDTO)
def homologar_servidor(
    homologacao_id: str,
    chefia_id: str = Query(default="admin"),
    use_case: HomologarServidorMesInputPort = Depends(get_homologar_servidor_use_case),
) -> HomologacaoItemEntity:
    i = use_case.execute(homologacao_id=homologacao_id, chefia_usuario_id=chefia_id)
    return HomologacaoItemDTO(
        id=i.id,
        usuarioId=i.usuario_id,
        servidorNome=i.servidor_nome,
        matricula=i.matricula,
        unidade=i.unidade,
        competencia=i.competencia,
        status=i.status,
        trabalhadoFormatado=i.trabalhado_formatado,
        creditoFormatado=i.credito_formatado,
        debitoFormatado=i.debito_formatado,
        faltas=i.faltas,
        pendenciasResumo=i.pendencias_resumo,
        homologadoPor=i.homologado_por,
    )


# ==============================================================================
# ENDPOINTS CRUD COMPLETOS PARA TODAS AS TABELAS DO MÓDULO SECP PONTO
# ==============================================================================


class CrudFieldDTO(BaseModel):
    key: str
    label: str
    fieldType: str
    required: bool
    options: list[str]


class CrudColumnDTO(BaseModel):
    key: str
    label: str
    type: str


class CrudListResponseDTO(BaseModel):
    resource: str
    title: str
    subtitle: str
    primaryActionLabel: str
    fields: list[CrudFieldDTO]
    columns: list[CrudColumnDTO]
    records: list[dict[str, Any]]
    total: int


@ponto_router.get("/crud/{resource}", response_model=CrudListResponseDTO)
def list_crud_resource(
    resource: str,
    search: str = Query(default=""),
    use_case: PontoCrudUseCaseInputPort = Depends(get_ponto_crud_use_case),
) -> CrudListResponseDTO:
    res = use_case.list_records(resource=resource, search=search)
    return CrudListResponseDTO(
        resource=res.resource,
        title=res.title,
        subtitle=res.subtitle,
        primaryActionLabel=res.primary_action_label,
        fields=[
            CrudFieldDTO(
                key=f.key,
                label=f.label,
                fieldType=f.field_type,
                required=f.required,
                options=list(f.options),
            )
            for f in res.fields
        ],
        columns=[
            CrudColumnDTO(key=c.key, label=c.label, type=c.type)
            for c in res.columns
        ],
        records=list(res.records),
        total=res.total,
    )


@ponto_router.post("/crud/{resource}")
def create_crud_resource(
    resource: str,
    payload: dict[str, Any],
    use_case: PontoCrudUseCaseInputPort = Depends(get_ponto_crud_use_case),
) -> dict[str, Any]:
    return use_case.create_record(resource=resource, payload=payload)


@ponto_router.put("/crud/{resource}/{item_id}")
def update_crud_resource(
    resource: str,
    item_id: str,
    payload: dict[str, Any],
    use_case: PontoCrudUseCaseInputPort = Depends(get_ponto_crud_use_case),
) -> dict[str, Any]:
    try:
        return use_case.update_record(
            resource=resource, item_id=item_id, payload=payload
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@ponto_router.delete("/crud/{resource}/{item_id}")
def delete_crud_resource(
    resource: str,
    item_id: str,
    use_case: PontoCrudUseCaseInputPort = Depends(get_ponto_crud_use_case),
) -> dict[str, bool]:
    deleted = use_case.delete_record(resource=resource, item_id=item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Registro não encontrado.")
    return {"deleted": True}
