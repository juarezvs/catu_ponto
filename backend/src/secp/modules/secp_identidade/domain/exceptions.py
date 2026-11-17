class SecpDomainException(Exception):
    """Exceção base de domínio da plataforma SECP."""


class SecpEntityNotFoundException(SecpDomainException):
    """Lançada quando uma entidade de domínio não é localizada."""


class SecpAccessDeniedException(SecpDomainException):
    """Lançada quando o motor RBAC bloqueia o acesso a um módulo, órgão ou subitem."""
