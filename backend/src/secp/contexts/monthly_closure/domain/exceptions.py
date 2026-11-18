class MonthlyClosureDomainError(Exception):
    """Base domain error for monthly-closure context."""


class ClosedCompetencePeriodError(MonthlyClosureDomainError):
    """Raised when attempting to mutate an immutable/homologated/closed competence period (RN-07)."""


class InvalidClosureTransitionError(MonthlyClosureDomainError):
    """Raised when an invalid monthly closure state transition is attempted."""


class MissingSeiProcessError(MonthlyClosureDomainError):
    """Raised when retroactive rectification is attempted without a valid SEI process number."""
