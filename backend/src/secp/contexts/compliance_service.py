from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Optional
import uuid
from zoneinfo import ZoneInfo

from secp.contexts.abono_workflow.domain.models import (
    AbonoAttachment,
    AbonoRequest,
    AbonoStatus,
    AbonoWorkflowPolicy,
    LgpdMedicalPrivacyPolicy,
)
from secp.contexts.audit_compliance.domain.models import AuditLogEntry
from secp.contexts.clocking.domain.exceptions import DailyClockLimitReachedError, DuplicateClockEntryError
from secp.contexts.clocking.domain.models import (
    ClockEntry,
    ClockingPolicy,
    resolve_timezone_for_lotacao,
)
from secp.contexts.frequency_engine.domain.models import (
    DailyCalculationResult,
    DebitExpirationAlert,
    FrequencyRecalculationEngine,
    OvertimeAuthorization,
    WorkScheduleConfig,
)
from secp.contexts.identity_access.domain.exceptions import (
    InvalidActiveProfileError,
    ScopeAccessDeniedError,
)
from secp.contexts.identity_access.domain.models import (
    ActiveSessionContext,
    AuthProviderPort,
    NormativeProfileCode,
    normalize_profile_code,
)
from secp.contexts.integrations.domain.ports import SarhIntegrationPort, SeiIntegrationPort
from secp.contexts.monthly_closure.domain.models import (
    MonthlyClosurePolicy,
    MonthlyClosureRecord,
    MonthlyClosureStatus,
)


