class AbonoWorkflowDomainError(Exception):
    """Base domain error for abono-workflow context."""


class InvalidAbonoTransitionError(AbonoWorkflowDomainError):
    """Raised when an invalid state transition is attempted in abono workflow."""


class MissingRequiredAttachmentError(AbonoWorkflowDomainError):
    """Raised when submitting an abono whose reason requires a supporting PDF/image attachment."""
