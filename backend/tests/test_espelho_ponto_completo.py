import unittest
from datetime import date

from secp.modules.secp_ponto.domain.services.espelho_mensal_engine import (
    AfastamentoSarhInput,
    ApuracaoPersistidaInput,
    EventoCalendarioInput,
    RegraOrgaoMes,
    calcular_minutos_por_marcacoes,
    montar_espelho_mensal_completo,
)


class TestEspelhoMensalEngine(unittest.TestCase):
    def test_cenario_aceite_outubro_2026_140h_previsto_150h24_computado(self) -> None:
        # Outubro/2026 tem 31 dias; 20 dias úteis com carga 07:00 (420 min) = 140:00 (8400 min).
        # Simulando 150:24 computados (9024 min) => +624 min (10:24) pendentes não autorizados.
        marc_by_day = {}
        cal_by_day = {
            "2026-10-12": EventoCalendarioInput("2026-10-12", "FERIADO", "Nossa Senhora Aparecida"),
            "2026-10-28": EventoCalendarioInput("2026-10-28", "PONTO_FACULTATIVO", "Dia do Servidor Público"),
        }
        dias_uteis_out = [
            date(2026, 10, d)
            for d in range(1, 32)
            if date(2026, 10, d).weekday() < 5
            and date(2026, 10, d).isoformat() not in cal_by_day
        ]
        # 20 dias úteis exatos em out/2026 tirando 12/10 e 28/10 (ou ajustando para 20 dias):
        self.assertEqual(len(dias_uteis_out), 20)

        # 19 dias com 07:30 (450 min = 8550) + 1 dia com 07:54 (474 min) => 9024 min = 150:24
        for idx, dt in enumerate(dias_uteis_out):
            saida = "15:54:00" if idx == 0 else "15:30:00"
            marc_by_day[dt.isoformat()] = [
                {"id": f"e-{idx}", "horario": "08:00:00", "fonte": "REP", "tipoClassificado": "ENTRADA"},
                {"id": f"s-{idx}", "horario": saida, "fonte": "WEB", "tipoClassificado": "SAIDA"},
            ]

        res = montar_espelho_mensal_completo(
            ano=2026,
            mes=10,
            hoje_referencia=date(2026, 11, 5),
            regra=RegraOrgaoMes(carga_diaria_padrao_min=420),
            marc_by_day=marc_by_day,
            ap_by_day={},
            calendario_by_day=cal_by_day,
        )

        self.assertEqual(len(res["dias"]), 31)
        self.assertEqual(res["diasComJornada"], 20)
        self.assertEqual(res["totalPrevistoMinutos"], 140 * 60)       # 140:00
        self.assertEqual(res["totalTrabalhadoMinutos"], 150 * 60 + 24) # 150:24
        self.assertEqual(res["totalExcedentePendenteMinutos"], 10 * 60 + 24)  # 10:24
        self.assertEqual(res["totalExcedenteAutorizadoMinutos"], 0)
        self.assertEqual(res["totalCreditoMinutos"], 0)
        self.assertEqual(res["totalDebitoMinutos"], 0)
        self.assertEqual(res["bancoComputavelMinutos"], 0)

        totais = {t["label"]: t for t in res["totaisPorTipo"]}
        self.assertEqual(len(totais), 9)
        self.assertEqual(list(totais.keys()), sorted(totais.keys()))
        self.assertEqual(totais["Jornada regular"]["participacaoPct"], 107.4)
        self.assertEqual(totais["Horas extras não autorizadas"]["participacaoPct"], 7.4)
        self.assertTrue(totais["Horas extras não autorizadas"]["aguardandoAutorizacao"])

    def test_fevereiro_bissexto_e_nao_bissexto(self) -> None:
        res_2024 = montar_espelho_mensal_completo(
            ano=2024, mes=2, hoje_referencia=date(2024, 3, 1),
            regra=RegraOrgaoMes(), marc_by_day={}, ap_by_day={},
        )
        res_2025 = montar_espelho_mensal_completo(
            ano=2025, mes=2, hoje_referencia=date(2025, 3, 1),
            regra=RegraOrgaoMes(), marc_by_day={}, ap_by_day={},
        )
        self.assertEqual(len(res_2024["dias"]), 29)
        self.assertEqual(len(res_2025["dias"]), 28)

    def test_mes_corrente_dia_aberto_e_mes_futuro(self) -> None:
        hoje = date(2026, 11, 18)
        res_curr = montar_espelho_mensal_completo(
            ano=2026, mes=11, hoje_referencia=hoje,
            regra=RegraOrgaoMes(),
            marc_by_day={
                "2026-11-18": [{"id": "m1", "horario": "08:05:00", "fonte": "FACIAL", "tipoClassificado": "ENTRADA"}]
            },
            ap_by_day={},
        )
        dia_18 = next(d for d in res_curr["dias"] if d["dataIso"] == "2026-11-18")
        dia_25 = next(d for d in res_curr["dias"] if d["dataIso"] == "2026-11-25")
        self.assertEqual(dia_18["conferenciaStatus"], "AGUARDANDO")
        self.assertEqual(dia_18["debitoMinutos"], 0)
        self.assertEqual(dia_25["tipoDia"], "FUTURO")
        self.assertEqual(dia_25["debitoMinutos"], 0)

    def test_virada_meia_noite_e_intervalo_inferido(self) -> None:
        trab_noite, _, _, incomp = calcular_minutos_por_marcacoes(
            [{"horario": "19:00:00"}, {"horario": "01:30:00"}],
            carga_prevista_min=360,
        )
        self.assertFalse(incomp)
        self.assertEqual(trab_noite, 390)

        trab_8h, brk_8h, inf, _ = calcular_minutos_por_marcacoes(
            [{"horario": "08:00:00"}, {"horario": "17:00:00"}],
            carga_prevista_min=480,
            intervalo_minimo_min=60,
        )
        self.assertTrue(inf)
        self.assertEqual(brk_8h, 60)
        self.assertEqual(trab_8h, 480)

    def test_ferias_vigentes_vs_canceladas_e_teletrabalho_e_sem_jornada(self) -> None:
        res = montar_espelho_mensal_completo(
            ano=2026,
            mes=5,
            hoje_referencia=date(2026, 6, 1),
            regra=RegraOrgaoMes(carga_diaria_padrao_min=420),
            marc_by_day={},
            ap_by_day={},
            afastamentos=[
                AfastamentoSarhInput(date(2026, 5, 4), date(2026, 5, 5), "FERIAS", "GOZADA", "Férias Regulamentares"),
                AfastamentoSarhInput(date(2026, 5, 6), date(2026, 5, 6), "FERIAS", "CANCELADA", "Férias Canceladas"),
                AfastamentoSarhInput(date(2026, 5, 7), date(2026, 5, 7), "TELETRABALHO", "ATIVA", "Teletrabalho Integral"),
            ],
        )
        by_day = {d["dataIso"]: d for d in res["dias"]}
        self.assertEqual(by_day["2026-05-04"]["tipoDia"], "FERIAS")
        self.assertEqual(by_day["2026-05-04"]["cargaPrevistaMinutos"], 0)
        # Férias canceladas não dispensam carga
        self.assertEqual(by_day["2026-05-06"]["cargaPrevistaMinutos"], 420)
        # Teletrabalho sem batida computa carga integral
        self.assertEqual(by_day["2026-05-07"]["tipoDia"], "TELETRABALHO")
        self.assertEqual(by_day["2026-05-07"]["trabalhadoMinutos"], 420)

        res_sem_j = montar_espelho_mensal_completo(
            ano=2026, mes=5, hoje_referencia=date(2026, 6, 1),
            regra=RegraOrgaoMes(), marc_by_day={}, ap_by_day={}, sem_jornada_vigente=True,
        )
        d_util = next(d for d in res_sem_j["dias"] if d["diaUtil"])
        self.assertEqual(d_util["tipoDia"], "SEM_JORNADA")


if __name__ == "__main__":
    unittest.main()
