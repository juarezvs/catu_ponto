from catuponto.domain.entities.cadastro_item import CadastroModuleData
from secp.modules.secp_identidade.application.ports.input_ports import (
    AuthenticateSsoInputPort,
    GetAuthorizedHubModulesInputPort,
    GetModuleWorkspaceInputPort,
    GetSubitemResourceInputPort,
    HubLauncherResult,
    ModuleWorkspaceResult,
    QuerySragCopilotInputPort,
    SsoAuthResult,
)
from secp.modules.secp_identidade.application.ports.output_ports import (
    IdentityRepositoryOutputPort,
    ModuleNavigationOutputPort,
    SragCopilotOutputPort,
)
from secp.modules.secp_identidade.application.ports.rbac_ports import (
    RbacRepositoryOutputPort,
)
from secp.modules.secp_identidade.domain.entities.identity_models import (
    SragAnswerEntity,
    UserIdentity,
)
from secp.modules.secp_identidade.domain.entities.rbac_models import (
    RbacPolicyEvaluator,
)
from secp.modules.secp_identidade.domain.exceptions import (
    SecpAccessDeniedException,
    SecpEntityNotFoundException,
)


class AuthenticateSsoUseCase(AuthenticateSsoInputPort):
    """Caso de Uso: Realiza login SSO e resolve contexto inicial de Órgão/Unidade e RBAC."""

    def __init__(self, identity_repo: IdentityRepositoryOutputPort) -> None:
        self._identity_repo = identity_repo

    def execute(self, user_id: str, orgao_id: str | None = None) -> SsoAuthResult:
        user = self._identity_repo.get_user_by_id(user_id)
        if user is None:
            raise SecpEntityNotFoundException(f"Credencial SSO '{user_id}' não localizada.")

        orgaos = tuple(self._identity_repo.list_orgaos())
        target_orgao_id = orgao_id or user.default_orgao_id
        active_orgao = self._identity_repo.get_orgao_by_id(target_orgao_id) or orgaos[0]

        token = f"secp-sso-jwt.{user.id}.{active_orgao.id}.{user.role_code.lower()}"
        return SsoAuthResult(
            token=token,
            user=user,
            active_orgao=active_orgao,
            available_orgaos=orgaos,
            all_profiles=tuple(self._identity_repo.list_users()),
        )


class GetAuthorizedHubModulesUseCase(GetAuthorizedHubModulesInputPort):
    """Caso de Uso: Filtra os 6 módulos do Hub Central usando o motor RBAC central (Perfis + Overrides + Rotinas)."""

    def __init__(
        self,
        identity_repo: IdentityRepositoryOutputPort,
        rbac_repo: RbacRepositoryOutputPort | None = None,
    ) -> None:
        self._identity_repo = identity_repo
        self._rbac_repo = rbac_repo

    def execute(self, user_id: str, orgao_id: str | None = None) -> HubLauncherResult:
        user = self._identity_repo.get_user_by_id(user_id)
        if user is None:
            raise SecpEntityNotFoundException(f"Usuário '{user_id}' não localizado.")

        orgaos = tuple(self._identity_repo.list_orgaos())
        target_orgao_id = orgao_id or user.default_orgao_id
        active_orgao = self._identity_repo.get_orgao_by_id(target_orgao_id) or orgaos[0]

        all_modules = self._identity_repo.list_modules()
        if self._rbac_repo is not None:
            snap = self._rbac_repo.get_snapshot()
            perfil = next((p for p in snap.perfis if p.codigo == user.role_code), None)
            if perfil is not None:
                authorized_modules = tuple(
                    mod
                    for mod in all_modules
                    if RbacPolicyEvaluator.is_permission_granted(
                        perfil=perfil,
                        permission_code=mod.required_permission,
                        orgao_id=active_orgao.id,
                        orgao_overrides=snap.orgao_overrides,
                        rotinas=snap.rotinas,
                    )
                )
            else:
                authorized_modules = ()
        else:
            authorized_modules = tuple(
                mod
                for mod in all_modules
                if user.can_access_module(mod.slug, orgao_id=active_orgao.id)
            )

        return HubLauncherResult(
            user=user,
            active_orgao=active_orgao,
            available_orgaos=orgaos,
            modules=authorized_modules,
        )


def _resolve_user_with_rbac(
    user: UserIdentity, orgao_id: str, rbac_repo: RbacRepositoryOutputPort | None
) -> UserIdentity:
    if rbac_repo is None:
        return user
    snap = rbac_repo.get_snapshot()
    perfil = next((p for p in snap.perfis if p.codigo == user.role_code), None)
    if perfil is None:
        return user
    effective_perms = RbacPolicyEvaluator.resolve_effective_permissions(
        perfil=perfil,
        all_permissions=snap.permissoes,
        orgao_id=orgao_id,
        orgao_overrides=snap.orgao_overrides,
        rotinas=snap.rotinas,
    )
    allowed_mods = frozenset(
        ["*"]
        if "*" in effective_perms
        else [p.split(":")[0] for p in effective_perms if p.endswith(":access")]
    )
    return UserIdentity(
        id=user.id,
        matricula=user.matricula,
        name=user.name,
        email=user.email,
        role_code=user.role_code,
        role_name=user.role_name,
        default_orgao_id=user.default_orgao_id,
        avatar_initials=user.avatar_initials,
        allowed_modules=allowed_mods,
        permissions=effective_perms,
    )


