from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from catuponto.adapters.inbound.http.dtos import (
    CadastroColumnDTO,
    CadastroMetricDTO,
    CadastroModuleResponseDTO,
)
from catuponto.domain.entities.cadastro_item import CadastroModuleData
from secp.modules.secp_identidade.application.ports.input_ports import (
    AuthenticateSsoInputPort,
    GetAuthorizedHubModulesInputPort,
    GetModuleWorkspaceInputPort,
    GetSubitemResourceInputPort,
    QuerySragCopilotInputPort,
)
from secp.modules.secp_identidade.domain.entities.identity_models import (
    OrgaoScope,
    SecpModuleDescriptor,
    UserIdentity,
)
from secp.modules.secp_identidade.domain.exceptions import (
    SecpAccessDeniedException,
    SecpEntityNotFoundException,
)
from secp.modules.secp_identidade.infrastructure.di_container import (
    get_authenticate_sso_use_case,
    get_authorized_hub_modules_use_case,
    get_module_workspace_use_case,
    get_query_srag_copilot_use_case,
    get_redis_cache_gateway,
    get_subitem_resource_use_case,
)
from secp.infrastructure.config.settings import get_secp_settings
from secp.infrastructure.database.postgres_session import check_postgres_connection

secp_router = APIRouter(prefix="/api/v1/secp", tags=["SECP Platform API"])


@secp_router.get("/health/stack")
def get_stack_health() -> dict[str, object]:
    settings = get_secp_settings()
    redis_gw = get_redis_cache_gateway()
    return {
        "platform": "SECP - Sistema de Controle e Processos",
        "architecture": "Hexagonal (Ports & Adapters) + SOLID",
        "database": {
            "engine": "PostgreSQL 16 + SQLAlchemy 2.0 Async + Alembic + pgvector",
            "dsn_configured": settings.POSTGRES_Host if hasattr(settings, "POSTGRES_Host") else settings.POSTGRES_HOST,
            "connected": check_postgres_connection(),
        },
        "cache_and_queues": {
            "engine": "Redis 7 (RBAC Permission Cache + SSO Tokens + SRAG Cache)",
            "host": settings.REDIS_HOST,
            "rbac_ttl_seconds": settings.REDIS_RBAC_TTL_SECONDS,
            "connected": redis_gw.is_healthy(),
        },
    }


class OrgaoScopeDTO(BaseModel):
    id: str
    sigla: str
    nome: str
    unidadeAtiva: str
    tetoHoraExtraMensal: str


class SecpUserDTO(BaseModel):
    id: str
    matricula: str
    name: str
    email: str
    roleCode: str
    roleName: str
    defaultOrgaoId: str
    avatarInitials: str
    allowedModules: list[str]
    permissions: list[str]


class SecpModuleCardDTO(BaseModel):
    slug: str
    name: str
    shortName: str
    description: str
    themeColorHex: str
    tailwindAccent: str
    icon: str
    badgeText: str
    statsLabel: str


class SsoLoginRequestDTO(BaseModel):
    user_id: str = "secp.master"
    password: Optional[str] = None
    orgao_id: Optional[str] = None


class ChangePasswordRequestDTO(BaseModel):
    user_id: str
    new_password: str


class SsoSessionResponseDTO(BaseModel):
    token: str
    user: SecpUserDTO
    activeOrgao: OrgaoScopeDTO
    availableOrgaos: list[OrgaoScopeDTO]
    allProfiles: list[SecpUserDTO]
    requirePasswordChange: bool = False


class HubModulesResponseDTO(BaseModel):
    user: SecpUserDTO
    activeOrgao: OrgaoScopeDTO
    availableOrgaos: list[OrgaoScopeDTO]
    modules: list[SecpModuleCardDTO]


class MenuSubItemDTO(BaseModel):
    id: str
    label: str
    description: str
    badge: Optional[str] = None


class MenuSectionDTO(BaseModel):
    id: str
    title: str
    items: list[MenuSubItemDTO]


