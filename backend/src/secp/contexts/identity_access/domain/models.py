from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol


class NormativeProfileCode(str, Enum):
    """Perfis oficiais da Portaria SJAM-DIREF 135/2025."""

    SERVIDOR = "SERVIDOR"
    GESTOR = "GESTOR"
    DIRETOR_RH = "DIRETOR_RH"
    AUDITOR = "AUDITOR"
    ADMIN_TI = "ADMIN_TI"


class ProfileScope(str, Enum):
    OWN_ONLY = "OWN_ONLY"
    UNIT_TEAM = "UNIT_TEAM"
    SECTIONAL_ALL = "SECTIONAL_ALL"
    READ_ONLY_GLOBAL = "READ_ONLY_GLOBAL"
    TECH_ADMIN_ONLY = "TECH_ADMIN_ONLY"


PROFILE_SCOPE_MAP: dict[NormativeProfileCode, ProfileScope] = {
    NormativeProfileCode.SERVIDOR: ProfileScope.OWN_ONLY,
    NormativeProfileCode.GESTOR: ProfileScope.UNIT_TEAM,
    NormativeProfileCode.DIRETOR_RH: ProfileScope.SECTIONAL_ALL,
    NormativeProfileCode.AUDITOR: ProfileScope.READ_ONLY_GLOBAL,
    NormativeProfileCode.ADMIN_TI: ProfileScope.TECH_ADMIN_ONLY,
}

LEGACY_PROFILE_ALIAS: dict[str, NormativeProfileCode] = {
    "SERVIDOR": NormativeProfileCode.SERVIDOR,
    "SRV": NormativeProfileCode.SERVIDOR,
    "CHEFIA": NormativeProfileCode.GESTOR,
    "GESTOR": NormativeProfileCode.GESTOR,
    "GCH": NormativeProfileCode.GESTOR,
    "SECAP": NormativeProfileCode.DIRETOR_RH,
    "DIRETOR_RH": NormativeProfileCode.DIRETOR_RH,
    "DRH": NormativeProfileCode.DIRETOR_RH,
    "AUDITOR": NormativeProfileCode.AUDITOR,
    "AUD": NormativeProfileCode.AUDITOR,
    "MASTER": NormativeProfileCode.ADMIN_TI,
    "ADMIN_TI": NormativeProfileCode.ADMIN_TI,
    "ADM": NormativeProfileCode.ADMIN_TI,
}


def normalize_profile_code(raw_code: str) -> NormativeProfileCode:
    code = (raw_code or "").strip().upper()
    if code not in LEGACY_PROFILE_ALIAS:
        raise ValueError(f"Perfil normativo desconhecido: {raw_code}")
    return LEGACY_PROFILE_ALIAS[code]


@dataclass(frozen=True)
class UserProfileAssignment:
    profile_id: str
    profile_code: NormativeProfileCode
    profile_name: str
    lotacao_codigo: str
    active: bool = True


@dataclass(frozen=True)
class ActiveSessionContext:
    """Sessão autenticada com exatamente UM perfil ativo por vez."""

    session_id: str
    user_id: str
    matricula: str
    user_name: str
    active_profile_id: str
    active_profile_code: NormativeProfileCode
    lotacao_codigo: str
    provider: str
    available_profiles: tuple[UserProfileAssignment, ...]

    @property
    def scope(self) -> ProfileScope:
        return PROFILE_SCOPE_MAP[self.active_profile_code]

    def can_mutate_clock_or_abono(self) -> bool:
        """AUDITOR é estritamente Read-Only; ADMIN_TI não pode alterar batidas ou abonar."""
        return self.active_profile_code not in (
            NormativeProfileCode.AUDITOR,
            NormativeProfileCode.ADMIN_TI,
        )

    def can_view_lgpd_clinical_data(self, target_user_id: str) -> bool:
        """RNF-LGPD: CID/diagnóstico visível apenas ao próprio servidor ou DIRETOR_RH (NUGEP/setor médico)."""
        if self.user_id == target_user_id:
            return True
        return self.active_profile_code == NormativeProfileCode.DIRETOR_RH

    def can_access_user_data(self, target_user_id: str, target_lotacao: str) -> bool:
        scope = self.scope
        if scope == ProfileScope.OWN_ONLY:
            return self.user_id == target_user_id
        if scope == ProfileScope.UNIT_TEAM:
            return self.lotacao_codigo == target_lotacao or self.user_id == target_user_id
        if scope in (ProfileScope.SECTIONAL_ALL, ProfileScope.READ_ONLY_GLOBAL):
            return True
        return False


class AuthProviderPort(Protocol):
    """Porta desacoplada para provedores de identidade (AD inicial, Entra ID, Google, Apple)."""

    @property
    def provider_name(self) -> str: ...

    def authenticate(self, identifier: str, secret_or_token: str) -> dict: ...


class MicrosoftEntraIdProviderPort(AuthProviderPort, Protocol):
    """Contrato pronto para integração OIDC/OAuth2 com Microsoft Entra ID."""


class GoogleOAuthProviderPort(AuthProviderPort, Protocol):
    """Contrato pronto para integração OIDC/OAuth2 com Google Workspace."""


class AppleSignInProviderPort(AuthProviderPort, Protocol):
    """Contrato pronto para integração Sign in with Apple."""
