from functools import lru_cache
from secp.modules.secp_identidade.infrastructure.di_container import (
    get_identity_repository,
    get_redis_cache_gateway,
)
from secp.modules.secp_ponto.application.ports.input_ports import (
    GetBancoHorasInputPort,
    GetEspelhoPontoInputPort,
    GetPontoDashboardInputPort,
    HomologarServidorMesInputPort,
    ListHomologacaoQueueInputPort,
    RegistrarPontoInputPort,
)
from secp.modules.secp_ponto.application.ports.output_ports import (
    PontoRepositoryOutputPort,
)
from secp.modules.secp_ponto.application.use_cases.ponto_use_cases import (
    GetBancoHorasUseCase,
    GetEspelhoPontoUseCase,
    GetPontoDashboardUseCase,
    HomologarServidorMesUseCase,
    ListHomologacaoQueueUseCase,
    RegistrarPontoUseCase,
)
from secp.modules.secp_ponto.application.ports.crud_ports import (
    PontoCrudRepositoryOutputPort,
    PontoCrudUseCaseInputPort,
)
from secp.modules.secp_ponto.application.use_cases.ponto_crud_use_cases import (
    PontoResourceCrudUseCase,
)
from secp.modules.secp_ponto.infrastructure.adapters.outbound.postgres_redis_ponto_crud_repository import (
    PostgresRedisPontoCrudRepository,
)
from secp.modules.secp_ponto.infrastructure.adapters.outbound.postgres_redis_ponto_repository import (
    PostgresRedisPontoRepository,
)
from secp.modules.secp_ponto.infrastructure.adapters.outbound.postgres_prod_real_ponto_repository import (
    PostgresProdRealPontoRepository,
)


@lru_cache(maxsize=1)
def get_prod_real_ponto_repository() -> PostgresProdRealPontoRepository:
    return PostgresProdRealPontoRepository(redis_gateway=get_redis_cache_gateway())


@lru_cache(maxsize=1)
def get_ponto_repository() -> PontoRepositoryOutputPort:
    return PostgresRedisPontoRepository(redis_gateway=get_redis_cache_gateway())


@lru_cache(maxsize=1)
def get_ponto_crud_repository() -> PontoCrudRepositoryOutputPort:
    return PostgresRedisPontoCrudRepository(redis_gateway=get_redis_cache_gateway())


def get_ponto_crud_use_case() -> PontoCrudUseCaseInputPort:
    return PontoResourceCrudUseCase(crud_repo=get_ponto_crud_repository())


def get_ponto_dashboard_use_case() -> GetPontoDashboardInputPort:
    return GetPontoDashboardUseCase(
        ponto_repo=get_ponto_repository(),
        identity_repo=get_identity_repository(),
    )


def get_registrar_ponto_use_case() -> RegistrarPontoInputPort:
    return RegistrarPontoUseCase(ponto_repo=get_ponto_repository())


def get_espelho_ponto_use_case() -> GetEspelhoPontoInputPort:
    return GetEspelhoPontoUseCase(ponto_repo=get_ponto_repository())


def get_banco_horas_use_case() -> GetBancoHorasInputPort:
    return GetBancoHorasUseCase(ponto_repo=get_ponto_repository())


def get_list_homologacao_use_case() -> ListHomologacaoQueueInputPort:
    return ListHomologacaoQueueUseCase(ponto_repo=get_ponto_repository())


def get_homologar_servidor_use_case() -> HomologarServidorMesInputPort:
    return HomologarServidorMesUseCase(ponto_repo=get_ponto_repository())
