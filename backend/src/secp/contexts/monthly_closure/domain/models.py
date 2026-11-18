from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
import hashlib
from typing import Optional

from secp.contexts.monthly_closure.domain.exceptions import (
    ClosedCompetencePeriodError,
    InvalidClosureTransitionError,
    MissingSeiProcessError,
)


class MonthlyClosureStatus(str, Enum):
    """RN-07: Estados do espelho mensal."""

    OPEN = "OPEN"
    PENDING_SERVER_SIGNATURE = "PENDING_SERVER_SIGNATURE"
    SIGNED_BY_SERVER = "SIGNED_BY_SERVER"
    HOMOLOGATED_BY_MANAGER = "HOMOLOGATED_BY_MANAGER"
    CLOSED_BY_RH = "CLOSED_BY_RH"


IMMUTABLE_STATES = frozenset({
    MonthlyClosureStatus.HOMOLOGATED_BY_MANAGER,
    MonthlyClosureStatus.CLOSED_BY_RH,
})

ALLOWED_CLOSURE_TRANSITIONS: dict[MonthlyClosureStatus, frozenset[MonthlyClosureStatus]] = {
    MonthlyClosureStatus.OPEN: frozenset({MonthlyClosureStatus.PENDING_SERVER_SIGNATURE}),
    MonthlyClosureStatus.PENDING_SERVER_SIGNATURE: frozenset({MonthlyClosureStatus.SIGNED_BY_SERVER}),
    MonthlyClosureStatus.SIGNED_BY_SERVER: frozenset({MonthlyClosureStatus.HOMOLOGATED_BY_MANAGER}),
    MonthlyClosureStatus.HOMOLOGATED_BY_MANAGER: frozenset({MonthlyClosureStatus.CLOSED_BY_RH}),
    MonthlyClosureStatus.CLOSED_BY_RH: frozenset(),
}


@dataclass(frozen=True)
class MonthlyClosureRecord:
    id: str
    user_id: str
    year: int
    month: int
    status: MonthlyClosureStatus
    snapshot_sha256: Optional[str] = None
    signed_by_server_at: Optional[datetime] = None
    homologated_by_manager_id: Optional[str] = None
    closed_by_rh_id: Optional[str] = None
    sei_rectification_process: Optional[str] = None


class MonthlyClosurePolicy:
    """Regras puras de imutabilidade e retificação via SEI (RN-07)."""

    @staticmethod
    def ensure_mutable(status: MonthlyClosureStatus, sei_process_number: Optional[str] = None) -> None:
        if status in IMMUTABLE_STATES and not sei_process_number:
            raise ClosedCompetencePeriodError(
                f"Competência em estado '{status.value}' é estritamente imutável. "
                "Qualquer retificação exige processo SEI formal."
            )

    @staticmethod
    def validate_transition(current: MonthlyClosureStatus, target: MonthlyClosureStatus) -> None:
        allowed = ALLOWED_CLOSURE_TRANSITIONS.get(current, frozenset())
        if target not in allowed:
            raise InvalidClosureTransitionError(
                f"Transição de fechamento inválida: '{current.value}' -> '{target.value}'."
            )

    @staticmethod
    def validate_sei_rectification(sei_process_number: str, justification: str) -> str:
        cleaned = (sei_process_number or "").strip()
        if len(cleaned) < 6:
            raise MissingSeiProcessError(
                "Número de processo SEI inválido ou ausente para retificação retroativa."
            )
        if len((justification or "").strip()) < 10:
            raise MissingSeiProcessError(
                "Justificativa formal com mínimo de 10 caracteres é obrigatória para retificação SEI."
            )
        return cleaned

    @staticmethod
    def compute_snapshot_hash(user_id: str, year: int, month: int, total_worked_min: int, balance_min: int) -> str:
        raw = f"{user_id}|{year:04d}-{month:02d}|{total_worked_min}|{balance_min}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()
