from dataclasses import dataclass
from typing import Protocol, Sequence
from catuponto.domain.entities.cadastro_item import CadastroModuleData
from secp.modules.secp_identidade.domain.entities.identity_models import (
    MenuPrimaryItemEntity,
    OrgaoScope,
    SecpModuleDescriptor,
    SragAnswerEntity,
    UserIdentity,
)


@dataclass(frozen=True)
class SsoAuthResult:
    token: str
    user: UserIdentity
    active_orgao: OrgaoScope
    available_orgaos: tuple[OrgaoScope, ...]
    all_profiles: tuple[UserIdentity, ...]


@dataclass(frozen=True)
class HubLauncherResult:
    user: UserIdentity
    active_orgao: OrgaoScope
    available_orgaos: tuple[OrgaoScope, ...]
    modules: tuple[SecpModuleDescriptor, ...]


@dataclass(frozen=True)
class ModuleWorkspaceResult:
    module: SecpModuleDescriptor
    user: UserIdentity
    active_orgao: OrgaoScope
    menu_items: tuple[MenuPrimaryItemEntity, ...]
    dashboard_content: CadastroModuleData


class AuthenticateSsoInputPort(Protocol):
    """Inbound Port (Driving Port) para Login Único (SSO)."""

    def execute(self, user_id: str, orgao_id: str | None = None) -> SsoAuthResult:
        ...


class GetAuthorizedHubModulesInputPort(Protocol):
    """Inbound Port para listar os Cards de Módulos do Hub filtrados pelo RBAC."""

    def execute(self, user_id: str, orgao_id: str | None = None) -> HubLauncherResult:
        ...


class GetModuleWorkspaceInputPort(Protocol):
    """Inbound Port para carregar a estrutura de navegação (dupla sidebar) e dashboard de um módulo."""

    def execute(
        self, user_id: str, module_slug: str, orgao_id: str | None = None
    ) -> ModuleWorkspaceResult:
        ...


class GetSubitemResourceInputPort(Protocol):
    """Inbound Port para carregar os registros e KPIs de um subitem validando RBAC."""

    def execute(
        self, user_id: str, module_slug: str, subitem_slug: str
    ) -> CadastroModuleData:
        ...


class QuerySragCopilotInputPort(Protocol):
    """Inbound Port para consulta normativa ao Copiloto SRAG."""

    def execute(
        self, user_id: str, orgao_id: str, question: str, module_slug: str | None = None
    ) -> SragAnswerEntity:
        ...
