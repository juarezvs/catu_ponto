class FrequencyEngineDomainError(Exception):
    """Base domain error for frequency-engine context."""


class UnauthorizedOvertimeError(FrequencyEngineDomainError):
    """Raised when overtime credit is requested without prior manager authorization (RN-05)."""


class InvalidWorkScheduleError(FrequencyEngineDomainError):
    """Raised when a schedule violates Portaria intrajornada bounds."""
