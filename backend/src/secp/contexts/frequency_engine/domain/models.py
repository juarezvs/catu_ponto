from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
from typing import Optional


MONTHLY_OVERTIME_CAP_MINUTES = 16 * 60  # 16h/mês conforme Portaria SJAM-DIREF 135/2025
INTRADAY_MIN_BREAK_MINUTES = 60         # RN-02: mínimo 1h para jornada de 8h
INTRADAY_MAX_BREAK_MINUTES = 120        # RN-02: máximo 2h para jornada de 8h


class DailyCalculationStatus(str, Enum):
    REGULAR = "REGULAR"
    CREDIT_AUTHORIZED = "CREDIT_AUTHORIZED"
    NON_COMPUTABLE_OVERTIME = "EXCEDENTE_NAO_COMPUTAVEL"
    DEBIT = "DEBITO"
    TOLERANCE_COVERED = "TOLERANCIA_APLICADA"
    INCONSISTENT_BREAK = "INCONSISTENCIA_INTERVALO"
    ODD_CLOCK_PARITY = "INCONSISTENCIA_PARIDADE"
    HOLIDAY_OR_RECESS = "FERIADO_OU_RECESSO"
    ABONADO = "ABONADO"


@dataclass(frozen=True)
class WorkScheduleConfig:
    code: str
    daily_target_minutes: int  # 420 (7h ininterruptas) ou 480 (8h com intervalo)
    requires_break: bool
    break_min_minutes: int = INTRADAY_MIN_BREAK_MINUTES
    break_max_minutes: int = INTRADAY_MAX_BREAK_MINUTES
    daily_tolerance_minutes: int = 10  # RN-04 configurável pelo NUGEP (10 ou 15 min)


@dataclass(frozen=True)
class OvertimeAuthorization:
    id: str
    user_id: str
    authorized_by_manager_id: str
    reference_date: date
    max_authorized_minutes: int
    reason: str
    approved: bool = True


@dataclass(frozen=True)
class DailyCalculationResult:
    reference_date: date
    target_minutes: int
    worked_minutes: int
    break_minutes: int
    abono_minutes: int
    tolerance_applied_minutes: int
    credit_minutes: int
    non_computable_overtime_minutes: int
    debit_minutes: int
    status: DailyCalculationStatus
    inconsistency_reason: Optional[str] = None


@dataclass(frozen=True)
class DebitExpirationAlert:
    user_id: str
    reference_month: str
    debit_minutes: int
    compensation_deadline: date
    days_remaining: int
    sarh_payroll_deduction_risk: bool


