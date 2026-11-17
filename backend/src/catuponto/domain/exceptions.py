class DomainException(Exception):
    """Exceção base de domínio."""


class EntityNotFoundException(DomainException):
    """Lançada quando uma entidade solicitada não existe."""


class AccessDeniedException(DomainException):
    """Lançada quando o usuário não possui permissão para acessar o recurso."""
