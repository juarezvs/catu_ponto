import unittest
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.modules.secp_identidade.application.use_cases.identity_use_cases import (
    GetAuthorizedHubModulesUseCase,
    GetModuleWorkspaceUseCase,
)
from secp.modules.secp_identidade.application.use_cases.rbac_use_cases import (
    RbacManagementUseCase,
)
from secp.modules.secp_identidade.domain.exceptions import SecpAccessDeniedException
from secp.modules.secp_identidade.infrastructure.adapters.outbound.in_memory_secp_repository import (
    InMemorySecpNavigationRepository,
)
from secp.modules.secp_identidade.infrastructure.adapters.outbound.postgres_redis_rbac_repository import (
    PostgresRedisRbacRepository,
)
from secp.modules.secp_identidade.infrastructure.adapters.outbound.postgres_redis_secp_adapters import (
    PostgresSecpIdentityRepository,
)


class TestSecpIdentidadeRbacEngine(unittest.TestCase):
    def setUp(self) -> None:
        self.redis_gw = SecpRedisCacheGateway()
        self.id_repo = PostgresSecpIdentityRepository()
        self.rbac_repo = PostgresRedisRbacRepository(redis_gateway=self.redis_gw)
        self.nav_repo = InMemorySecpNavigationRepository()

        self.rbac_uc = RbacManagementUseCase(self.rbac_repo, self.id_repo)
        self.hub_uc = GetAuthorizedHubModulesUseCase(self.id_repo, self.rbac_repo)
        self.ws_uc = GetModuleWorkspaceUseCase(self.id_repo, self.nav_repo, self.rbac_repo)

    def test_18_perfis_e_master_raiz_carregados(self) -> None:
        snap = self.rbac_repo.get_snapshot()
        self.assertEqual(len(snap.perfis), 18)
        self.assertTrue(
            self.rbac_uc.check_authorization("secp.master", "sjam", "perfis:gerenciar:seccional")
        )

    def test_excecao_producao_servidor_sjto_registro_web(self) -> None:
        # Anexo A.2 do Documento Único: SERVIDOR na SJTO pode registrar-web, na SJAM não
        self.assertTrue(
            self.rbac_uc.check_authorization("servidor", "sjto", "marcacoes:registrar-web:proprio")
        )
        self.assertFalse(
            self.rbac_uc.check_authorization("servidor", "sjam", "marcacoes:registrar-web:proprio")
        )

    def test_toggle_permissao_em_perfil_reflete_nos_modulos(self) -> None:
        hub_antes = self.hub_uc.execute("secap", "sjam")
        self.assertIn("secp-folha", [m.slug for m in hub_antes.modules])

        self.rbac_uc.toggle_perfil_permissao("perf-secap", "secp-folha:access")

        hub_depois = self.hub_uc.execute("secap", "sjam")
        self.assertNotIn("secp-folha", [m.slug for m in hub_depois.modules])
        with self.assertRaises(SecpAccessDeniedException):
            self.ws_uc.execute("secap", "secp-folha", "sjam")

    def test_override_seccional_por_orgao_prevalece_sobre_matriz(self) -> None:
        self.rbac_uc.set_orgao_override("perf-chefia", "sjam", "cadastros:pessoas:read", False)
        self.assertFalse(self.rbac_uc.check_authorization("chefia", "sjam", "cadastros:pessoas:read"))
        self.assertTrue(self.rbac_uc.check_authorization("chefia", "sjdf", "cadastros:pessoas:read"))

    def test_liberacao_rotina_bloqueada_oculta_para_todos(self) -> None:
        self.rbac_uc.toggle_rotina("rot-3")
        hub_master = self.hub_uc.execute("secp.master", "sjam")
        self.assertNotIn("secp-ferias", [m.slug for m in hub_master.modules])


if __name__ == "__main__":
    unittest.main()