class Portaria135ComplianceService:
    """
    Application Service unificado para conformidade integral com a Portaria SJAM-DIREF 135/2025.
    Orquestra os 7 Bounded Contexts, RF-Recálculo Automático e RNF-Auditoria Imutável.
    """

    def __init__(
        self,
        auth_provider: AuthProviderPort,
        sarh_port: SarhIntegrationPort,
        sei_port: SeiIntegrationPort,
    ) -> None:
        self._auth_provider = auth_provider
        self._sarh = sarh_port
        self._sei = sei_port

        # Estado transacional em memória (espelhando as tabelas de compliance)
        self._sessions: dict[str, ActiveSessionContext] = {}
        self._clock_entries: dict[str, list[ClockEntry]] = {}
        self._overtime_auths: dict[tuple[str, date], OvertimeAuthorization] = {}
        self._abonos: dict[str, AbonoRequest] = {}
        self._daily_calculations: dict[tuple[str, date], DailyCalculationResult] = {}
        self._closures: dict[tuple[str, int, int], MonthlyClosureRecord] = {}
        self._audit_logs: list[AuditLogEntry] = []
        self._holidays_by_lotacao: dict[str, set[date]] = {
            "SJAM-MANAUS": set(),
            "SSJ-TABATINGA": set(),
            "UAA-TEFE": set(),
        }
        self._schedules_by_user: dict[str, WorkScheduleConfig] = {}

    def _record_audit(
        self,
        user_id: str,
        active_profile: str,
        action: str,
        entity_type: str,
        entity_id: str,
        before_state: Optional[dict[str, Any]],
        after_state: Optional[dict[str, Any]],
        ip_address: str = "127.0.0.1",
        user_agent: str = "secp-api",
    ) -> AuditLogEntry:
        now = datetime.now()
        digest = AuditLogEntry.compute_entry_hash(
            user_id=user_id,
            active_profile=active_profile,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            timestamp_iso=now.isoformat(),
        )
        entry = AuditLogEntry(
            id=str(uuid.uuid4()),
            user_id=user_id,
            active_profile=active_profile,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            before_state=before_state,
            after_state=after_state,
            ip_address=ip_address,
            user_agent=user_agent,
            timestamp=now,
            integrity_hash=digest,
        )
        self._audit_logs.append(entry)
        return entry

    def authenticate(
        self,
        matricula: str,
        password: str,
        requested_profile_code: Optional[str] = None,
        ip_address: str = "127.0.0.1",
        user_agent: str = "secp-api",
    ) -> ActiveSessionContext:
        user = self._auth_provider.authenticate(matricula, password)
        profiles = tuple(user["profiles"])
        if not profiles:
            raise InvalidActiveProfileError("Usuário sem perfis ativos vinculados.")

        selected = profiles[0]
        if requested_profile_code:
            norm = normalize_profile_code(requested_profile_code)
            matched = [p for p in profiles if p.profile_code == norm and p.active]
            if not matched:
                raise InvalidActiveProfileError(
                    f"Perfil '{norm.value}' não vinculado ao usuário {matricula}."
                )
            selected = matched[0]

        session = ActiveSessionContext(
            session_id=str(uuid.uuid4()),
            user_id=user["user_id"],
            matricula=user["matricula"],
            user_name=user["name"],
            active_profile_id=selected.profile_id,
            active_profile_code=selected.profile_code,
            lotacao_codigo=selected.lotacao_codigo,
            provider=self._auth_provider.provider_name,
            available_profiles=profiles,
        )
        self._sessions[session.session_id] = session
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action="SESSION_LOGIN",
            entity_type="ActiveSessionContext",
            entity_id=session.session_id,
            before_state=None,
            after_state={"active_profile": session.active_profile_code.value, "provider": session.provider},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return session

    def get_session(self, session_id: str) -> ActiveSessionContext:
        session = self._sessions.get(session_id)
        if not session:
            raise InvalidActiveProfileError("Sessão inválida ou expirada.")
        return session

    def switch_active_profile(
        self,
        session_id: str,
        target_profile_id: str,
        ip_address: str = "127.0.0.1",
        user_agent: str = "secp-api",
    ) -> ActiveSessionContext:
        session = self.get_session(session_id)
        matched = [p for p in session.available_profiles if p.profile_id == target_profile_id and p.active]
        if not matched:
            raise InvalidActiveProfileError(
                f"Perfil '{target_profile_id}' não pertence ao usuário ou está inativo."
            )
        new_prof = matched[0]
        updated = ActiveSessionContext(
            session_id=session.session_id,
            user_id=session.user_id,
            matricula=session.matricula,
            user_name=session.user_name,
            active_profile_id=new_prof.profile_id,
            active_profile_code=new_prof.profile_code,
            lotacao_codigo=new_prof.lotacao_codigo,
            provider=session.provider,
            available_profiles=session.available_profiles,
        )
        self._sessions[session_id] = updated
        self._record_audit(
            user_id=updated.user_id,
            active_profile=updated.active_profile_code.value,
            action="SESSION_SWITCH_PROFILE",
            entity_type="ActiveSessionContext",
            entity_id=session_id,
            before_state={"active_profile": session.active_profile_code.value},
            after_state={"active_profile": updated.active_profile_code.value},
            ip_address=ip_address,
            user_agent=user_agent,
        )
        return updated

    def set_user_schedule(self, user_id: str, schedule: WorkScheduleConfig) -> None:
        self._schedules_by_user[user_id] = schedule

    def register_holiday(self, lotacao_codigo: str, holiday_date: date, session: ActiveSessionContext) -> None:
        if session.active_profile_code != NormativeProfileCode.DIRETOR_RH:
            raise ScopeAccessDeniedError("Apenas DIRETOR_RH (NUGEP) pode gerenciar feriados institucionais.")
        self._holidays_by_lotacao.setdefault(lotacao_codigo, set()).add(holiday_date)
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action="HOLIDAY_REGISTERED",
            entity_type="CalendarioInstitucional",
            entity_id=f"{lotacao_codigo}:{holiday_date.isoformat()}",
            before_state=None,
            after_state={"lotacao": lotacao_codigo, "date": holiday_date.isoformat()},
        )

    def _get_closure(self, user_id: str, year: int, month: int) -> MonthlyClosureRecord:
        key = (user_id, year, month)
        if key not in self._closures:
            self._closures[key] = MonthlyClosureRecord(
                id=str(uuid.uuid4()),
                user_id=user_id,
                year=year,
                month=month,
                status=MonthlyClosureStatus.OPEN,
            )
        return self._closures[key]

    def register_clock_entry(
        self,
        session: ActiveSessionContext,
        source: str = "FACIAL_WEB",
        now_override: Optional[datetime] = None,
        observation: Optional[str] = None,
        ip_address: str = "127.0.0.1",
        user_agent: str = "secp-api",
    ) -> tuple[ClockEntry, DailyCalculationResult]:
        if not session.can_mutate_clock_or_abono():
            raise ScopeAccessDeniedError(
                f"Perfil '{session.active_profile_code.value}' não pode registrar ou alterar batidas."
            )

        tz_name = resolve_timezone_for_lotacao(session.lotacao_codigo)
        now_local = now_override or datetime.now(ZoneInfo(tz_name)).replace(tzinfo=None)
        ref_date = now_local.date()

        closure = self._get_closure(session.user_id, ref_date.year, ref_date.month)
        MonthlyClosurePolicy.ensure_mutable(closure.status)

        user_entries = self._clock_entries.setdefault(session.user_id, [])
        today_entries = sorted(
            [e for e in user_entries if e.reference_date == ref_date],
            key=lambda e: e.timestamp_local,
        )

        last_ts = today_entries[-1].timestamp_local if today_entries else None
        try:
            ClockingPolicy.validate_anti_duplicity(last_ts, now_local)
        except DuplicateClockEntryError as exc:
            self._record_audit(
                user_id=session.user_id,
                active_profile=session.active_profile_code.value,
                action="CLOCK_ENTRY_DUPLICATE_BLOCKED",
                entity_type="ClockEntry",
                entity_id=session.user_id,
                before_state={"last_timestamp": last_ts.isoformat() if last_ts else None},
                after_state={"attempted_timestamp": now_local.isoformat(), "reason": str(exc)},
                ip_address=ip_address,
                user_agent=user_agent,
            )
            raise

        if len(today_entries) >= 6:
            raise DailyClockLimitReachedError("Limite diário de 6 batidas atingido.")

        schedule = self._schedules_by_user.get(
            session.user_id,
            WorkScheduleConfig(code="JOR-7H", daily_target_minutes=420, requires_break=False),
        )
        qtd = len(today_entries)
        if qtd == 0:
            entry_type = "ENTRADA"
        elif qtd == 1:
            entry_type = "SAIDA_INTERVALO" if schedule.requires_break else "SAIDA"
        elif qtd == 2:
            entry_type = "RETORNO_INTERVALO"
        else:
            entry_type = "SAIDA"

        sha256_hash = ClockingPolicy.compute_integrity_hash(
            matricula=session.matricula,
            timestamp_iso=now_local.isoformat(),
            source=source,
            entry_type=entry_type,
            lotacao_codigo=session.lotacao_codigo,
        )
        entry = ClockEntry(
            id=str(uuid.uuid4()),
            user_id=session.user_id,
            matricula=session.matricula,
            lotacao_codigo=session.lotacao_codigo,
            timestamp_local=now_local,
            reference_date=ref_date,
            timezone_iana=tz_name,
            entry_type=entry_type,
            source=source,
            sha256_hash=sha256_hash,
            observation=observation,
        )
        user_entries.append(entry)

        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action="CLOCK_ENTRY_REGISTERED",
            entity_type="ClockEntry",
            entity_id=entry.id,
            before_state=None,
            after_state={"timestamp": now_local.isoformat(), "type": entry_type, "sha256": sha256_hash},
            ip_address=ip_address,
            user_agent=user_agent,
        )

        daily_calc = self.recalculate_day(session.user_id, session.lotacao_codigo, ref_date)
        return entry, daily_calc

    def authorize_overtime(
        self,
        session: ActiveSessionContext,
        target_user_id: str,
        target_lotacao: str,
        reference_date: date,
        max_authorized_minutes: int,
        reason: str,
    ) -> OvertimeAuthorization:
        if session.active_profile_code not in (NormativeProfileCode.GESTOR, NormativeProfileCode.DIRETOR_RH):
            raise ScopeAccessDeniedError("Apenas GESTOR ou DIRETOR_RH pode autorizar horas excedentes.")
        if not session.can_access_user_data(target_user_id, target_lotacao):
            raise ScopeAccessDeniedError("Servidor fora do escopo da unidade do gestor.")

        auth = OvertimeAuthorization(
            id=str(uuid.uuid4()),
            user_id=target_user_id,
            authorized_by_manager_id=session.user_id,
            reference_date=reference_date,
            max_authorized_minutes=max_authorized_minutes,
            reason=reason,
            approved=True,
        )
        self._overtime_auths[(target_user_id, reference_date)] = auth
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action="OVERTIME_AUTHORIZED",
            entity_type="OvertimeAuthorization",
            entity_id=auth.id,
            before_state=None,
            after_state={"target_user_id": target_user_id, "max_minutes": max_authorized_minutes},
        )
        self.recalculate_day(target_user_id, target_lotacao, reference_date)
        return auth

    def recalculate_day(
        self, user_id: str, lotacao_codigo: str, reference_date: date
    ) -> DailyCalculationResult:
        entries = sorted(
            [
                e.timestamp_local
                for e in self._clock_entries.get(user_id, [])
                if e.reference_date == reference_date
            ]
        )
        schedule = self._schedules_by_user.get(
            user_id,
            WorkScheduleConfig(code="JOR-7H", daily_target_minutes=420, requires_break=False),
        )
        is_holiday = (
            reference_date.weekday() >= 5
            or reference_date in self._holidays_by_lotacao.get(lotacao_codigo, set())
        )
        approved_abono = sum(
            a.minutes_requested
            for a in self._abonos.values()
            if a.user_id == user_id
            and a.reference_date == reference_date
            and a.status == AbonoStatus.APPROVED
        )
        overtime_auth = self._overtime_auths.get((user_id, reference_date))
        month_credit_acc = sum(
            res.credit_minutes
            for (uid, dt), res in self._daily_calculations.items()
            if uid == user_id
            and dt.year == reference_date.year
            and dt.month == reference_date.month
            and dt != reference_date
        )

        result = FrequencyRecalculationEngine.calculate_day(
            reference_date=reference_date,
            timestamps_sorted=tuple(entries),
            schedule=schedule,
            is_holiday_or_weekend=is_holiday,
            approved_abono_minutes=approved_abono,
            overtime_auth=overtime_auth,
            month_accumulated_credit_minutes=month_credit_acc,
        )
        self._daily_calculations[(user_id, reference_date)] = result
        return result

    def create_abono(
        self,
        session: ActiveSessionContext,
        reason_code: str,
        reference_date: date,
        minutes_requested: int,
        justification: str,
        cid_code: Optional[str] = None,
        clinical_notes: Optional[str] = None,
        attachments: tuple[AbonoAttachment, ...] = (),
        submit_immediately: bool = False,
    ) -> AbonoRequest:
        if not session.can_mutate_clock_or_abono():
            raise ScopeAccessDeniedError("Perfil atual não pode criar solicitações de abono.")

        closure = self._get_closure(session.user_id, reference_date.year, reference_date.month)
        MonthlyClosurePolicy.ensure_mutable(closure.status)

        abono = AbonoRequest(
            id=str(uuid.uuid4()),
            protocol=f"ABN-{reference_date.strftime('%Y%m')}-{str(uuid.uuid4())[:6].upper()}",
            user_id=session.user_id,
            lotacao_codigo=session.lotacao_codigo,
            reason_code=reason_code,
            reference_date=reference_date,
            minutes_requested=minutes_requested,
            justification=justification,
            status=AbonoStatus.DRAFT,
            attachments=attachments,
            cid_code=cid_code,
            clinical_notes=clinical_notes,
        )
        if submit_immediately:
            AbonoWorkflowPolicy.validate_submission(abono)
            AbonoWorkflowPolicy.validate_transition(abono.status, AbonoStatus.SUBMITTED)
            abono = AbonoRequest(**{**abono.__dict__, "status": AbonoStatus.SUBMITTED})

        self._abonos[abono.id] = abono
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action="ABONO_CREATED",
            entity_type="AbonoRequest",
            entity_id=abono.id,
            before_state=None,
            after_state={"status": abono.status.value, "reason_code": reason_code},
        )
        return abono

    def transition_abono(
        self,
        session: ActiveSessionContext,
        abono_id: str,
        target_status: AbonoStatus,
        decision_notes: Optional[str] = None,
    ) -> AbonoRequest:
        abono = self._abonos.get(abono_id)
        if not abono:
            raise ValueError("Solicitação de abono não encontrada.")

        closure = self._get_closure(abono.user_id, abono.reference_date.year, abono.reference_date.month)
        MonthlyClosurePolicy.ensure_mutable(closure.status)

        if target_status in (AbonoStatus.UNDER_ANALYSIS, AbonoStatus.APPROVED, AbonoStatus.REJECTED):
            if session.active_profile_code not in (NormativeProfileCode.GESTOR, NormativeProfileCode.DIRETOR_RH):
                raise ScopeAccessDeniedError("Apenas GESTOR ou DIRETOR_RH pode analisar/decidir abonos.")
            if not session.can_access_user_data(abono.user_id, abono.lotacao_codigo):
                raise ScopeAccessDeniedError("Abono fora do escopo da unidade.")
        elif abono.user_id != session.user_id:
            raise ScopeAccessDeniedError("Apenas o próprio servidor pode enviar ou cancelar o rascunho.")

        if target_status == AbonoStatus.SUBMITTED:
            AbonoWorkflowPolicy.validate_submission(abono)

        AbonoWorkflowPolicy.validate_transition(abono.status, target_status)
        before_status = abono.status.value
        updated = AbonoRequest(
            **{
                **abono.__dict__,
                "status": target_status,
                "decision_notes": decision_notes or abono.decision_notes,
                "decided_by": session.user_id if target_status in (AbonoStatus.APPROVED, AbonoStatus.REJECTED) else abono.decided_by,
            }
        )
        self._abonos[abono_id] = updated
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action=f"ABONO_TRANSITION_{target_status.value}",
            entity_type="AbonoRequest",
            entity_id=abono_id,
            before_state={"status": before_status},
            after_state={"status": target_status.value},
        )
        if target_status == AbonoStatus.APPROVED:
            self.recalculate_day(updated.user_id, updated.lotacao_codigo, updated.reference_date)
        return LgpdMedicalPrivacyPolicy.sanitize_for_viewer(updated, session)

    def get_abono_for_viewer(self, session: ActiveSessionContext, abono_id: str) -> AbonoRequest:
        abono = self._abonos.get(abono_id)
        if not abono:
            raise ValueError("Abono não encontrado.")
        if not session.can_access_user_data(abono.user_id, abono.lotacao_codigo):
            raise ScopeAccessDeniedError("Sem permissão de escopo para visualizar este abono.")
        return LgpdMedicalPrivacyPolicy.sanitize_for_viewer(abono, session)

    def advance_monthly_closure(
        self,
        session: ActiveSessionContext,
        target_user_id: str,
        target_lotacao: str,
        year: int,
        month: int,
        target_status: MonthlyClosureStatus,
    ) -> MonthlyClosureRecord:
        if not session.can_access_user_data(target_user_id, target_lotacao):
            raise ScopeAccessDeniedError("Competência fora do escopo do perfil ativo.")

        if target_status == MonthlyClosureStatus.SIGNED_BY_SERVER and session.user_id != target_user_id:
            raise ScopeAccessDeniedError("Apenas o próprio servidor pode assinar seu espelho mensal.")
        if target_status == MonthlyClosureStatus.HOMOLOGATED_BY_MANAGER and session.active_profile_code != NormativeProfileCode.GESTOR:
            raise ScopeAccessDeniedError("Apenas GESTOR pode homologar espelhos mensais.")
        if target_status == MonthlyClosureStatus.CLOSED_BY_RH and session.active_profile_code != NormativeProfileCode.DIRETOR_RH:
            raise ScopeAccessDeniedError("Apenas DIRETOR_RH pode realizar fechamento global de competência.")

        rec = self._get_closure(target_user_id, year, month)
        MonthlyClosurePolicy.validate_transition(rec.status, target_status)

        total_worked = sum(
            r.worked_minutes
            for (uid, dt), r in self._daily_calculations.items()
            if uid == target_user_id and dt.year == year and dt.month == month
        )
        balance = sum(
            r.credit_minutes - r.debit_minutes
            for (uid, dt), r in self._daily_calculations.items()
            if uid == target_user_id and dt.year == year and dt.month == month
        )
        snap_hash = MonthlyClosurePolicy.compute_snapshot_hash(target_user_id, year, month, total_worked, balance)

        updated = MonthlyClosureRecord(
            id=rec.id,
            user_id=rec.user_id,
            year=year,
            month=month,
            status=target_status,
            snapshot_sha256=snap_hash,
            signed_by_server_at=datetime.now() if target_status == MonthlyClosureStatus.SIGNED_BY_SERVER else rec.signed_by_server_at,
            homologated_by_manager_id=session.user_id if target_status == MonthlyClosureStatus.HOMOLOGATED_BY_MANAGER else rec.homologated_by_manager_id,
            closed_by_rh_id=session.user_id if target_status == MonthlyClosureStatus.CLOSED_BY_RH else rec.closed_by_rh_id,
        )
        self._closures[(target_user_id, year, month)] = updated
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action=f"CLOSURE_{target_status.value}",
            entity_type="MonthlyClosureRecord",
            entity_id=updated.id,
            before_state={"status": rec.status.value},
            after_state={"status": updated.status.value, "snapshot_sha256": snap_hash},
        )
        return updated

    def rectify_closed_month_with_sei(
        self,
        session: ActiveSessionContext,
        target_user_id: str,
        year: int,
        month: int,
        sei_process_number: str,
        justification: str,
    ) -> MonthlyClosureRecord:
        if session.active_profile_code != NormativeProfileCode.DIRETOR_RH:
            raise ScopeAccessDeniedError("Retificação excepcional via SEI é restrita a DIRETOR_RH.")
        clean_sei = MonthlyClosurePolicy.validate_sei_rectification(sei_process_number, justification)
        sei_check = self._sei.validate_rectification_process(clean_sei)
        if not sei_check.valid:
            raise ValueError("Processo SEI inválido na integração SEI.")

        rec = self._get_closure(target_user_id, year, month)
        reopened = MonthlyClosureRecord(
            id=rec.id,
            user_id=rec.user_id,
            year=year,
            month=month,
            status=MonthlyClosureStatus.OPEN,
            snapshot_sha256=rec.snapshot_sha256,
            sei_rectification_process=clean_sei,
        )
        self._closures[(target_user_id, year, month)] = reopened
        self._record_audit(
            user_id=session.user_id,
            active_profile=session.active_profile_code.value,
            action="CLOSURE_RECTIFIED_SEI",
            entity_type="MonthlyClosureRecord",
            entity_id=reopened.id,
            before_state={"status": rec.status.value},
            after_state={"status": reopened.status.value, "sei_process": clean_sei},
        )
        return reopened

    def list_audit_logs(self, session: ActiveSessionContext) -> list[AuditLogEntry]:
        if session.active_profile_code not in (
            NormativeProfileCode.AUDITOR,
            NormativeProfileCode.DIRETOR_RH,
            NormativeProfileCode.ADMIN_TI,
        ):
            raise ScopeAccessDeniedError("Acesso às trilhas de auditoria restrito a AUDITOR, DIRETOR_RH ou ADMIN_TI.")
        return list(self._audit_logs)

    def check_debit_expiration_alerts(self, user_id: str, matricula: str, today: date) -> list[DebitExpirationAlert]:
        alerts: list[DebitExpirationAlert] = []
        debits_by_month: dict[tuple[int, int], int] = {}
        for (uid, dt), res in self._daily_calculations.items():
            if uid == user_id and res.debit_minutes > 0:
                debits_by_month[(dt.year, dt.month)] = debits_by_month.get((dt.year, dt.month), 0) + res.debit_minutes

        for (y, m), total_debit in debits_by_month.items():
            # Prazo até o último dia do mês subsequente
            next_month = 1 if m == 12 else m + 1
            next_year = y + 1 if m == 12 else y
            after_next = date(next_year + (1 if next_month == 12 else 0), 1 if next_month == 12 else next_month + 1, 1)
            deadline = after_next - timedelta(days=1)
            days_rem = (deadline - today).days
            if days_rem <= 15:
                self._sarh.notify_expired_debit_for_payroll(matricula, f"{y:04d}-{m:02d}", total_debit)
                alerts.append(
                    DebitExpirationAlert(
                        user_id=user_id,
                        reference_month=f"{y:04d}-{m:02d}",
                        debit_minutes=total_debit,
                        compensation_deadline=deadline,
                        days_remaining=days_rem,
                        sarh_payroll_deduction_risk=True,
                    )
                )
        return alerts
