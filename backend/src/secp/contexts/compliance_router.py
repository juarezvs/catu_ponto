from __future__ import annotations

from datetime import date, datetime
from functools import lru_cache
from typing import Any, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, Field

from secp.contexts.abono_workflow.domain.exceptions import AbonoWorkflowDomainError
from secp.contexts.abono_workflow.domain.models import AbonoAttachment, AbonoStatus
from secp.contexts.clocking.domain.exceptions import ClockingDomainError
from secp.contexts.compliance_service import Portaria135ComplianceService
from secp.contexts.identity_access.domain.exceptions import (
    AuthenticationFailedError,
    IdentityAccessDomainError,
    InvalidActiveProfileError,
    ScopeAccessDeniedError,
)
from secp.contexts.identity_access.domain.models import ActiveSessionContext
from secp.contexts.integrations.infrastructure.adapters import (
    ActiveDirectoryAuthAdapter,
    StubSarhIntegrationAdapter,
    StubSeiIntegrationAdapter,
)
from secp.contexts.monthly_closure.domain.exceptions import MonthlyClosureDomainError
from secp.contexts.monthly_closure.domain.models import MonthlyClosureStatus


compliance_router = APIRouter(
    prefix="/api/v1/secp/compliance",
    tags=["SECP Conformidade • Portaria SJAM-DIREF 135/2025"],
)


@lru_cache(maxsize=1)
def get_compliance_service() -> Portaria135ComplianceService:
    return Portaria135ComplianceService(
        auth_provider=ActiveDirectoryAuthAdapter(),
        sarh_port=StubSarhIntegrationAdapter(),
        sei_port=StubSeiIntegrationAdapter(),
    )


