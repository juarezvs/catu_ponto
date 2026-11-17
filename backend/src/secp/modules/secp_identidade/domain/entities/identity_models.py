from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class OrgaoScope:
    """Value Object representando o contexto organizacional (Órgão e Unidade Ativa)."""

    id: str
    sigla: str
    nome: str
    unidade_ativa: str
    teto_hora_extra_mensal: str


@dataclass(frozen=True)
class SecpModuleDescriptor:
    """Entidade de domínio descrevendo um módulo do ecossistema SECP exibido no Hub (Launcher)."""

    slug: str
    name: str
    short_name: str
    description: str
    theme_color_hex: str
    tailwind_accent: str
    icon: str
    badge_text: str
    stats_label: str
    required_permission: str


@dataclass(frozen=True)
class UserIdentity:
    """Agregado raiz de Identidade e Permissões RBAC do usuário."""

    id: str
    matricula: str
    name: str
    email: str
    role_code: str
    role_name: str
    default_orgao_id: str
    avatar_initials: str
    allowed_modules: frozenset[str] = field(default_factory=frozenset)
    permissions: frozenset[str] = field(default_factory=frozenset)

    def can_access_module(self, module_slug: str, orgao_id: Optional[str] = None) -> bool:
        if "*" in self.allowed_modules or "*" in self.permissions:
            return True
        return module_slug in self.allowed_modules

    def has_permission(self, permission: Optional[str]) -> bool:
        if not permission:
            return True
        if "*" in self.permissions:
            return True
        return permission in self.permissions


@dataclass(frozen=True)
class MenuSubItemEntity:
    """Subitem exibido na Sidebar Secundária Contextual (w-60)."""

    id: str
    label: str
    description: str
    required_permission: Optional[str] = None
    badge: Optional[str] = None


@dataclass(frozen=True)
class MenuSectionEntity:
    """Seção agrupadora na Sidebar Secundária Contextual."""

    id: str
    title: str
    items: tuple[MenuSubItemEntity, ...] = field(default_factory=tuple)

    def filter_for_user(self, user: UserIdentity) -> Optional[MenuSectionEntity]:
        allowed = tuple(
            sub for sub in self.items if user.has_permission(sub.required_permission)
        )
        if not allowed:
            return None
        return MenuSectionEntity(id=self.id, title=self.title, items=allowed)


@dataclass(frozen=True)
class MenuPrimaryItemEntity:
    """Item da Sidebar Primária Colapsável (w-64 / w-20)."""

    id: str
    label: str
    icon: str
    required_permission: Optional[str] = None
    sections: tuple[MenuSectionEntity, ...] = field(default_factory=tuple)

    @property
    def has_secondary_menu(self) -> bool:
        return len(self.sections) > 0

    def filter_for_user(self, user: UserIdentity) -> Optional[MenuPrimaryItemEntity]:
        if not user.has_permission(self.required_permission):
            return None

        if not self.sections:
            return self

        filtered_sections = tuple(
            sec
            for section in self.sections
            if (sec := section.filter_for_user(user)) is not None
        )
        if not filtered_sections:
            return None

        return MenuPrimaryItemEntity(
            id=self.id,
            label=self.label,
            icon=self.icon,
            required_permission=self.required_permission,
            sections=filtered_sections,
        )


@dataclass(frozen=True)
class SragCitationEntity:
    law_reference: str
    excerpt: str
    orgao_scope: str


@dataclass(frozen=True)
class SragAnswerEntity:
    question: str
    answer: str
    citations: tuple[SragCitationEntity, ...]
    confidence_score: float
    guardrail_status: str
