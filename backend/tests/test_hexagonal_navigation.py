import unittest
from catuponto.adapters.outbound.persistence.cadastro_repository import (
    InMemoryCadastroRepository,
)
from catuponto.adapters.outbound.persistence.in_memory_adapters import (
    InMemoryNavigationRepository,
    InMemoryUserRepository,
)
from catuponto.application.use_cases.navigation_use_cases import (
    GetModuleContentUseCase,
    GetUserNavigationUseCase,
)
from catuponto.domain.exceptions import AccessDeniedException


class TestHexagonalNavigationAndPermissions(unittest.TestCase):
    def setUp(self) -> None:
        self.user_repo = InMemoryUserRepository()
        self.nav_repo = InMemoryNavigationRepository()
        self.cadastro_repo = InMemoryCadastroRepository()
        self.nav_use_case = GetUserNavigationUseCase(self.user_repo, self.nav_repo)
        self.module_use_case = GetModuleContentUseCase(self.user_repo, self.cadastro_repo)

    def test_admin_sees_all_cadastros_subitems(self) -> None:
        result = self.nav_use_case.execute("admin")
        cadastros = next(item for item in result.items if item.id == "cadastros")
        subitem_ids = [
            sub.id for section in cadastros.sections for sub in section.items
        ]
        self.assertIn("pessoas", subitem_ids)
        self.assertIn("departamentos", subitem_ids)
        self.assertIn("orgaos", subitem_ids)
        self.assertIn("unidades", subitem_ids)
        self.assertIn("cargos", subitem_ids)
        self.assertIn("funcoes", subitem_ids)
        self.assertIn("feriados", subitem_ids)

    def test_coordenador_sees_only_permitted_cadastros_subitems(self) -> None:
        result = self.nav_use_case.execute("coordenador")
        cadastros = next(item for item in result.items if item.id == "cadastros")
        subitem_ids = [
            sub.id for section in cadastros.sections for sub in section.items
        ]
        self.assertEqual(
            subitem_ids,
            ["pessoas", "departamentos", "unidades", "feriados"],
        )
        # Seções sem itens permitidos (ex: CARREIRA & LOTAÇÃO) são removidas automaticamente
        section_ids = [s.id for s in cadastros.sections]
        self.assertNotIn("carreira-lotacao", section_ids)

    def test_unauthorized_module_raises_access_denied(self) -> None:
        with self.assertRaises(AccessDeniedException):
            self.module_use_case.execute(user_id="coordenador", slug="orgaos")


if __name__ == "__main__":
    unittest.main()
