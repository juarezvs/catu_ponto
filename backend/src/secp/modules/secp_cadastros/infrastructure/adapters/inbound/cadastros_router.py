from functools import lru_cache
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException, Query

from secp.modules.secp_cadastros.infrastructure.adapters.outbound.postgres_prod_real_cadastro_repository import (
    PostgresProdRealCadastroRepository,
)
from secp.modules.secp_identidade.infrastructure.di_container import (
    get_redis_cache_gateway,
)

cadastros_router = APIRouter(
    prefix="/api/v1/secp/cadastros",
    tags=["SECP Cadastros (Produção Real)"],
)


@lru_cache(maxsize=1)
def get_cadastros_repository() -> PostgresProdRealCadastroRepository:
    return PostgresProdRealCadastroRepository(redis_gateway=get_redis_cache_gateway())


@cadastros_router.get("/catalog")
def list_cadastros_catalog(
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> list[dict[str, Any]]:
    return repo.list_catalog()


@cadastros_router.get("/aux/municipios")
def list_municipios_por_uf(
    uf: str = Query(default=""),
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> list[dict[str, str]]:
    return repo.list_municipios_by_uf(uf)


@cadastros_router.get("/aux/organograma")
def get_organograma_hierarquia(
    orgao: str = Query(default="SJAM"),
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> dict[str, Any]:
    return repo.get_organograma(orgao_sigla=orgao)


@cadastros_router.get("/{slug}/schema")
def get_cadastro_schema(
    slug: str,
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> dict[str, Any]:
    try:
        return repo.get_schema(slug)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@cadastros_router.get("/{slug}")
def list_cadastro_records(
    slug: str,
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    filters: str = Query(default=""),
    sort_by: str = Query(default=""),
    sort_dir: str = Query(default="asc"),
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> dict[str, Any]:
    try:
        return repo.list_records(
            slug=slug,
            search=search,
            page=page,
            page_size=page_size,
            filters_json=filters,
            sort_by=sort_by,
            sort_dir=sort_dir,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@cadastros_router.post("/{slug}", status_code=201)
def create_cadastro_record(
    slug: str,
    payload: dict[str, Any] = Body(...),
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> dict[str, Any]:
    try:
        return repo.create_record(slug=slug, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@cadastros_router.put("/{slug}/{record_id}")
def update_cadastro_record(
    slug: str,
    record_id: str,
    payload: dict[str, Any] = Body(...),
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> dict[str, Any]:
    try:
        return repo.update_record(slug=slug, record_id=record_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@cadastros_router.delete("/{slug}/{record_id}")
def delete_cadastro_record(
    slug: str,
    record_id: str,
    repo: PostgresProdRealCadastroRepository = Depends(get_cadastros_repository),
) -> dict[str, Any]:
    try:
        return repo.delete_record(slug=slug, record_id=record_id)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
