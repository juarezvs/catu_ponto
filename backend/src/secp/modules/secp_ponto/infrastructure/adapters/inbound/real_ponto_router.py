from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from secp.modules.secp_ponto.infrastructure.adapters.outbound.postgres_prod_real_ponto_repository import (
    PostgresProdRealPontoRepository,
)
from secp.modules.secp_ponto.infrastructure.di_container import (
    get_prod_real_ponto_repository,
)

real_ponto_router = APIRouter(
    prefix="/api/v1/secp/ponto/real",
    tags=["SECP Ponto (Produção Real)"],
)


class RegistrarPontoRealRequest(BaseModel):
    matricula: str = Field(..., min_length=2, max_length=60)
    fonte: str = Field(default="FACIAL", max_length=30)
    observacao: str = Field(default="", max_length=500)


class CriarSolicitacaoRealRequest(BaseModel):
    matricula: str = Field(..., min_length=2, max_length=60)
    tipo: str = Field(default="AJUSTE_PONTO", max_length=80)
    data_referencia: str = Field(default_factory=lambda: date.today().isoformat())
    descricao: str = Field(..., min_length=10, max_length=3000)
    titulo: str | None = Field(default=None, max_length=255)


class LoginRealRequest(BaseModel):
    matricula: str = Field(..., min_length=2, max_length=60)
    senha: str = Field(..., min_length=1, max_length=200)


@real_ponto_router.post("/auth/login")
def login_real(
    payload: LoginRealRequest,
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    try:
        return repo.autenticar_usuario_real(matricula=payload.matricula, senha=payload.senha)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@real_ponto_router.get("/orgaos")
def list_real_orgaos(
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> list[dict[str, Any]]:
    return repo.list_real_orgaos()


@real_ponto_router.get("/servidores")
def list_real_servidores(
    orgao: str = Query(default="SJAM"),
    search: str = Query(default=""),
    limit: int = Query(default=20, ge=1, le=100),
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> list[dict[str, Any]]:
    return repo.list_servidores_sample(orgao_sigla=orgao, search=search, limit=limit)


@real_ponto_router.get("/rbac-context")
def get_real_rbac_context(
    matricula: str = Query(default="AM200385"),
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    try:
        return repo.get_real_rbac_context(matricula=matricula)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@real_ponto_router.get("/regulamentacao")
def get_real_regulamentacao(
    orgao: str = Query(default="SJAM"),
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    return repo.get_regulamentacao_orgao(orgao_sigla=orgao)


@real_ponto_router.get("/dashboard")
def get_real_dashboard(
    matricula: str = Query(default="AM200385"),
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    try:
        return repo.get_real_dashboard(matricula=matricula)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@real_ponto_router.post("/registrar")
def registrar_ponto_real(
    payload: RegistrarPontoRealRequest,
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    try:
        return repo.registrar_ponto_real(
            matricula=payload.matricula,
            fonte=payload.fonte,
            observacao=payload.observacao,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@real_ponto_router.get("/espelho")
def get_real_espelho_mensal(
    matricula: str = Query(default="AM200385"),
    ano: int = Query(default_factory=lambda: date.today().year, ge=2020, le=2035),
    mes: int = Query(default_factory=lambda: date.today().month, ge=1, le=12),
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    try:
        return repo.get_real_espelho_mensal(matricula=matricula, ano=ano, mes=mes)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@real_ponto_router.get("/solicitacoes")
def list_real_solicitacoes(
    matricula: str = Query(default="AM200385"),
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> list[dict[str, Any]]:
    try:
        return repo.list_real_solicitacoes(matricula=matricula)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@real_ponto_router.post("/solicitacoes", status_code=201)
def criar_solicitacao_real(
    payload: CriarSolicitacaoRealRequest,
    repo: PostgresProdRealPontoRepository = Depends(get_prod_real_ponto_repository),
) -> dict[str, Any]:
    try:
        return repo.criar_solicitacao_real(
            matricula=payload.matricula,
            tipo=payload.tipo,
            data_referencia=payload.data_referencia,
            descricao=payload.descricao,
            titulo=payload.titulo,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
