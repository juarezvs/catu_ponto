from datetime import date, datetime, timedelta
import unittest

from secp.contexts.abono_workflow.domain.exceptions import MissingRequiredAttachmentError
from secp.contexts.abono_workflow.domain.models import AbonoAttachment, AbonoStatus
from secp.contexts.clocking.domain.exceptions import DuplicateClockEntryError
from secp.contexts.clocking.domain.models import ClockingPolicy, resolve_timezone_for_lotacao
from secp.contexts.compliance_service import Portaria135ComplianceService
from secp.contexts.frequency_engine.domain.models import (
    DailyCalculationStatus,
    FrequencyRecalculationEngine,
    WorkScheduleConfig,
)
from secp.contexts.identity_access.domain.exceptions import ScopeAccessDeniedError
from secp.contexts.identity_access.domain.models import NormativeProfileCode
from secp.contexts.integrations.infrastructure.adapters import (
    ActiveDirectoryAuthAdapter,
    StubSarhIntegrationAdapter,
    StubSeiIntegrationAdapter,
)
from secp.contexts.monthly_closure.domain.exceptions import ClosedCompetencePeriodError
from secp.contexts.monthly_closure.domain.models import MonthlyClosureStatus


class TestPortaria135Compliance(unittest.TestCase):
    def setUp(self) -> None:
        self.svc = Portaria135ComplianceService(
            auth_provider=ActiveDirectoryAuthAdapter(),
            sarh_port=StubSarhIntegrationAdapter(),
            sei_port=StubSeiIntegrationAdapter(),
        )

    def test_rn01_lotacao_timezones(self) -> None:
        self.assertEqual(resolve_timezone_for_lotacao("SJAM-MANAUS"), "America/Manaus")
        self.assertEqual(resolve_timezone_for_lotacao("SSJ-TABATINGA"), "America/Rio_Branco")
        self.assertEqual(resolve_timezone_for_lotacao("UAA-TEFE"), "America/Manaus")

    def test_rn03_anti_duplicity_5_min_and_audit_log(self) -> None:
        session = self.svc.authenticate("AM200385", "secp135", "SERVIDOR")
        t1 = datetime(2026, 11, 18, 8, 0, 0)
        entry, _ = self.svc.register_clock_entry(session, now_override=t1)
        self.assertTrue(ClockingPolicy.verify_integrity_hash(entry))

        with self.assertRaises(DuplicateClockEntryError):
            self.svc.register_clock_entry(session, now_override=t1 + timedelta(minutes=4))

        # 5 minutos exatos deve permitir
        entry2, _ = self.svc.register_clock_entry(session, now_override=t1 + timedelta(minutes=5))
        self.assertEqual(entry2.entry_type, "SAIDA")

        # AUDITOR lê trilha de auditoria (Read-Only) e confirma registro da tentativa bloqueada
        aud_session = self.svc.switch_active_profile(session.session_id, "prof-aud")
        logs = self.svc.list_audit_logs(aud_session)
        actions = [l.action for l in logs]
        self.assertIn("CLOCK_ENTRY_DUPLICATE_BLOCKED", actions)
        with self.assertRaises(ScopeAccessDeniedError):
            self.svc.register_clock_entry(aud_session, now_override=t1 + timedelta(minutes=10))

    def test_admin_ti_cannot_clock_or_abono(self) -> None:
        session = self.svc.authenticate("AM200385", "secp135", "ADMIN_TI")
        with self.assertRaises(ScopeAccessDeniedError):
            self.svc.register_clock_entry(session, now_override=datetime(2026, 11, 18, 8, 0, 0))

    def test_rn02_8h_intrajornada_break_validation(self) -> None:
        sched_8h = WorkScheduleConfig(code="JOR-8H", daily_target_minutes=480, requires_break=True)
        # Intervalo de apenas 30 min -> inconsistência
        res_bad = FrequencyRecalculationEngine.calculate_day(
            reference_date=date(2026, 11, 18),
            timestamps_sorted=(
                datetime(2026, 11, 18, 8, 0),
                datetime(2026, 11, 18, 12, 0),
                datetime(2026, 11, 18, 12, 30),
                datetime(2026, 11, 18, 16, 30),
            ),
            schedule=sched_8h,
        )
        self.assertEqual(res_bad.status, DailyCalculationStatus.INCONSISTENT_BREAK)

        # Intervalo de 1h (60 min) e 8h trabalhadas -> regular
        res_ok = FrequencyRecalculationEngine.calculate_day(
            reference_date=date(2026, 11, 18),
            timestamps_sorted=(
                datetime(2026, 11, 18, 8, 0),
                datetime(2026, 11, 18, 12, 0),
                datetime(2026, 11, 18, 13, 0),
                datetime(2026, 11, 18, 17, 0),
            ),
            schedule=sched_8h,
        )
        self.assertEqual(res_ok.status, DailyCalculationStatus.REGULAR)
        self.assertEqual(res_ok.worked_minutes, 480)

    def test_rn04_tolerance_and_rn05_overtime_authorization(self) -> None:
        session = self.svc.authenticate("AM200385", "secp135", "SERVIDOR")
        # 8h00 -> 16h00 = 480 min (60 min excedente sobre 7h=420 min) sem autorização prévia
        self.svc.register_clock_entry(session, now_override=datetime(2026, 11, 18, 8, 0))
        _, calc_unauth = self.svc.register_clock_entry(session, now_override=datetime(2026, 11, 18, 16, 0))
        self.assertEqual(calc_unauth.status, DailyCalculationStatus.NON_COMPUTABLE_OVERTIME)
        self.assertEqual(calc_unauth.credit_minutes, 0)
        self.assertEqual(calc_unauth.non_computable_overtime_minutes, 60)

        # Gestor autoriza 60 min -> recálculo automático transforma em crédito computável
        mgr = self.svc.switch_active_profile(session.session_id, "prof-gch")
        self.svc.authorize_overtime(
            session=mgr,
            target_user_id=session.user_id,
            target_lotacao="SJAM-MANAUS",
            reference_date=date(2026, 11, 18),
            max_authorized_minutes=60,
            reason="Demanda extraordinária de audiência",
        )
        recalc = self.svc.recalculate_day(session.user_id, "SJAM-MANAUS", date(2026, 11, 18))
        self.assertEqual(recalc.status, DailyCalculationStatus.CREDIT_AUTHORIZED)
        self.assertEqual(recalc.credit_minutes, 60)

    def test_rn06_abono_attachment_lgpd_masking_and_recalc(self) -> None:
        srv = self.svc.authenticate("AM200400", "secp135", "SERVIDOR")
        # Atestado médico sem anexo deve falhar ao submeter
        with self.assertRaises(MissingRequiredAttachmentError):
            self.svc.create_abono(
                session=srv,
                reason_code="ATESTADO_MEDICO",
                reference_date=date(2026, 11, 17),
                minutes_requested=420,
                justification="Consulta médica emergencial",
                cid_code="J06.9",
                clinical_notes="Infecção respiratória aguda",
                submit_immediately=True,
            )

        att = AbonoAttachment(
            id="att-1",
            filename="atestado.pdf",
            mime_type="application/pdf",
            size_bytes=1234,
            sha256_hash=AbonoAttachment.compute_file_hash(b"pdf-content"),
        )
        abono = self.svc.create_abono(
            session=srv,
            reason_code="ATESTADO_MEDICO",
            reference_date=date(2026, 11, 17),
            minutes_requested=420,
            justification="Atestado médico 1 dia",
            cid_code="J06.9",
            clinical_notes="Infecção respiratória aguda",
            attachments=(att,),
            submit_immediately=True,
        )

        # Gestor distinto (AM200385) analisa e aprova -> CID deve estar mascarado (RNF-LGPD)
        mgr = self.svc.authenticate("AM200385", "secp135", "GESTOR")
        self.svc.transition_abono(mgr, abono.id, AbonoStatus.UNDER_ANALYSIS)
        approved_for_mgr = self.svc.transition_abono(mgr, abono.id, AbonoStatus.APPROVED, "Deferido")
        self.assertEqual(approved_for_mgr.cid_code, "[RESTRITO LGPD]")

        # Diretor RH (NUGEP) visualiza CID original
        drh = self.svc.switch_active_profile(mgr.session_id, "prof-drh")
        visible_for_rh = self.svc.get_abono_for_viewer(drh, abono.id)
        self.assertEqual(visible_for_rh.cid_code, "J06.9")

        # Recálculo automático do dia abonado
        day_calc = self.svc.recalculate_day(srv.user_id, "SJAM-MANAUS", date(2026, 11, 17))
        self.assertEqual(day_calc.status, DailyCalculationStatus.ABONADO)

    def test_rn07_monthly_closure_immutability_and_sei_rectification(self) -> None:
        srv = self.svc.authenticate("AM200385", "secp135", "SERVIDOR")
        drh = self.svc.switch_active_profile(srv.session_id, "prof-drh")
        self.svc.advance_monthly_closure(drh, srv.user_id, "SJAM-MANAUS", 2026, 11, MonthlyClosureStatus.PENDING_SERVER_SIGNATURE)

        srv_again = self.svc.switch_active_profile(srv.session_id, "prof-srv")
        self.svc.advance_monthly_closure(srv_again, srv.user_id, "SJAM-MANAUS", 2026, 11, MonthlyClosureStatus.SIGNED_BY_SERVER)

        mgr = self.svc.switch_active_profile(srv.session_id, "prof-gch")
        self.svc.advance_monthly_closure(mgr, srv.user_id, "SJAM-MANAUS", 2026, 11, MonthlyClosureStatus.HOMOLOGATED_BY_MANAGER)

        # Após homologação, competência é estritamente imutável
        with self.assertRaises(ClosedCompetencePeriodError):
            self.svc.register_clock_entry(srv_again, now_override=datetime(2026, 11, 19, 8, 0))

        # Retificação exige DIRETOR_RH + processo SEI válido
        drh_again = self.svc.switch_active_profile(srv.session_id, "prof-drh")
        reopened = self.svc.rectify_closed_month_with_sei(
            session=drh_again,
            target_user_id=srv.user_id,
            year=2026,
            month=11,
            sei_process_number="0001234-55.2026.4.01.3200",
            justification="Retificação excepcional autorizada pela Diretoria do Foro.",
        )
        self.assertEqual(reopened.status, MonthlyClosureStatus.OPEN)


if __name__ == "__main__":
    unittest.main()
