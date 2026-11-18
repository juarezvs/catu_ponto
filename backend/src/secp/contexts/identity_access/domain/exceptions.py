class IdentityAccessDomainError(Exception):
    """Base domain error for identity-access context."""


class AuthenticationFailedError(IdentityAccessDomainError):
    """Raised when credentials or external provider authentication fail."""


class InvalidActiveProfileError(IdentityAccessDomainError):
    """Raised when activeProfileId is missing, inactive, or not assigned to user."""


class ScopeAccessDeniedError(IdentityAccessDomainError):
    """Raised when the active profile lacks permission or scope for the target resource."""