class FrequencyRecalculationEngine:
    """
    Motor determinístico e idempotente de apuração diária e Banco de Horas (RF-Recálculo).
    Implementa RN-02, RN-04 e RN-05 em Python puro.
    """

    @staticmethod
    def calculate_day(
        reference_date: date,
        timestamps_sorted: tuple[datetime, ...],
        schedule: WorkScheduleConfig,
        is_holiday_or_weekend: bool = False,
        approved_abono_minutes: int = 0,
        overtime_auth: Optional[OvertimeAuthorization] = None,
        month_accumulated_credit_minutes: int = 0,
        monthly_cap_minutes: int = MONTHLY_OVERTIME_CAP_MINUTES,
    ) -> DailyCalculationResult:
        if is_holiday_or_weekend and not timestamps_sorted:
            return DailyCalculationResult(
                reference_date=reference_date,
                target_minutes=0,
                worked_minutes=0,
                break_minutes=0,
                abono_minutes=0,
                tolerance_applied_minutes=0,
                credit_minutes=0,
                non_computable_overtime_minutes=0,
                debit_minutes=0,
                status=DailyCalculationStatus.HOLIDAY_OR_RECESS,
            )

        if len(timestamps_sorted) % 2 != 0:
            return DailyCalculationResult(
                reference_date=reference_date,
                target_minutes=schedule.daily_target_minutes,
                worked_minutes=0,
                break_minutes=0,
                abono_minutes=approved_abono_minutes,
                tolerance_applied_minutes=0,
                credit_minutes=0,
                non_computable_overtime_minutes=0,
                debit_minutes=0,
                status=DailyCalculationStatus.ODD_CLOCK_PARITY,
                inconsistency_reason="Número ímpar de marcações no dia.",
            )

        worked_minutes = 0
        for idx in range(0, len(timestamps_sorted), 2):
            delta_min = int((timestamps_sorted[idx + 1] - timestamps_sorted[idx]).total_seconds() // 60)
            worked_minutes += max(0, delta_min)

        break_minutes = 0
        if len(timestamps_sorted) >= 4:
            break_minutes = max(
                0,
                int((timestamps_sorted[2] - timestamps_sorted[1]).total_seconds() // 60),
            )

        # RN-02: Jornada de 8h exige intervalo intrajornada de 1h a 2h
        if schedule.requires_break and worked_minutes > 0:
            if len(timestamps_sorted) < 4:
                return DailyCalculationResult(
                    reference_date=reference_date,
                    target_minutes=schedule.daily_target_minutes,
                    worked_minutes=worked_minutes,
                    break_minutes=0,
                    abono_minutes=approved_abono_minutes,
                    tolerance_applied_minutes=0,
                    credit_minutes=0,
                    non_computable_overtime_minutes=0,
                    debit_minutes=0,
                    status=DailyCalculationStatus.INCONSISTENT_BREAK,
                    inconsistency_reason="Jornada de 8h exige registro de intervalo intrajornada (1h a 2h).",
                )
            if break_minutes < schedule.break_min_minutes or break_minutes > schedule.break_max_minutes:
                return DailyCalculationResult(
                    reference_date=reference_date,
                    target_minutes=schedule.daily_target_minutes,
                    worked_minutes=worked_minutes,
                    break_minutes=break_minutes,
                    abono_minutes=approved_abono_minutes,
                    tolerance_applied_minutes=0,
                    credit_minutes=0,
                    non_computable_overtime_minutes=0,
                    debit_minutes=0,
                    status=DailyCalculationStatus.INCONSISTENT_BREAK,
                    inconsistency_reason=(
                        f"Intervalo de {break_minutes} min fora da faixa obrigatória "
                        f"({schedule.break_min_minutes}–{schedule.break_max_minutes} min)."
                    ),
                )

        effective_target = 0 if is_holiday_or_weekend else schedule.daily_target_minutes
        total_covered = worked_minutes + approved_abono_minutes
        diff = total_covered - effective_target

        # RN-04: Tolerância diária configurável antes de gerar débito
        if diff < 0:
            shortfall = abs(diff)
            if shortfall <= schedule.daily_tolerance_minutes:
                return DailyCalculationResult(
                    reference_date=reference_date,
                    target_minutes=effective_target,
                    worked_minutes=worked_minutes,
                    break_minutes=break_minutes,
                    abono_minutes=approved_abono_minutes,
                    tolerance_applied_minutes=shortfall,
                    credit_minutes=0,
                    non_computable_overtime_minutes=0,
                    debit_minutes=0,
                    status=DailyCalculationStatus.TOLERANCE_COVERED,
                )
            return DailyCalculationResult(
                reference_date=reference_date,
                target_minutes=effective_target,
                worked_minutes=worked_minutes,
                break_minutes=break_minutes,
                abono_minutes=approved_abono_minutes,
                tolerance_applied_minutes=0,
                credit_minutes=0,
                non_computable_overtime_minutes=0,
                debit_minutes=shortfall,
                status=DailyCalculationStatus.DEBIT,
            )

        if diff == 0:
            status = (
                DailyCalculationStatus.ABONADO
                if approved_abono_minutes > 0 and worked_minutes < effective_target
                else DailyCalculationStatus.REGULAR
            )
            return DailyCalculationResult(
                reference_date=reference_date,
                target_minutes=effective_target,
                worked_minutes=worked_minutes,
                break_minutes=break_minutes,
                abono_minutes=approved_abono_minutes,
                tolerance_applied_minutes=0,
                credit_minutes=0,
                non_computable_overtime_minutes=0,
                debit_minutes=0,
                status=status,
            )

        # RN-05: Horas excedentes só entram no Banco de Horas com autorização prévia + dentro do teto
        if overtime_auth is None or not overtime_auth.approved:
            return DailyCalculationResult(
                reference_date=reference_date,
                target_minutes=effective_target,
                worked_minutes=worked_minutes,
                break_minutes=break_minutes,
                abono_minutes=approved_abono_minutes,
                tolerance_applied_minutes=0,
                credit_minutes=0,
                non_computable_overtime_minutes=diff,
                debit_minutes=0,
                status=DailyCalculationStatus.NON_COMPUTABLE_OVERTIME,
                inconsistency_reason="Excedente sem autorização prévia da chefia imediata.",
            )

        remaining_month_cap = max(0, monthly_cap_minutes - month_accumulated_credit_minutes)
        computable_credit = min(diff, overtime_auth.max_authorized_minutes, remaining_month_cap)
        non_computable = max(0, diff - computable_credit)

        return DailyCalculationResult(
            reference_date=reference_date,
            target_minutes=effective_target,
            worked_minutes=worked_minutes,
            break_minutes=break_minutes,
            abono_minutes=approved_abono_minutes,
            tolerance_applied_minutes=0,
            credit_minutes=computable_credit,
            non_computable_overtime_minutes=non_computable,
            debit_minutes=0,
            status=(
                DailyCalculationStatus.CREDIT_AUTHORIZED
                if computable_credit > 0
                else DailyCalculationStatus.NON_COMPUTABLE_OVERTIME
            ),
        )
