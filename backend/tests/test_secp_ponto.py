import unittest
from secp.infrastructure.cache.redis_client import SecpRedisCacheGateway
from secp.modules.secp_identidade.infrastructure.adapters.outbound.postgres_redis_secp_adapters import (
    PostgresSecpIdentityRepository,
    RedisCachedIdentityRepository,
)
from secp.modules.secp_ponto.application.use_cases.ponto_use_cases import (
    GetBancoHorasUseCase,
    GetEspelhoPontoUseCase,
    GetPontoDashboardUseCase,
    HomologarServidorMesUseCase,
    ListHomologacaoQueueUseCase,
    RegistrarPontoUseCase,
)
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    classificar_tipo_marcacao_por_sequencia,
    determinar_proxima_acao,
)
from secp.modules.secp_ponto.application.use_cases.ponto_crud_use_cases import (
    PontoResourceCrudUseCase,
)
from secp.modules.secp_ponto.infrastructure.adapters.outbound.postgres_redis_ponto_crud_repository import (
    PostgresRedisPontoCrudRepository,
)
from secp.modules.secp_ponto.infrastructure.adapters.outbound.postgres_redis_ponto_repository import (
    PostgresRedisPontoRepository,
)


class TestSecpPontoModule(unittest.TestCase):
    def setUp(self) -> None:
        redis_gw = SecpRedisCacheGateway()
        self.id_repo = RedisCachedIdentityRepository(
            PostgresSecpIdentityRepository(), redis_gw
        )
        self.ponto_repo = PostgresRedisPontoRepository(redis_gateway=redis_gw)
        self.dashboard_uc = GetPontoDashboardUseCase(self.ponto_repo, self.id_repo)
        self.registrar_uc = RegistrarPontoUseCase(self.ponto_repo)
        self.espelho_uc = GetEspelhoPontoUseCase(self.ponto_repo)
        self.banco_uc = GetBancoHorasUseCase(self.ponto_repo)
        self.homolog_list_uc = ListHomologacaoQueueUseCase(self.ponto_repo)
        self.homolog_uc = HomologarServidorMesUseCase(self.ponto_repo)

    def test_classificacao_dinamica_sequencial_do_dia(self) -> None:
        self.assertEqual(classificar_tipo_marcacao_por_sequencia(0, False), "ENTRADA")
        self.assertEqual(classificar_tipo_marcacao_por_sequencia(1, False), "SAIDA_INTERVALO")
        self.assertEqual(classificar_tipo_marcacao_por_sequencia(2, False), "RETORNO_INTERVALO")
        self.assertEqual(classificar_tipo_marcacao_por_sequencia(3, False), "SAIDA")
        # Jornada 7h ininterrupta
        self.assertEqual(classificar_tipo_marcacao_por_sequencia(1, True), "SAIDA")

    def test_fluxo_registro_ponto_e_timeline_4_posicoes(self) -> None:
        dash_inicial = self.dashboard_uc.execute("servidor")
        self.assertEqual(dash_inicial.proxima_acao_codigo, "ENTRADA")
        self.assertTrue(dash_inicial.exige_biometria_facial)

        m1 = self.registrar_uc.execute("servidor", fonte="BIOMETRIA_FACIAL")
        self.assertEqual(m1.tipo, "ENTRADA")

        dash_pos_entrada = self.dashboard_uc.execute("servidor")
        self.assertEqual(dash_pos_entrada.proxima_acao_codigo, "SAIDA_INTERVALO")
        self.assertFalse(dash_pos_entrada.exige_biometria_facial)
        self.assertTrue(dash_pos_entrada.timeline_dia[0].concluido)

    def test_banco_horas_teto_16h_e_espelho_recesso(self) -> None:
        banco = self.banco_uc.execute("admin")
        self.assertEqual(banco.limite_mensal_minutos, 960)
        espelho = self.espelho_uc.execute("admin", 2026, 11)
        situacoes = [e.situacao for e in espelho]
        self.assertIn("Recesso forense", situacoes)

    def test_homologacao_chefia_prioridade_e_aprovacao(self) -> None:
        fila = self.homolog_list_uc.execute(2026, 11)
        self.assertEqual(fila[0].status, "CRITICO")
        atualizado = self.homolog_uc.execute("hom-03", "admin")
        self.assertEqual(atualizado.status, "HOMOLOGADO")

    def test_crud_completo_para_recursos_secp_ponto(self) -> None:
        crud_uc = PontoResourceCrudUseCase(
            PostgresRedisPontoCrudRepository(redis_gateway=SecpRedisCacheGateway())
        )
        # Create
        criado = crud_uc.create_record(
            "pessoas",
            {
                "matricula": "MAT-99999",
                "nome": "João da Silva Teste",
                "cargo": "Técnico Judiciário",
                "departamento": "NUTEC • SJAM",
                "escala": "JOR-7H (7h Ininterruptas)",
                "status": "Ativo",
            },
        )
        self.assertEqual(criado["matricula"], "MAT-99999")

        # Read with filter
        lista = crud_uc.list_records("pessoas", search="MAT-99999")
        self.assertEqual(lista.total, 1)

        # Update
        atualizado = crud_uc.update_record(
            "pessoas", criado["id"], {"status": "Férias"}
        )
        self.assertEqual(atualizado["status"], "Férias")

        # Delete
        removido = crud_uc.delete_record("pessoas", criado["id"])
        self.assertTrue(removido)
        self.assertEqual(crud_uc.list_records("pessoas", search="MAT-99999").total, 0)


if __name__ == "__main__":
    unittest.main()
