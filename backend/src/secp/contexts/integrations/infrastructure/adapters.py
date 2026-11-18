from __future__ import annotations

from datetime import date, datetime
import hashlib
from typing import Optional

from secp.contexts.identity_access.domain.exceptions import AuthenticationFailedError
from secp.contexts.identity_access.domain.models import (
    AuthProviderPort,
    NormativeProfileCode,
    UserProfileAssignment,
)
from secp.contexts.integrations.domain.ports import (
    AfpRawPunchRecord,
    BiometricReaderPort,
    FacialRecognitionPort,
    RepAfdCollectorPort,
    SarhFunctionalData,
    SarhIntegrationPort,
    SeiIntegrationPort,
    SeiProcessValidation,
)


class ActiveDirectoryAuthAdapter(AuthProviderPort):
    """Provedor inicial via credenciais do Active Directory (AD / LDAP) com catálogo institucional."""

    def __init__(self, directory_users: Optional[dict[str, dict]] = None) -> None:
        self._users = directory_users or {
            "AM200385": {
                "user_id": "usr-am200385",
                "matricula": "AM200385",
                "name": "Juarez Servidor SJAM",
                "password_plain": "secp135",
                "lotacao_codigo": "SJAM-MANAUS",
                "profiles": [
                    UserProfileAssignment(
                        profile_id="prof-srv",
                        profile_code=NormativeProfileCode.SERVIDOR,
                        profile_name="Servidor",
                        lotacao_codigo="SJAM-MANAUS",
                    ),
                    UserProfileAssignment(
                        profile_id="prof-gch",
                        profile_code=NormativeProfileCode.GESTOR,
                        profile_name="Gestor / Chefia Imediata",
                        lotacao_codigo="SJAM-MANAUS",
                    ),
                    UserProfileAssignment(
                        profile_id="prof-drh",
                        profile_code=NormativeProfileCode.DIRETOR_RH,
                        profile_name="Diretor RH / NUGEP",
                        lotacao_codigo="SJAM-MANAUS",
                    ),
                    UserProfileAssignment(
                        profile_id="prof-aud",
                        profile_code=NormativeProfileCode.AUDITOR,
                        profile_name="Auditor / Controle Interno",
                        lotacao_codigo="SJAM-MANAUS",
                    ),
                    UserProfileAssignment(
                        profile_id="prof-adm",
                        profile_code=NormativeProfileCode.ADMIN_TI,
                        profile_name="Admin TI",
                        lotacao_codigo="SJAM-MANAUS",
                    ),
                ],
            },
            "AM200901": {
                "user_id": "usr-am200901",
                "matricula": "AM200901",
                "name": "Servidor Tabatinga",
                "password_plain": "secp135",
                "lotacao_codigo": "SSJ-TABATINGA",
                "profiles": [
                    UserProfileAssignment(
                        profile_id="prof-srv-tbt",
                        profile_code=NormativeProfileCode.SERVIDOR,
                        profile_name="Servidor",
                        lotacao_codigo="SSJ-TABATINGA",
                    ),
                ],
            },
            "AM200400": {
                "user_id": "usr-am200400",
                "matricula": "AM200400",
                "name": "Maria Servidora Manaus",
                "password_plain": "secp135",
                "lotacao_codigo": "SJAM-MANAUS",
                "profiles": [
                    UserProfileAssignment(
                        profile_id="prof-srv-400",
                        profile_code=NormativeProfileCode.SERVIDOR,
                        profile_name="Servidor",
                        lotacao_codigo="SJAM-MANAUS",
                    ),
                ],
            },
        }

    @property
    def provider_name(self) -> str:
        return "ACTIVE_DIRECTORY"

    def authenticate(self, identifier: str, secret_or_token: str) -> dict:
        key = (identifier or "").strip().upper()
        user = self._users.get(key)
        if not user or user["password_plain"] != secret_or_token:
            raise AuthenticationFailedError("Credenciais AD inválidas para matrícula informada.")
        return user


class StubRepAfdCollectorAdapter(RepAfdCollectorPort):
    """Adapter para futura integração com relógios de ponto físicos (AFD/REP)."""

    def parse_afd_batch(self, raw_content: str, equipment_serial: str) -> list[AfpRawPunchRecord]:
        records: list[AfpRawPunchRecord] = []
        for idx, line in enumerate(raw_content.splitlines(), start=1):
            cleaned = line.strip()
            if not cleaned:
                continue
            digest = hashlib.sha256(f"{equipment_serial}|{cleaned}".encode("utf-8")).hexdigest()
            records.append(
                AfpRawPunchRecord(
                    nsr=f"{idx:09d}",
                    pis_or_cpf=cleaned[:11],
                    timestamp=datetime.now(),
                    equipment_serial=equipment_serial,
                    sha256_hash=digest,
                )
            )
        return records


class StubBiometricReaderAdapter(BiometricReaderPort):
    def verify_template(self, matricula: str, template_payload: str) -> bool:
        return bool(matricula and template_payload)


class StubFacialRecognitionAdapter(FacialRecognitionPort):
    def verify_liveness_and_match(self, matricula: str, frame_base64: str) -> bool:
        return bool(matricula and frame_base64)


class StubSarhIntegrationAdapter(SarhIntegrationPort):
    def fetch_functional_status(self, matricula: str, reference_date: date) -> SarhFunctionalData:
        lotacao = "SSJ-TABATINGA" if matricula.upper().endswith("901") else "SJAM-MANAUS"
        return SarhFunctionalData(
            matricula=matricula.upper(),
            lotacao_codigo=lotacao,
            cargo="Técnico Judiciário",
            em_ferias=False,
            afastamento_ativo=False,
        )

    def notify_expired_debit_for_payroll(self, matricula: str, competence: str, debit_minutes: int) -> str:
        return f"SARH-ALERT-{matricula.upper()}-{competence}-{debit_minutes}M"


class StubSeiIntegrationAdapter(SeiIntegrationPort):
    def validate_rectification_process(self, process_number: str) -> SeiProcessValidation:
        cleaned = (process_number or "").strip()
        valid = len(cleaned) >= 6
        return SeiProcessValidation(
            process_number=cleaned,
            valid=valid,
            unit_origin="SJAM-NUGEP",
            subject="Retificação excepcional de frequência",
        )
