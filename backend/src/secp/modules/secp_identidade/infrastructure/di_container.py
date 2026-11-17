from functools import lru_cache
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.modules.secp_identidade.application.ports.input_ports import (
    AuthenticateSsoInputPort,
    GetAuthorizedHubModulesInputPort,
    GetModuleWorkspaceInputPort,
    GetSubitemResourceInputPort,
    QuerySragCopilotInputPort,
)
from secp.modules.secp_identidade.application.ports.output_ports import (
    IdentityRepositoryOutputPort,
    ModuleNavigationOutputPort,
    SragCopilotOutputPort,
)
from secp.modules.secp_identidade.application.ports.rbac_ports import (
    RbacManagementInputPort,
    RbacRepositoryOutputPort,
)
from secp.modules.secp_identidade.application.use_cases.identity_use_cases import (
    AuthenticateSsoUseCase,
    GetAuthorizedHubModulesUseCase,
    GetModuleWorkspaceUseCase,
    GetSubitemResourceUseCase,
    QuerySragCopilotUseCase,
)
from secp.modules.secp_identidade.application.use_cases.rbac_use_cases import (
    RbacManagementUseCase,
)
from secp.modules.secp_identidade.infrastructure.adapters.outbound.in_memory_secp_repository import (
    InMemorySecpNavigationRepository,
)
from secp.modules.secp_identidade.infrastructure.adapters.outbound.postgres_redis_rbac_repository import (
    PostgresRedisRbacRepository,
)
from secp.modules.secp_identidade.infrastructure.adapters.outbound.postgres_redis_secp_adapters import (
    PgVectorRedisSragCopilotAdapter,
    PostgresSecpIdentityRepository,
    RedisCachedIdentityRepository,
)


@lru_cache(maxsize=1)
def get_redis_cache_gateway() -> SecpRedisCacheGateway:
    return SecpRedisCacheGateway()


@lru_cache(maxsize=1)
def get_identity_repository() -> IdentityRepositoryOutputPort:
    postgres_repo = PostgresSecpIdentityRepository()
    return RedisCachedIdentityRepository(
        postgres_repo=postgres_repo,
        redis_gateway=get_redis_cache_gateway(),
    )


@lru_cache(maxsize=1)
def get_rbac_repository() -> RbacRepositoryOutputPort:
    return PostgresRedisRbacRepository(redis_gateway=get_redis_cache_gateway())


@lru_cache(maxsize=1)
def get_module_navigation_repository() -> ModuleNavigationOutputPort:
    return InMemorySecpNavigationRepository()


@lru_cache(maxsize=1)
def get_srag_copilot_adapter() -> SragCopilotOutputPort:
    return PgVectorRedisSragCopilotAdapter(redis_gateway=get_redis_cache_gateway())


def get_authenticate_sso_use_case() -> AuthenticateSsoInputPort:
    return AuthenticateSsoUseCase(identity_repo=get_identity_repository())


def get_authorized_hub_modules_use_case() -> GetAuthorizedHubModulesInputPort:
    return GetAuthorizedHubModulesUseCase(
        identity_repo=get_identity_repository(),
        rbac_repo=get_rbac_repository(),
    )


def get_module_workspace_use_case() -> GetModuleWorkspaceInputPort:
    return GetModuleWorkspaceUseCase(
        identity_repo=get_identity_repository(),
        navigation_repo=get_module_navigation_repository(),
        rbac_repo=get_rbac_repository(),
    )


def get_subitem_resource_use_case() -> GetSubitemResourceInputPort:
    return GetSubitemResourceUseCase(
        identity_repo=get_identity_repository(),
        navigation_repo=get_module_navigation_repository(),
        rbac_repo=get_rbac_repository(),
    )


def get_query_srag_copilot_use_case() -> QuerySragCopilotInputPort:
    return QuerySragCopilotUseCase(
        identity_repo=get_identity_repository(),
        srag_port=get_srag_copilot_adapter(),
    )


def get_rbac_management_use_case() -> RbacManagementInputPort:
    return RbacManagementUseCase(
        rbac_repo=get_rbac_repository(),
        identity_repo=get_identity_repository(),
    )