class MenuPrimaryItemDTO(BaseModel):
    id: str
    label: str
    icon: str
    hasSecondaryMenu: bool
    sections: list[MenuSectionDTO]


class ModuleWorkspaceResponseDTO(BaseModel):
    module: SecpModuleCardDTO
    user: SecpUserDTO
    activeOrgao: OrgaoScopeDTO
    menuItems: list[MenuPrimaryItemDTO]
    dashboard: CadastroModuleResponseDTO


class SragQueryRequestDTO(BaseModel):
    question: str
    user_id: str = "admin"
    orgao_id: str = "semad"
    module_slug: Optional[str] = None


class SragCitationDTO(BaseModel):
    lawReference: str
    excerpt: str
    orgaoScope: str


class SragQueryResponseDTO(BaseModel):
    question: str
    answer: str
    citations: list[SragCitationDTO]
    confidenceScore: float
    guardrailStatus: str


def _map_orgao(o: OrgaoScope) -> OrgaoScopeDTO:
    return OrgaoScopeDTO(
        id=o.id,
        sigla=o.sigla,
        nome=o.nome,
        unidadeAtiva=o.unidade_ativa,
        tetoHoraExtraMensal=o.teto_hora_extra_mensal,
    )


def _map_user(u: UserIdentity) -> SecpUserDTO:
    return SecpUserDTO(
        id=u.id,
        matricula=u.matricula,
        name=u.name,
        email=u.email,
        roleCode=u.role_code,
        roleName=u.role_name,
        defaultOrgaoId=u.default_orgao_id,
        avatarInitials=u.avatar_initials,
        allowedModules=sorted(u.allowed_modules),
        permissions=sorted(u.permissions),
    )


def _map_module(m: SecpModuleDescriptor) -> SecpModuleCardDTO:
    return SecpModuleCardDTO(
        slug=m.slug,
        name=m.name,
        shortName=m.short_name,
        description=m.description,
        themeColorHex=m.theme_color_hex,
        tailwindAccent=m.tailwind_accent,
        icon=m.icon,
        badgeText=m.badge_text,
        statsLabel=m.stats_label,
    )


def _map_content(c: CadastroModuleData) -> CadastroModuleResponseDTO:
    return CadastroModuleResponseDTO(
        slug=c.slug,
        title=c.title,
        subtitle=c.subtitle,
        category=c.category,
        primaryActionLabel=c.primary_action_label,
        metrics=[
            CadastroMetricDTO(label=m.label, value=m.value, trend=m.trend)
            for m in c.metrics
        ],
        columns=[
            CadastroColumnDTO(key=col.key, label=col.label, type=col.type)
            for col in c.columns
        ],
        records=list(c.records),
    )


_MASTER_PASSWORD_CHANGED: set[str] = set()


@secp_router.post("/auth/sso/login", response_model=SsoSessionResponseDTO)
def login_sso(
    payload: SsoLoginRequestDTO,
    use_case: AuthenticateSsoInputPort = Depends(get_authenticate_sso_use_case),
) -> SsoSessionResponseDTO:
    normalized_id = payload.user_id.strip().lower()
    if normalized_id == "secp.master" and payload.password is not None:
        if payload.password != "Reconstruir-SECP!2026" and "secp.master" not in _MASTER_PASSWORD_CHANGED:
            raise HTTPException(
                status_code=401,
                detail="Credenciais inválidas para SECP.MASTER.",
            )

    try:
        res = use_case.execute(user_id=normalized_id, orgao_id=payload.orgao_id)
    except SecpEntityNotFoundException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    require_change = (
        normalized_id == "secp.master"
        and payload.password is not None
        and "secp.master" not in _MASTER_PASSWORD_CHANGED
    )

    return SsoSessionResponseDTO(
        token=res.token,
        user=_map_user(res.user),
        activeOrgao=_map_orgao(res.active_orgao),
        availableOrgaos=[_map_orgao(o) for o in res.available_orgaos],
        allProfiles=[_map_user(p) for p in res.all_profiles],
        requirePasswordChange=require_change,
    )


