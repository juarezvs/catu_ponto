from dataclasses import dataclass, field


@dataclass(frozen=True)
class UserProfile:
    """Entidade de domínio representando o usuário autenticado e suas permissões de acesso."""

    id: str
    name: str
    email: str
    role_name: str
    organization: str
    avatar_initials: str
    permissions: frozenset[str] = field(default_factory=frozenset)

    def has_permission(self, permission: str | None) -> bool:
        if not permission:
            return True
        if "*" in self.permissions:
            return True
        return permission in self.permissions
