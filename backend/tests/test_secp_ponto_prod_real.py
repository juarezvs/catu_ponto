import unittest
from fastapi import HTTPException

from secp.modules.secp_identidade.infrastructure.di_container import (
    get_redis_cache_gateway,
)
from secp.modules.secp_ponto.infrastructure.adapters.inbound.real_ponto_router import (
    CriarSolicitacaoRealRequest,
    criar_solicitacao_real,
    get_real_dashboard,
    get_real_espelho_mensal,
    get_real_rbac_context,
    get_real_regulamentacao,
    list_real_orgaos,
)
from secp.modules.secp_ponto.infrastructure.di_container import (
    get_prod_real_ponto_repository,
)


class TestSecpPontoProdReal(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.repo = get_prod_real_ponto_repository()
        cls.redis = get_redis_cache_gateway()

    def test_redis_ping_is_healthy(self) -> None:
        self.assertTrue(self.redis.is_healthy())

    def test_list_real_orgaos_returns_sjam(self) -> None:
        orgaos = list_real_orgaos(repo=self.repo)
        self.assertIsInstance(orgaos, list)
        self.assertGreaterEqual(len(orgaos), 1)
        siglas = {o["sigla"] for o in orgaos}
        self.assertIn("SJAM", siglas)

    def test_resolve_real_servidor_am200385_and_dashboard(self) -> None:
        data = get_real_dashboard(matricula="AM200385", repo=self.repo)
        self.assertEqual(data["servidor"]["matricula"], "AM200385")
        self.assertEqual(data["servidor"]["orgaoSigla"], "SJAM")
        self.assertIn("regulamentacao", data)
        self.assertIn("marcacoesHoje", data)

    def test_real_rbac_context_am200385(self) -> None:
        data = get_real_rbac_context(matricula="AM200385", repo=self.repo)
        self.assertEqual(data["servidor"]["matricula"], "AM200385")
        self.assertIsInstance(data["perfisVinculados"], list)
        self.assertGreaterEqual(len(data["permissoes"]), 1)

    def test_real_regulamentacao_sjam(self) -> None:
        reg = get_real_regulamentacao(orgao="SJAM", repo=self.repo)
        self.assertEqual(reg["orgaoSigla"], "SJAM")
        self.assertEqual(reg["limiteMarcacoesDia"], 6)
        self.assertGreater(reg["limiteCreditoMensalMinutos"], 0)

    def test_real_espelho_mensal_reads_apuracoes_diarias(self) -> None:
        espelho = get_real_espelho_mensal(
            matricula="AM200385", ano=2025, mes=10, repo=self.repo
        )
        self.assertEqual(espelho["competencia"], "10/2025")
        self.assertIsInstance(espelho["dias"], list)
        cached = self.redis.get_json("secp:prod_real:espelho:v4:AM200385:2025:10")
        self.assertIsNotNone(cached)

    def test_real_solicitacoes_validation_rejects_blank_desc(self) -> None:
        with self.assertRaises(HTTPException) as ctx:
            criar_solicitacao_real(
                payload=CriarSolicitacaoRealRequest(
                    matricula="AM200385",
                    tipo="AJUSTE_PONTO",
                    data_referencia="2026-11-17",
                    descricao="          ",
                ),
                repo=self.repo,
            )
        self.assertEqual(ctx.exception.status_code, 422)

    def test_auth_login_rejects_invalid_password(self) -> None:
        with self.assertRaises(ValueError):
            self.repo.autenticar_usuario_real("AM200385", "senha_incorreta_123")


if __name__ == "__main__":
    unittest.main()
