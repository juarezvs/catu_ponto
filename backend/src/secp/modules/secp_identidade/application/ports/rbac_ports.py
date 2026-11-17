from dataclasses import dataclass
from typing import Optional, Protocol, Sequence
from secp.modules.secp_identidade.domain.entities.rbac_models import (
    LiberacaoRotinaEntity,
    PerfilEntity,
    PerfilPermissaoOrgaoEntity,
    PermissaoEntity,
    UsuarioPerfilEntity,
)


@dataclass(frozen=True)
class RbacMatrixSnapshot:
    perfis: tuple[PerfilEntity, ...]
    permissoes: tuple[PermissaoEntity, ...]
    orgao_overrides: tuple[PerfilPermissaoOrgaoEntity, ...]
    usuarios_perfis: tuple[UsuarioPerfilEntity, ...]
    rotinas: tuple[LiberacaoRotinaEntity, ...]


class RbacRepositoryOutputPort(Protocol):
    """Outbound Port central do motor RBAC (perfis, permissões, overrides por órgão e rotinas)."""

    def get_snapshot(self) -> RbacMatrixSnapshot:
        ...

    def get_perfil_by_codigo(self, codigo: str) -> PerfilEntity | None:
        ...

    def create_perfil(
        self, codigo: str, nome: str, descricao: str, administrativo: bool, global_scope: bool
    ) -> PerfilEntity:
        ...

    def update_perfil(
        self, perfil_id: str, nome: str, descricao: str, ativo: bool
    ) -> PerfilEntity:
        ...

    def delete_perfil(self, perfil_id: str) -> bool:
        ...

    def toggle_perfil_permissao(self, perfil_id: str, permissao_codigo: str) -> PerfilEntity:
        ...

    def set_orgao_override(
        self, perfil_id: str, orgao_id: str, permissao_codigo: str, permitida: Optional[bool]
    ) -> None:
        ...

    def assign_usuario_perfil(
        self, usuario_id: str, perfil_id: str, orgao_id: Optional[str]
    ) -> UsuarioPerfilEntity:
        ...

    def remove_usuario_perfil(self, vinculo_id: str) -> bool:
        ...

    def toggle_rotina(self, rotina_id: str) -> LiberacaoRotinaEntity:
        ...


class RbacManagementInputPort(Protocol):
    """Inbound Port para administração e avaliação RBAC usada por todos os módulos SECP."""

    def get_full_matrix(self) -> RbacMatrixSnapshot:
        ...

    def check_authorization(
        self, user_id: str, orgao_id: str, permission_code: str
    ) -> bool:
        ...

    def create_perfil(
        self, codigo: str, nome: str, descricao: str, administrativo: bool, global_scope: bool
    ) -> PerfilEntity:
        ...

    def update_perfil(
        self, perfil_id: str, nome: str, descricao: str, ativo: bool
    ) -> PerfilEntity:
        ...

    def delete_perfil(self, perfil_id: str) -> bool:
        ...

    def toggle_perfil_permissao(self, perfil_id: str, permissao_codigo: str) -> PerfilEntity:
        ...

    def set_orgao_override(
        self, perfil_id: str, orgao_id: str, permissao_codigo: str, permitida: Optional[bool]
    ) -> None:
        ...

    def assign_usuario_perfil(
        self, usuario_id: str, perfil_id: str, orgao_id: Optional[str]
    ) -> UsuarioPerfilEntity:
        ...

    def remove_usuario_perfil(self, vinculo_id: str) -> bool:
        ...

    def toggle_rotina(self, rotina_id: str) -> LiberacaoRotinaEntity:
        ...
