from fastapi import APIRouter, Depends, HTTPException, Query
from catuponto.adapters.inbound.http.dtos import (
    CadastroColumnDTO,
    CadastroMetricDTO,
    CadastroModuleResponseDTO,
    NavigationItemDTO,
    NavigationSectionDTO,
    NavigationSubItemDTO,
    UserNavigationResponseDTO,
    UserProfileDTO,
)
from catuponto.application.ports.inbound.use_cases import (
    GetModuleContentUseCasePort,
    GetUserNavigationUseCasePort,
    ListUserProfilesUseCasePort,
)
from catuponto.domain.entities.user import UserProfile
from catuponto.domain.exceptions import AccessDeniedException, EntityNotFoundException
from catuponto.infrastructure.container import (
    get_list_profiles_use_case,
    get_module_content_use_case,
    get_user_navigation_use_case,
)

router = APIRouter(prefix="/api/v1", tags=["CatuPonto API"])


def _map_user_to_dto(user: UserProfile) -> UserProfileDTO:
    return UserProfileDTO(
        id=user.id,
        name=user.name,
        email=user.email,
        roleName=user.role_name,
        organization=user.organization,
        avatarInitials=user.avatar_initials,
        permissions=sorted(user.permissions),
    )


@router.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "catuponto-backend", "architecture": "hexagonal"}


@router.get("/users/profiles", response_model=list[UserProfileDTO])
def list_user_profiles(
    use_case: ListUserProfilesUseCasePort = Depends(get_list_profiles_use_case),
) -> list[UserProfileDTO]:
    profiles = use_case.execute()
    return [_map_user_to_dto(p) for p in profiles]


@router.get("/navigation", response_model=UserNavigationResponseDTO)
def get_navigation(
    user_id: str = Query(default="admin", description="ID do perfil do usuário autenticado"),
    use_case: GetUserNavigationUseCasePort = Depends(get_user_navigation_use_case),
) -> UserNavigationResponseDTO:
    try:
        result = use_case.execute(user_id=user_id)
    except EntityNotFoundException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return UserNavigationResponseDTO(
        user=_map_user_to_dto(result.user),
        items=[
            NavigationItemDTO(
                id=item.id,
                label=item.label,
                icon=item.icon,
                route=item.route,
                hasSecondaryMenu=item.has_secondary_menu,
                position=item.position,
                sections=[
                    NavigationSectionDTO(
                        id=section.id,
                        title=section.title,
                        items=[
                            NavigationSubItemDTO(
                                id=sub.id,
                                label=sub.label,
                                route=sub.route,
                                description=sub.description,
                                badge=sub.badge,
                                icon=sub.icon,
                            )
                            for sub in section.items
                        ],
                    )
                    for section in item.sections
                ],
            )
            for item in result.items
        ],
    )


@router.get("/modules/{slug}", response_model=CadastroModuleResponseDTO)
def get_module_content(
    slug: str,
    user_id: str = Query(default="admin", description="ID do perfil do usuário autenticado"),
    use_case: GetModuleContentUseCasePort = Depends(get_module_content_use_case),
) -> CadastroModuleResponseDTO:
    try:
        module_data = use_case.execute(user_id=user_id, slug=slug)
    except EntityNotFoundException as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except AccessDeniedException as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc

    return CadastroModuleResponseDTO(
        slug=module_data.slug,
        title=module_data.title,
        subtitle=module_data.subtitle,
        category=module_data.category,
        primaryActionLabel=module_data.primary_action_label,
        metrics=[
            CadastroMetricDTO(label=m.label, value=m.value, trend=m.trend)
            for m in module_data.metrics
        ],
        columns=[
            CadastroColumnDTO(key=c.key, label=c.label, type=c.type)
            for c in module_data.columns
        ],
        records=list(module_data.records),
    )
