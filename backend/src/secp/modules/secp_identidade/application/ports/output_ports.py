from typing import Protocol, Sequence
from catuponto.domain.entities.cadastro_item import CadastroModuleData
from secp.modules.secp_identidade.domain.entities.identity_models import (
    MenuPrimaryItemEntity,
    OrgaoScope,
    SecpModuleDescriptor,
    SragAnswerEntity,
    UserIdentity,
)


class IdentityRepositoryOutputPort(Protocol):
    """Outbound Port (Driven Port) para recuperação de identidades, órgãos e catálogo de módulos."""

    def get_user_by_id(self, user_id: str) -> UserIdentity | None:
        ...

    def list_users(self) -> Sequence[UserIdentity]:
        ...

    def list_orgaos(self) -> Sequence[OrgaoScope]:
        ...

    def get_orgao_by_id(self, orgao_id: str) -> OrgaoScope | None:
        ...

    def list_modules(self) -> Sequence[SecpModuleDescriptor]:
        ...

    def get_module_by_slug(self, module_slug: str) -> SecpModuleDescriptor | None:
        ...


class ModuleNavigationOutputPort(Protocol):
    """Outbound Port para árvore de menus de cada módulo e dados dos subitens."""

    def get_module_menu_tree(self, module_slug: str) -> Sequence[MenuPrimaryItemEntity]:
        ...

    def get_subitem_content(self, module_slug: str, subitem_slug: str) -> CadastroModuleData:
        ...


class SragCopilotOutputPort(Protocol):
    """Outbound Port para o motor de busca híbrida e geração ancorada SRAG."""

    def query_normative_knowledge(
        self, question: str, orgao_id: str, module_slug: str | None = None
    ) -> SragAnswerEntity:
        ...
