from functools import lru_cache
from catuponto.adapters.outbound.persistence.cadastro_repository import (
    InMemoryCadastroRepository,
)
from catuponto.adapters.outbound.persistence.in_memory_adapters import (
    InMemoryNavigationRepository,
    InMemoryUserRepository,
)
from catuponto.application.ports.inbound.use_cases import (
    GetModuleContentUseCasePort,
    GetUserNavigationUseCasePort,
    ListUserProfilesUseCasePort,
)
from catuponto.application.ports.outbound.repositories import (
    CadastroRepositoryPort,
    NavigationRepositoryPort,
    UserRepositoryPort,
)
from catuponto.application.use_cases.navigation_use_cases import (
    GetModuleContentUseCase,
    GetUserNavigationUseCase,
    ListUserProfilesUseCase,
)


@lru_cache(maxsize=1)
def get_user_repository() -> UserRepositoryPort:
    return InMemoryUserRepository()


@lru_cache(maxsize=1)
def get_navigation_repository() -> NavigationRepositoryPort:
    return InMemoryNavigationRepository()


@lru_cache(maxsize=1)
def get_cadastro_repository() -> CadastroRepositoryPort:
    return InMemoryCadastroRepository()


def get_user_navigation_use_case() -> GetUserNavigationUseCasePort:
    return GetUserNavigationUseCase(
        user_repository=get_user_repository(),
        navigation_repository=get_navigation_repository(),
    )


def get_list_profiles_use_case() -> ListUserProfilesUseCasePort:
    return ListUserProfilesUseCase(user_repository=get_user_repository())


def get_module_content_use_case() -> GetModuleContentUseCasePort:
    return GetModuleContentUseCase(
        user_repository=get_user_repository(),
        cadastro_repository=get_cadastro_repository(),
    )
