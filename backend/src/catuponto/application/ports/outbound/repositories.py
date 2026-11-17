from typing import Protocol, Sequence
from catuponto.domain.entities.user import UserProfile
from catuponto.domain.entities.navigation import NavigationItem
from catuponto.domain.entities.cadastro_item import CadastroModuleData


class UserRepositoryPort(Protocol):
    """Outbound Port (Driven Port) para recuperação de perfis de usuários e suas permissões."""

    def get_by_id(self, user_id: str) -> UserProfile | None:
        ...

    def list_profiles(self) -> Sequence[UserProfile]:
        ...


class NavigationRepositoryPort(Protocol):
    """Outbound Port (Driven Port) para obtenção da árvore base de navegação do sistema."""

    def get_navigation_tree(self) -> Sequence[NavigationItem]:
        ...


class CadastroRepositoryPort(Protocol):
    """Outbound Port (Driven Port) para obtenção dos módulos e registros de cadastros/páginas."""

    def get_module_by_slug(self, slug: str) -> CadastroModuleData | None:
        ...