class GetModuleWorkspaceUseCase(GetModuleWorkspaceInputPort):
    """
    Caso de Uso: Valida acesso RBAC ao módulo selecionado via motor central SECP Identidade,
    filtra a Sidebar Primária e a Sidebar Secundária de subitens pelas permissões efetivas.
    """

    def __init__(
        self,
        identity_repo: IdentityRepositoryOutputPort,
        navigation_repo: ModuleNavigationOutputPort,
        rbac_repo: RbacRepositoryOutputPort | None = None,
    ) -> None:
        self._identity_repo = identity_repo
        self._navigation_repo = navigation_repo
        self._rbac_repo = rbac_repo

    def execute(
        self, user_id: str, module_slug: str, orgao_id: str | None = None
    ) -> ModuleWorkspaceResult:
        raw_user = self._identity_repo.get_user_by_id(user_id)
        if raw_user is None:
            raise SecpEntityNotFoundException(f"Usuário '{user_id}' não localizado.")

        orgaos = tuple(self._identity_repo.list_orgaos())
        target_orgao_id = orgao_id or raw_user.default_orgao_id
        active_orgao = self._identity_repo.get_orgao_by_id(target_orgao_id) or orgaos[0]

        user = _resolve_user_with_rbac(raw_user, active_orgao.id, self._rbac_repo)

        module = self._identity_repo.get_module_by_slug(module_slug)
        if module is None:
            raise SecpEntityNotFoundException(f"Módulo '{module_slug}' não existe no SECP.")

        if not user.can_access_module(module.slug, orgao_id=active_orgao.id):
            raise SecpAccessDeniedException(
                f"Acesso negado: o papel '{user.role_name}' não possui habilitação para o módulo '{module.name}' no órgão {active_orgao.sigla}."
            )

        raw_menu = self._navigation_repo.get_module_menu_tree(module_slug)
        filtered_menu = tuple(
            filtered
            for item in raw_menu
            if (filtered := item.filter_for_user(user)) is not None
        )

        dashboard_content = self._navigation_repo.get_subitem_content(
            module_slug=module_slug, subitem_slug="dashboard"
        )

        return ModuleWorkspaceResult(
            module=module,
            user=user,
            active_orgao=active_orgao,
            menu_items=filtered_menu,
            dashboard_content=dashboard_content,
        )


class GetSubitemResourceUseCase(GetSubitemResourceInputPort):
    """Caso de Uso: Retorna os dados de um subitem validando permissão efetiva no motor RBAC."""

    def __init__(
        self,
        identity_repo: IdentityRepositoryOutputPort,
        navigation_repo: ModuleNavigationOutputPort,
        rbac_repo: RbacRepositoryOutputPort | None = None,
    ) -> None:
        self._identity_repo = identity_repo
        self._navigation_repo = navigation_repo
        self._rbac_repo = rbac_repo

    def execute(
        self, user_id: str, module_slug: str, subitem_slug: str
    ) -> CadastroModuleData:
        raw_user = self._identity_repo.get_user_by_id(user_id)
        if raw_user is None:
            raise SecpEntityNotFoundException(f"Usuário '{user_id}' não localizado.")

        user = _resolve_user_with_rbac(raw_user, raw_user.default_orgao_id, self._rbac_repo)

        if not user.can_access_module(module_slug):
            raise SecpAccessDeniedException(
                f"O papel '{user.role_name}' não tem acesso ao módulo '{module_slug}'."
            )

        content = self._navigation_repo.get_subitem_content(
            module_slug=module_slug, subitem_slug=subitem_slug
        )
        if not user.has_permission(content.required_permission):
            raise SecpAccessDeniedException(
                f"Permissão insuficiente ({content.required_permission}) para acessar '{content.title}'."
            )
        return content


class QuerySragCopilotUseCase(QuerySragCopilotInputPort):
    """Caso de Uso: Executa consulta estruturada SRAG respeitando o escopo do Órgão ativo."""

    def __init__(
        self,
        identity_repo: IdentityRepositoryOutputPort,
        srag_port: SragCopilotOutputPort,
    ) -> None:
        self._identity_repo = identity_repo
        self._srag_port = srag_port

    def execute(
        self, user_id: str, orgao_id: str, question: str, module_slug: str | None = None
    ) -> SragAnswerEntity:
        user = self._identity_repo.get_user_by_id(user_id)
        if user is None:
            raise SecpEntityNotFoundException(f"Usuário '{user_id}' não localizado.")

        return self._srag_port.query_normative_knowledge(
            question=question, orgao_id=orgao_id, module_slug=module_slug
        )
