from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Protocol


@dataclass(frozen=True)
class AfpRawPunchRecord:
    nsr: str
    pis_or_cpf: str
    timestamp: datetime
    equipment_serial: str
    sha256_hash: str


@dataclass(frozen=True)
class SarhFunctionalData:
    matricula: str
    lotacao_codigo: str
    cargo: str
    em_ferias: bool
    afastamento_ativo: bool


@dataclass(frozen=True)
class SeiProcessValidation:
    process_number: str
    valid: bool
    unit_origin: str
    subject: str


class RepAfdCollectorPort(Protocol):
    """Porta para coleta de arquivos AFD / relógios físicos REP."""

    def parse_afd_batch(self, raw_content: str, equipment_serial: str) -> list[AfpRawPunchRecord]: ...


class BiometricReaderPort(Protocol):
    """Porta para leitores biométricos digitais."""

    def verify_template(self, matricula: str, template_payload: str) -> bool: ...


class FacialRecognitionPort(Protocol):
    """Porta para reconhecimento facial com liveness check."""

    def verify_liveness_and_match(self, matricula: str, frame_base64: str) -> bool: ...


class SarhIntegrationPort(Protocol):
    """Porta para integração com o SARH (dados funcionais, férias, afastamentos, desconto em folha)."""

    def fetch_functional_status(self, matricula: str, reference_date: date) -> SarhFunctionalData: ...

    def notify_expired_debit_for_payroll(self, matricula: str, competence: str, debit_minutes: int) -> str: ...


class SeiIntegrationPort(Protocol):
    """Porta para integração com o SEI (processos administrativos de retificação)."""

    def validate_rectification_process(self, process_number: str) -> SeiProcessValidation: ...
