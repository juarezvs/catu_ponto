from dataclasses import dataclass
from typing import Protocol, Sequence
from catuponto.domain.entities.user import UserProfile
from catuponto.domain.entities.navigation import NavigationItem
from catuponto.domain.entities.cadastro_item import CadastroModuleData


@dataclass(frozen=True)
class UserNavigationResult:
    user: UserProfile
    items: tuple[NavigationItem, ...]


class GetUserNavigationUseCasePort(Protocol):
    """Inbound Port (Driving Port) para consultar o menu lateral filtrado pelas permissões do usuário."""

    def execute(self, user_id: str) -> UserNavigationResult:
        ...


class ListUserProfilesUseCasePort(Protocol):
    """Inbound Port (Driving Port) para listar perfis de acesso disponíveis (simulação RBAC)."""

    def execute(self) -> Sequence[UserProfile]:
        ...


class GetModuleContentUseCasePort(Protocol):
    """Inbound Port (Driving Port) para consultar os dados de uma tela/cadastro validando permissão."""

    def execute(self, user_id: str, slug: str) -> CadastroModuleData:
        ...
