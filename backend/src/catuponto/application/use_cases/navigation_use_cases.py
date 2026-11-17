from typing import Sequence
from catuponto.application.ports.inbound.use_cases import (
    GetModuleContentUseCasePort,
    GetUserNavigationUseCasePort,
    ListUserProfilesUseCasePort,
    UserNavigationResult,
)
from catuponto.application.ports.outbound.repositories import (
    CadastroRepositoryPort,
    NavigationRepositoryPort,
    UserRepositoryPort,
)
from catuponto.domain.entities.cadastro_item import CadastroModuleData
from catuponto.domain.entities.user import UserProfile
from catuponto.domain.exceptions import AccessDeniedException, EntityNotFoundException


class GetUserNavigationUseCase(GetUserNavigationUseCasePort):
    """
    Caso de Uso (Single Responsibility Principle & Dependency Inversion Principle):
    Orquestra a busca do perfil do usuário e aplica as regras de domínio de filtragem
    do menu lateral primário e secundário por permissão de acesso.
    """

    def __init__(
        self,
        user_repository: UserRepositoryPort,
        navigation_repository: NavigationRepositoryPort,
    ) -> None:
        self._user_repository = user_repository
        self._navigation_repository = navigation_repository

    def execute(self, user_id: str) -> UserNavigationResult:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise EntityNotFoundException(f"Usuário '{user_id}' não encontrado.")

        raw_tree = self._navigation_repository.get_navigation_tree()
        filtered_items = tuple(
            filtered
            for item in raw_tree
            if (filtered := item.filter_for_user(user)) is not None
        )

        return UserNavigationResult(user=user, items=filtered_items)


class ListUserProfilesUseCase(ListUserProfilesUseCasePort):
    """Caso de Uso para listar perfis de usuário disponíveis para simulação de permissões."""

    def __init__(self, user_repository: UserRepositoryPort) -> None:
        self._user_repository = user_repository

    def execute(self) -> Sequence[UserProfile]:
        return self._user_repository.list_profiles()


class GetModuleContentUseCase(GetModuleContentUseCasePort):
    """
    Caso de Uso responsável por retornar os metadados, métricas e registros de um
    cadastro/módulo específico, garantindo que o usuário possua a permissão exigida.
    """

    def __init__(
        self,
        user_repository: UserRepositoryPort,
        cadastro_repository: CadastroRepositoryPort,
    ) -> None:
        self._user_repository = user_repository
        self._cadastro_repository = cadastro_repository

    def execute(self, user_id: str, slug: str) -> CadastroModuleData:
        user = self._user_repository.get_by_id(user_id)
        if user is None:
            raise EntityNotFoundException(f"Usuário '{user_id}' não encontrado.")

        module_data = self._cadastro_repository.get_module_by_slug(slug)
        if module_data is None:
            raise EntityNotFoundException(f"Módulo ou cadastro '{slug}' não encontrado.")

        if not user.has_permission(module_data.required_permission):
            raise AccessDeniedException(
                f"O perfil '{user.role_name}' não possui permissão ({module_data.required_permission}) para acessar '{module_data.title}'."
            )

        return module_data
