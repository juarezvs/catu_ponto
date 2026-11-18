class ClockingDomainError(Exception):
    """Base domain error for clocking context."""


class DuplicateClockEntryError(ClockingDomainError):
    """Raised when a clock entry occurs within the 5-minute anti-duplicity window (RN-03)."""

    def __init__(self, seconds_since_last: int, min_interval_seconds: int = 300) -> None:
        self.seconds_since_last = seconds_since_last
        self.min_interval_seconds = min_interval_seconds
        super().__init__(
            f"Batida duplicada bloqueada pela RN-03: intervalo de {seconds_since_last}s "
            f"é inferior ao mínimo de {min_interval_seconds}s (5 minutos)."
        )


class DailyClockLimitReachedError(ClockingDomainError):
    """Raised when daily maximum clock entries are reached."""


class IntegrityTamperingError(ClockingDomainError):
    """Raised when SHA-256 verification detects database or document tampering."""
