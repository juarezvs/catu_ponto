from typing import Optional
from secp.modules.secp_identidade.application.ports.output_ports import (
    IdentityRepositoryOutputPort,
)
from secp.modules.secp_identidade.application.ports.rbac_ports import (
    RbacManagementInputPort,
    RbacMatrixSnapshot,
    RbacRepositoryOutputPort,
)
from secp.modules.secp_identidade.domain.entities.rbac_models import (
    LiberacaoRotinaEntity,
    PerfilEntity,
    RbacPolicyEvaluator,
    UsuarioPerfilEntity,
)


class RbacManagementUseCase(RbacManagementInputPort):
    """
    Caso de Uso Central do SECP Identidade:
    Gerencia Perfis, Matriz de Permissões, Overrides por Órgão, Vínculos Usuário×Perfil
    e Liberações de Rotina, além de avaliar autorizações para todos os módulos do SECP.
    """

    def __init__(
        self,
        rbac_repo: RbacRepositoryOutputPort,
        identity_repo: IdentityRepositoryOutputPort,
    ) -> None:
        self._rbac_repo = rbac_repo
        self._identity_repo = identity_repo

    def get_full_matrix(self) -> RbacMatrixSnapshot:
        return self._rbac_repo.get_snapshot()

    def check_authorization(
        self, user_id: str, orgao_id: str, permission_code: str
    ) -> bool:
        user = self._identity_repo.get_user_by_id(user_id)
        if user is None:
            return False

        snap = self._rbac_repo.get_snapshot()
        perfil = next(
            (p for p in snap.perfis if p.codigo == user.role_code), None
        )
        if perfil is None:
            return user.has_permission(permission_code)

        return RbacPolicyEvaluator.is_permission_granted(
            perfil=perfil,
            permission_code=permission_code,
            orgao_id=orgao_id,
            orgao_overrides=snap.orgao_overrides,
            rotinas=snap.rotinas,
        )

    def create_perfil(
        self, codigo: str, nome: str, descricao: str, administrativo: bool, global_scope: bool
    ) -> PerfilEntity:
        return self._rbac_repo.create_perfil(
            codigo=codigo,
            nome=nome,
            descricao=descricao,
            administrativo=administrativo,
            global_scope=global_scope,
        )

    def update_perfil(
        self, perfil_id: str, nome: str, descricao: str, ativo: bool
    ) -> PerfilEntity:
        return self._rbac_repo.update_perfil(
            perfil_id=perfil_id, nome=nome, descricao=descricao, ativo=ativo
        )

    def delete_perfil(self, perfil_id: str) -> bool:
        return self._rbac_repo.delete_perfil(perfil_id=perfil_id)

    def toggle_perfil_permissao(self, perfil_id: str, permissao_codigo: str) -> PerfilEntity:
        return self._rbac_repo.toggle_perfil_permissao(
            perfil_id=perfil_id, permissao_codigo=permissao_codigo
        )

    def set_orgao_override(
        self, perfil_id: str, orgao_id: str, permissao_codigo: str, permitida: Optional[bool]
    ) -> None:
        self._rbac_repo.set_orgao_override(
            perfil_id=perfil_id,
            orgao_id=orgao_id,
            permissao_codigo=permissao_codigo,
            permitida=permitida,
        )

    def assign_usuario_perfil(
        self, usuario_id: str, perfil_id: str, orgao_id: Optional[str]
    ) -> UsuarioPerfilEntity:
        return self._rbac_repo.assign_usuario_perfil(
            usuario_id=usuario_id, perfil_id=perfil_id, orgao_id=orgao_id
        )

    def remove_usuario_perfil(self, vinculo_id: str) -> bool:
        return self._rbac_repo.remove_usuario_perfil(vinculo_id=vinculo_id)

    def toggle_rotina(self, rotina_id: str) -> LiberacaoRotinaEntity:
        return self._rbac_repo.toggle_rotina(rotina_id=rotina_id)
