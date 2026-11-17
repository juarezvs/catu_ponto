from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class PermissaoEntity:
    id: str
    codigo: str
    recurso: str
    acao: str
    escopo: str
    descricao: str


@dataclass(frozen=True)
class PerfilEntity:
    id: str
    codigo: str
    nome: str
    descricao: str
    sistema: bool
    ativo: bool
    administrativo: bool
    global_scope: bool
    orgao_id: Optional[str] = None
    permissoes_codigos: frozenset[str] = field(default_factory=frozenset)


@dataclass(frozen=True)
class PerfilPermissaoOrgaoEntity:
    """Override seccional por Órgão (espelha `perfis_permissoes_orgaos` do secp_antigo)."""

    perfil_id: str
    permissao_codigo: str
    orgao_id: str
    permitida: bool


@dataclass(frozen=True)
class UsuarioPerfilEntity:
    """Vínculo Usuário × Perfil × Órgão (espelha `usuarios_perfis`)."""

    id: str
    usuario_id: str
    usuario_nome: str
    perfil_id: str
    perfil_codigo: str
    perfil_nome: str
    orgao_id: Optional[str]
    ativo: bool


@dataclass(frozen=True)
class LiberacaoRotinaEntity:
    """Feature gate global (espelha `rotinas_liberacoes`)."""

    id: str
    tipo: str  # MODULO | SUBITEM | ACAO
    chave: str
    descricao: str
    liberada: bool


class RbacPolicyEvaluator:
    """
    Domain Service puro responsável por resolver permissões efetivas segundo a
    arquitetura RBAC do secp_antigo:
    1) Se existir LiberacaoRotina bloqueada (`liberada == False`), nega acesso.
    2) Se perfil for administrativo/sistema com curinga `*`, permite (exceto se rotina bloqueada).
    3) Se existir Override em PerfilPermissaoOrgao para (perfil, permissao, orgao), aplica `override.permitida`.
    4) Caso contrário, verifica se a permissão está atribuída ao perfil na matriz base.
    """

    @staticmethod
    def is_permission_granted(
        perfil: PerfilEntity,
        permission_code: str,
        orgao_id: str,
        orgao_overrides: tuple[PerfilPermissaoOrgaoEntity, ...],
        rotinas: tuple[LiberacaoRotinaEntity, ...],
    ) -> bool:
        if not perfil.ativo:
            return False

        # 1. Verifica bloqueio global de rotina
        for rotina in rotinas:
            if not rotina.liberada and (
                rotina.chave == permission_code
                or permission_code.startswith(f"{rotina.chave}:")
            ):
                return False

        # 2. MASTER é reconhecido como administrador raiz (recebe todas as permissões antes dos bloqueios de rotina)
        if perfil.codigo == "MASTER" or "*" in perfil.permissoes_codigos:
            # Verifica se há bloqueio explícito em override seccional
            for ov in orgao_overrides:
                if (
                    ov.perfil_id == perfil.id
                    and ov.orgao_id == orgao_id
                    and ov.permissao_codigo == permission_code
                ):
                    return ov.permitida
            return True

        # 3. Verifica override seccional por órgão (precedência sobre matriz base)
        for ov in orgao_overrides:
            if (
                ov.perfil_id == perfil.id
                and ov.orgao_id == orgao_id
                and ov.permissao_codigo == permission_code
            ):
                return ov.permitida

        # 4. Matriz base + compatibilidade controlada (:subordinados <-> :chefia)
        if permission_code in perfil.permissoes_codigos:
            return True
        if permission_code.endswith(":chefia"):
            alt = permission_code.replace(":chefia", ":subordinados")
            if alt in perfil.permissoes_codigos:
                return True
        if permission_code.endswith(":subordinados"):
            alt = permission_code.replace(":subordinados", ":chefia")
            if alt in perfil.permissoes_codigos:
                return True
        return False

    @staticmethod
    def resolve_effective_permissions(
        perfil: PerfilEntity,
        all_permissions: tuple[PermissaoEntity, ...],
        orgao_id: str,
        orgao_overrides: tuple[PerfilPermissaoOrgaoEntity, ...],
        rotinas: tuple[LiberacaoRotinaEntity, ...],
    ) -> frozenset[str]:
        granted = []
        for perm in all_permissions:
            if RbacPolicyEvaluator.is_permission_granted(
                perfil=perfil,
                permission_code=perm.codigo,
                orgao_id=orgao_id,
                orgao_overrides=orgao_overrides,
                rotinas=rotinas,
            ):
                granted.append(perm.codigo)

        if "*" in perfil.permissoes_codigos:
            # Preserva curinga apenas para permissões não explicitamente negadas por override/rotina
            blocked = {
                ov.permissao_codigo
                for ov in orgao_overrides
                if ov.perfil_id == perfil.id and ov.orgao_id == orgao_id and not ov.permitida
            }
            if not blocked and all(r.liberada for r in rotinas):
                granted.append("*")

        return frozenset(granted)
