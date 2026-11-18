from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from enum import Enum
import hashlib
from typing import Optional

from secp.contexts.clocking.domain.exceptions import DuplicateClockEntryError


ANTI_DUPLICITY_SECONDS = 5 * 60  # RN-03: 5 minutos


class LotacaoCode(str, Enum):
    """RN-01: Lotações oficiais da Seção Judiciária do Amazonas."""

    SJAM_MANAUS = "SJAM-MANAUS"
    SSJ_TABATINGA = "SSJ-TABATINGA"
    UAA_TEFE = "UAA-TEFE"


LOTACAO_TIMEZONE_MAP: dict[LotacaoCode, str] = {
    LotacaoCode.SJAM_MANAUS: "America/Manaus",       # UTC-4
    LotacaoCode.SSJ_TABATINGA: "America/Rio_Branco",  # UTC-5 (fuso local de Tabatinga)
    LotacaoCode.UAA_TEFE: "America/Manaus",          # UTC-4
}


def resolve_timezone_for_lotacao(lotacao_codigo: str) -> str:
    normalized = (lotacao_codigo or "").strip().upper()
    for lot, tz in LOTACAO_TIMEZONE_MAP.items():
        if lot.value == normalized:
            return tz
    if "TABATINGA" in normalized:
        return "America/Rio_Branco"
    return "America/Manaus"


@dataclass(frozen=True)
class ClockEntry:
    id: str
    user_id: str
    matricula: str
    lotacao_codigo: str
    timestamp_local: datetime
    reference_date: date
    timezone_iana: str
    entry_type: str  # ENTRADA | SAIDA_INTERVALO | RETORNO_INTERVALO | SAIDA
    source: str      # FACIAL_WEB | WEB | REP_AFD | BIOMETRIA
    sha256_hash: str
    observation: Optional[str] = None


class ClockingPolicy:
    """Regras puras de registro de ponto (RN-01, RN-03, RNF-SHA256)."""

    @staticmethod
    def validate_anti_duplicity(
        last_entry_timestamp: Optional[datetime],
        new_entry_timestamp: datetime,
        min_interval_seconds: int = ANTI_DUPLICITY_SECONDS,
    ) -> None:
        if last_entry_timestamp is None:
            return
        delta = (new_entry_timestamp - last_entry_timestamp).total_seconds()
        if delta < min_interval_seconds:
            raise DuplicateClockEntryError(
                seconds_since_last=max(0, int(delta)),
                min_interval_seconds=min_interval_seconds,
            )

    @staticmethod
    def compute_integrity_hash(
        matricula: str,
        timestamp_iso: str,
        source: str,
        entry_type: str,
        lotacao_codigo: str,
    ) -> str:
        payload = f"{matricula}|{timestamp_iso}|{source}|{entry_type}|{lotacao_codigo}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    @staticmethod
    def verify_integrity_hash(entry: ClockEntry) -> bool:
        expected = ClockingPolicy.compute_integrity_hash(
            matricula=entry.matricula,
            timestamp_iso=entry.timestamp_local.isoformat(),
            source=entry.source,
            entry_type=entry.entry_type,
            lotacao_codigo=entry.lotacao_codigo,
        )
        return expected == entry.sha256_hash
