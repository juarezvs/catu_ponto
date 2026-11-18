from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from enum import Enum
import hashlib
from typing import Optional

from secp.contexts.abono_workflow.domain.exceptions import (
    InvalidAbonoTransitionError,
    MissingRequiredAttachmentError,
)
from secp.contexts.identity_access.domain.models import ActiveSessionContext


class AbonoStatus(str, Enum):
    """RN-06: Estados obrigatórios do fluxo de abonos e justificativas."""

    DRAFT = "DRAFT"
    SUBMITTED = "SUBMITTED"
    UNDER_ANALYSIS = "UNDER_ANALYSIS"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    CANCELED = "CANCELED"


ALLOWED_ABONO_TRANSITIONS: dict[AbonoStatus, frozenset[AbonoStatus]] = {
    AbonoStatus.DRAFT: frozenset({AbonoStatus.SUBMITTED, AbonoStatus.CANCELED}),
    AbonoStatus.SUBMITTED: frozenset({AbonoStatus.UNDER_ANALYSIS, AbonoStatus.CANCELED}),
    AbonoStatus.UNDER_ANALYSIS: frozenset({AbonoStatus.APPROVED, AbonoStatus.REJECTED}),
    AbonoStatus.APPROVED: frozenset(),
    AbonoStatus.REJECTED: frozenset(),
    AbonoStatus.CANCELED: frozenset(),
}

REASONS_REQUIRING_ATTACHMENT = frozenset({
    "ATESTADO_MEDICO",
    "LICENCA",
    "SERVICO_EXTERNO",
    "FALHA_TECNICA",
})


@dataclass(frozen=True)
class AbonoAttachment:
    id: str
    filename: str
    mime_type: str
    size_bytes: int
    sha256_hash: str

    @staticmethod
    def compute_file_hash(content_bytes: bytes) -> str:
        return hashlib.sha256(content_bytes).hexdigest()


@dataclass(frozen=True)
class AbonoRequest:
    id: str
    protocol: str
    user_id: str
    lotacao_codigo: str
    reason_code: str
    reference_date: date
    minutes_requested: int
    justification: str
    status: AbonoStatus
    attachments: tuple[AbonoAttachment, ...] = ()
    cid_code: Optional[str] = None
    clinical_notes: Optional[str] = None
    decision_notes: Optional[str] = None
    decided_by: Optional[str] = None


class AbonoWorkflowPolicy:
    """Regras puras de transição de estados e obrigatoriedade de anexo (RN-06)."""

    @staticmethod
    def validate_submission(abono: AbonoRequest) -> None:
        if abono.reason_code.upper() in REASONS_REQUIRING_ATTACHMENT and len(abono.attachments) == 0:
            raise MissingRequiredAttachmentError(
                f"O motivo '{abono.reason_code}' exige anexo comprobatório (PDF ou imagem)."
            )

    @staticmethod
    def validate_transition(current: AbonoStatus, target: AbonoStatus) -> None:
        allowed = ALLOWED_ABONO_TRANSITIONS.get(current, frozenset())
        if target not in allowed:
            raise InvalidAbonoTransitionError(
                f"Transição inválida de '{current.value}' para '{target.value}'."
            )


class LgpdMedicalPrivacyPolicy:
    """RNF-LGPD: Mascara CID e diagnóstico clínico para chefia imediata."""

    @staticmethod
    def sanitize_for_viewer(abono: AbonoRequest, session: ActiveSessionContext) -> AbonoRequest:
        if session.can_view_lgpd_clinical_data(abono.user_id):
            return abono
        return AbonoRequest(
            id=abono.id,
            protocol=abono.protocol,
            user_id=abono.user_id,
            lotacao_codigo=abono.lotacao_codigo,
            reason_code=abono.reason_code,
            reference_date=abono.reference_date,
            minutes_requested=abono.minutes_requested,
            justification=abono.justification,
            status=abono.status,
            attachments=abono.attachments,
            cid_code="[RESTRITO LGPD]",
            clinical_notes="[Diagnóstico clínico restrito ao servidor e setor médico/NUGEP]",
            decision_notes=abono.decision_notes,
            decided_by=abono.decided_by,
        )