@secp_router.post("/auth/sso/change-password")
def change_initial_password(payload: ChangePasswordRequestDTO) -> dict[str, object]:
    if len(payload.new_password.strip()) < 8:
        raise HTTPException(
            status_code=400,
            detail="A nova senha deve possuir ao menos 8 caracteres.",
        )
    _MASTER_PASSWORD_CHANGED.add(payload.user_id.strip().lower())
    return {"updated": True, "requirePasswordChange": False}


@secp_router.get("/hub/modules", response_model=HubModulesResponseDTO)
def list_authorized_hub_modules(
    user_id: str = Query(default="admin"),
    orgao_id: Optional[str] = Query(default=None),
    use_case: GetAuthorizedHubModulesInputPort = Depends(
        get_authorized_hub_modules_use_case
    ),
) -> HubModulesResponseDTO:
    try:
        res = use_case.execute(user_id=user_id, orgao_id=orgao_id)
    except SecpEntityNotFoundException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return HubModulesResponseDTO(
        user=_map_user(res.user),
        activeOrgao=_map_orgao(res.active_orgao),
        availableOrgaos=[_map_orgao(o) for o in res.available_orgaos],
        modules=[_map_module(m) for m in res.modules],
    )


@secp_router.get(
    "/modules/{module_slug}/workspace", response_model=ModuleWorkspaceResponseDTO
)
def get_module_workspace(
    module_slug: str,
    user_id: str = Query(default="admin"),
    orgao_id: Optional[str] = Query(default=None),
    use_case: GetModuleWorkspaceInputPort = Depends(get_module_workspace_use_case),
) -> ModuleWorkspaceResponseDTO:
    try:
        res = use_case.execute(
            user_id=user_id, module_slug=module_slug, orgao_id=orgao_id
        )
    except SecpEntityNotFoundException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SecpAccessDeniedException as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return ModuleWorkspaceResponseDTO(
        module=_map_module(res.module),
        user=_map_user(res.user),
        activeOrgao=_map_orgao(res.active_orgao),
        menuItems=[
            MenuPrimaryItemDTO(
                id=item.id,
                label=item.label,
                icon=item.icon,
                hasSecondaryMenu=item.has_secondary_menu,
                sections=[
                    MenuSectionDTO(
                        id=sec.id,
                        title=sec.title,
                        items=[
                            MenuSubItemDTO(
                                id=sub.id,
                                label=sub.label,
                                description=sub.description,
                                badge=sub.badge,
                            )
                            for sub in sec.items
                        ],
                    )
                    for sec in item.sections
                ],
            )
            for item in res.menu_items
        ],
        dashboard=_map_content(res.dashboard_content),
    )


@secp_router.get(
    "/modules/{module_slug}/subitems/{subitem_slug}",
    response_model=CadastroModuleResponseDTO,
)
def get_subitem_resource(
    module_slug: str,
    subitem_slug: str,
    user_id: str = Query(default="admin"),
    use_case: GetSubitemResourceInputPort = Depends(get_subitem_resource_use_case),
) -> CadastroModuleResponseDTO:
    try:
        data = use_case.execute(
            user_id=user_id, module_slug=module_slug, subitem_slug=subitem_slug
        )
    except SecpEntityNotFoundException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except SecpAccessDeniedException as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return _map_content(data)


@secp_router.post("/srag/query", response_model=SragQueryResponseDTO)
def query_srag_copilot(
    payload: SragQueryRequestDTO,
    use_case: QuerySragCopilotInputPort = Depends(get_query_srag_copilot_use_case),
) -> SragQueryResponseDTO:
    res = use_case.execute(
        user_id=payload.user_id,
        orgao_id=payload.orgao_id,
        question=payload.question,
        module_slug=payload.module_slug,
    )
    return SragQueryResponseDTO(
        question=res.question,
        answer=res.answer,
        citations=[
            SragCitationDTO(
                lawReference=c.law_reference,
                excerpt=c.excerpt,
                orgaoScope=c.orgao_scope,
            )
            for c in res.citations
        ],
        confidenceScore=res.confidence_score,
        guardrailStatus=res.guardrail_status,
    )