def require_active_session(
    x_session_token: Optional[str] = Header(default=None),
    x_active_profile: Optional[str] = Header(default=None),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> ActiveSessionContext:
    if not x_session_token:
        raise HTTPException(status_code=401, detail="Header X-Session-Token obrigatório.")
    try:
        session = service.get_session(x_session_token)
    except InvalidActiveProfileError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    if x_active_profile and x_active_profile.strip().upper() != session.active_profile_code.value:
        raise HTTPException(
            status_code=403,
            detail=(
                f"Perfil ativo da sessão ({session.active_profile_code.value}) diverge do "
                f"perfil informado ({x_active_profile}). Realize troca explícita de perfil."
            ),
        )
    return session


class LoginRequestDTO(BaseModel):
    matricula: str = Field(..., min_length=2)
    password: str = Field(..., min_length=1)
    requested_profile_code: Optional[str] = None


class SwitchProfileRequestDTO(BaseModel):
    target_profile_id: str


class ClockRegisterDTO(BaseModel):
    source: str = "FACIAL_WEB"
    observation: Optional[str] = None


class OvertimeAuthDTO(BaseModel):
    target_user_id: str
    target_lotacao: str
    reference_date: date
    max_authorized_minutes: int = Field(..., gt=0, le=120)
    reason: str = Field(..., min_length=5)


class AbonoAttachmentDTO(BaseModel):
    filename: str
    mime_type: str
    content_text_or_base64: str


class CreateAbonoDTO(BaseModel):
    reason_code: str
    reference_date: date
    minutes_requested: int = Field(..., gt=0)
    justification: str = Field(..., min_length=5)
    cid_code: Optional[str] = None
    clinical_notes: Optional[str] = None
    submit_immediately: bool = False
    attachments: list[AbonoAttachmentDTO] = []


class TransitionAbonoDTO(BaseModel):
    target_status: AbonoStatus
    decision_notes: Optional[str] = None


class ClosureAdvanceDTO(BaseModel):
    target_user_id: str
    target_lotacao: str
    year: int
    month: int
    target_status: MonthlyClosureStatus


class SeiRectificationDTO(BaseModel):
    target_user_id: str
    year: int
    month: int
    sei_process_number: str
    justification: str


def _serialize_session(session: ActiveSessionContext) -> dict[str, Any]:
    return {
        "sessionId": session.session_id,
        "userId": session.user_id,
        "matricula": session.matricula,
        "userName": session.user_name,
        "activeProfileId": session.active_profile_id,
        "activeProfileCode": session.active_profile_code.value,
        "scope": session.scope.value,
        "lotacaoCodigo": session.lotacao_codigo,
        "provider": session.provider,
        "availableProfiles": [
            {
                "profileId": p.profile_id,
                "profileCode": p.profile_code.value,
                "profileName": p.profile_name,
                "lotacaoCodigo": p.lotacao_codigo,
            }
            for p in session.available_profiles
        ],
    }


@compliance_router.post("/auth/login")
def compliance_login(
    payload: LoginRequestDTO,
    request: Request,
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        session = service.authenticate(
            matricula=payload.matricula,
            password=payload.password,
            requested_profile_code=payload.requested_profile_code,
            ip_address=request.client.host if request.client else "127.0.0.1",
            user_agent=request.headers.get("user-agent", "unknown"),
        )
        return _serialize_session(session)
    except AuthenticationFailedError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    except IdentityAccessDomainError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@compliance_router.post("/auth/switch-profile")
def compliance_switch_profile(
    payload: SwitchProfileRequestDTO,
    request: Request,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        updated = service.switch_active_profile(
            session_id=session.session_id,
            target_profile_id=payload.target_profile_id,
            ip_address=request.client.host if request.client else "127.0.0.1",
            user_agent=request.headers.get("user-agent", "unknown"),
        )
        return _serialize_session(updated)
    except IdentityAccessDomainError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@compliance_router.post("/clocking/register")
def compliance_register_clock(
    payload: ClockRegisterDTO,
    request: Request,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        entry, calc = service.register_clock_entry(
            session=session,
            source=payload.source,
            observation=payload.observation,
            ip_address=request.client.host if request.client else "127.0.0.1",
            user_agent=request.headers.get("user-agent", "unknown"),
        )
        return {
            "entry": {
                "id": entry.id,
                "timestampLocal": entry.timestamp_local.isoformat(),
                "timezone": entry.timezone_iana,
                "entryType": entry.entry_type,
                "sha256Hash": entry.sha256_hash,
            },
            "recalculation": {
                "status": calc.status.value,
                "workedMinutes": calc.worked_minutes,
                "creditMinutes": calc.credit_minutes,
                "nonComputableOvertimeMinutes": calc.non_computable_overtime_minutes,
                "debitMinutes": calc.debit_minutes,
                "toleranceAppliedMinutes": calc.tolerance_applied_minutes,
            },
        }
    except (ScopeAccessDeniedError, MonthlyClosureDomainError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ClockingDomainError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@compliance_router.post("/frequency/overtime-authorizations")
def compliance_authorize_overtime(
    payload: OvertimeAuthDTO,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        auth = service.authorize_overtime(
            session=session,
            target_user_id=payload.target_user_id,
            target_lotacao=payload.target_lotacao,
            reference_date=payload.reference_date,
            max_authorized_minutes=payload.max_authorized_minutes,
            reason=payload.reason,
        )
        return {"id": auth.id, "approved": auth.approved, "maxAuthorizedMinutes": auth.max_authorized_minutes}
    except ScopeAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@compliance_router.post("/abonos")
def compliance_create_abono(
    payload: CreateAbonoDTO,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        attachments = tuple(
            AbonoAttachment(
                id=f"att-{idx}",
                filename=a.filename,
                mime_type=a.mime_type,
                size_bytes=len(a.content_text_or_base64.encode("utf-8")),
                sha256_hash=AbonoAttachment.compute_file_hash(a.content_text_or_base64.encode("utf-8")),
            )
            for idx, a in enumerate(payload.attachments, start=1)
        )
        abono = service.create_abono(
            session=session,
            reason_code=payload.reason_code,
            reference_date=payload.reference_date,
            minutes_requested=payload.minutes_requested,
            justification=payload.justification,
            cid_code=payload.cid_code,
            clinical_notes=payload.clinical_notes,
            attachments=attachments,
            submit_immediately=payload.submit_immediately,
        )
        return {"id": abono.id, "protocol": abono.protocol, "status": abono.status.value}
    except (ScopeAccessDeniedError, MonthlyClosureDomainError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except AbonoWorkflowDomainError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@compliance_router.post("/abonos/{abono_id}/transition")
def compliance_transition_abono(
    abono_id: str,
    payload: TransitionAbonoDTO,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        abono = service.transition_abono(
            session=session,
            abono_id=abono_id,
            target_status=payload.target_status,
            decision_notes=payload.decision_notes,
        )
        return {
            "id": abono.id,
            "status": abono.status.value,
            "cidCode": abono.cid_code,
            "clinicalNotes": abono.clinical_notes,
        }
    except (ScopeAccessDeniedError, MonthlyClosureDomainError) as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (AbonoWorkflowDomainError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@compliance_router.get("/abonos/{abono_id}")
def compliance_get_abono(
    abono_id: str,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        abono = service.get_abono_for_viewer(session, abono_id)
        return {
            "id": abono.id,
            "protocol": abono.protocol,
            "status": abono.status.value,
            "reasonCode": abono.reason_code,
            "cidCode": abono.cid_code,
            "clinicalNotes": abono.clinical_notes,
        }
    except ScopeAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@compliance_router.post("/closure/advance")
def compliance_advance_closure(
    payload: ClosureAdvanceDTO,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        rec = service.advance_monthly_closure(
            session=session,
            target_user_id=payload.target_user_id,
            target_lotacao=payload.target_lotacao,
            year=payload.year,
            month=payload.month,
            target_status=payload.target_status,
        )
        return {"id": rec.id, "status": rec.status.value, "snapshotSha256": rec.snapshot_sha256}
    except ScopeAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except MonthlyClosureDomainError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@compliance_router.post("/closure/rectify-sei")
def compliance_rectify_sei(
    payload: SeiRectificationDTO,
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> dict[str, Any]:
    try:
        rec = service.rectify_closed_month_with_sei(
            session=session,
            target_user_id=payload.target_user_id,
            year=payload.year,
            month=payload.month,
            sei_process_number=payload.sei_process_number,
            justification=payload.justification,
        )
        return {"id": rec.id, "status": rec.status.value, "seiProcess": rec.sei_rectification_process}
    except ScopeAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (MonthlyClosureDomainError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@compliance_router.get("/audit/logs")
def compliance_list_audit_logs(
    session: ActiveSessionContext = Depends(require_active_session),
    service: Portaria135ComplianceService = Depends(get_compliance_service),
) -> list[dict[str, Any]]:
    try:
        logs = service.list_audit_logs(session)
        return [
            {
                "id": log.id,
                "userId": log.user_id,
                "activeProfile": log.active_profile,
                "action": log.action,
                "entityType": log.entity_type,
                "entityId": log.entity_id,
                "beforeState": log.before_state,
                "afterState": log.after_state,
                "timestamp": log.timestamp.isoformat(),
                "integrityHash": log.integrity_hash,
            }
            for log in logs
        ]
    except ScopeAccessDeniedError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
