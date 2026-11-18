import unittest
from secp.modules.secp_cadastros.domain.catalog import CADASTROS_LIST
from secp.modules.secp_cadastros.infrastructure.adapters.inbound.cadastros_router import (
    get_cadastros_repository,
)


class TestSecpCadastrosProdReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.repo = get_cadastros_repository()

    def test_catalog_has_all_27_cadastros(self) -> None:
        cat = self.repo.list_catalog()
        self.assertEqual(len(cat), 27)
        slugs = {c["slug"] for c in cat}
        self.assertIn("orgaos", slugs)
        self.assertIn("servidores", slugs)
        self.assertIn("tipos-equipamento-biometrico", slugs)
        self.assertIn("equipamentos-biometricos", slugs)
        self.assertIn("configuracoes-globais", slugs)

    def test_all_26_schemas_and_lists_execute_cleanly(self) -> None:
        for cdef in CADASTROS_LIST:
            with self.subTest(slug=cdef.slug):
                schema = self.repo.get_schema(cdef.slug)
                self.assertEqual(schema["slug"], cdef.slug)
                res = self.repo.list_records(cdef.slug, page=1, page_size=5)
                self.assertIn("items", res)
                self.assertIn("total", res)

    def test_crud_roundtrip_on_fusos_horarios(self) -> None:
        created = self.repo.create_record(
            "fusos-horarios",
            {
                "rotulo": "Teste Fuso Temporario",
                "valor": "America/Test_Zone",
                "descricao": "Criado via teste automatizado",
                "ativo": True,
            },
        )
        rec_id = created["id"]
        self.assertEqual(created["rotulo"], "Teste Fuso Temporario")

        updated = self.repo.update_record(
            "fusos-horarios",
            rec_id,
            {"rotulo": "Teste Fuso Atualizado", "ativo": False},
        )
        self.assertEqual(updated["rotulo"], "Teste Fuso Atualizado")
        self.assertFalse(updated["ativo"])

        deleted = self.repo.delete_record("fusos-horarios", rec_id)
        self.assertTrue(deleted["deleted"])

    def test_search_across_all_grid_columns_and_fks(self) -> None:
        # Busca por FK resolvida (nome do servidor em lotacoes)
        res_lot = self.repo.list_records("lotacoes", search="FLAVIO", page=1, page_size=5)
        self.assertGreaterEqual(res_lot["total"], 1)

        # Busca em todos os 26 cadastros com termo não-vazio não deve gerar erro SQL
        for cdef in CADASTROS_LIST:
            with self.subTest(slug=cdef.slug):
                res = self.repo.list_records(cdef.slug, search="AM", page=1, page_size=5)
                self.assertIn("items", res)

    def test_column_filters_json(self) -> None:
        res = self.repo.list_records(
            "orgaos",
            filters_json='[{"column": "sigla", "operator": "equals", "value": "SJAM"}]',
            page=1,
            page_size=5,
        )
        self.assertEqual(res["total"], 1)
        self.assertEqual(res["items"][0]["sigla"], "SJAM")

    def test_unidades_organizacionais_hierarquia_e_uf_do_orgao(self) -> None:
        res = self.repo.list_records(
            "unidades-organizacionais",
            search=r"SJAM\DIREF\SECAD\NUTEC",
            page=1,
            page_size=20,
        )
        self.assertGreaterEqual(res["total"], 2)
        overrides = res["displayOverrides"]
        siglas_hier = {v["sigla"] for v in overrides.values()}
        ufs = {v["uf"] for v in overrides.values()}
        self.assertIn(r"SJAM\DIREF\SECAD\NUTEC", siglas_hier)
        self.assertIn(r"SJAM\DIREF\SECAD\NUTEC\SESIS", siglas_hier)
        self.assertIn("AM", ufs)

    def test_sorting_by_column_asc_desc(self) -> None:
        asc = self.repo.list_records("orgaos", sort_by="sigla", sort_dir="asc", page=1, page_size=5)
        desc = self.repo.list_records("orgaos", sort_by="sigla", sort_dir="desc", page=1, page_size=5)
        self.assertNotEqual(asc["items"][0]["sigla"], desc["items"][0]["sigla"])

    def test_organograma_sjam_returns_tree(self) -> None:
        self.repo._redis.invalidate_prefix("secp:prod_real:cadastros:organograma:")
        org = self.repo.get_organograma("SJAM")
        self.assertIsNotNone(org["root"])
        self.assertEqual(org["totalUnidades"], 270)
        self.assertGreaterEqual(len(org["orgaos"]), 1)

    def test_identificadores_ponto_agrupados_por_servidor(self) -> None:
        sc = self.repo.get_schema("identificadores-ponto")
        self.assertNotIn("valor_normalizado", sc["columns"])
        res = self.repo.list_records("identificadores-ponto", page=1, page_size=20)
        sids = [r["servidor_id"] for r in res["items"]]
        self.assertEqual(len(sids), len(set(sids)))


if __name__ == "__main__":
    unittest.main()
