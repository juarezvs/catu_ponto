from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
from catuponto.domain.entities.user import UserProfile


@dataclass(frozen=True)
class NavigationSubItem:
    """Subitem exibido na segunda barra lateral (menu secundário contextual)."""

    id: str
    label: str
    route: str
    description: str
    required_permission: Optional[str] = None
    badge: Optional[str] = None
    icon: Optional[str] = None


@dataclass(frozen=True)
class NavigationSection:
    """Agrupador de subitens na segunda barra lateral (inspirado no padrão CARTO: ex. ESTRUTURA, GESTÃO DE PESSOAL, CALENDÁRIO)."""

    id: str
    title: str
    items: tuple[NavigationSubItem, ...] = field(default_factory=tuple)

    def filter_for_user(self, user: UserProfile) -> Optional[NavigationSection]:
        allowed_items = tuple(
            item for item in self.items if user.has_permission(item.required_permission)
        )
        if not allowed_items:
            return None
        return NavigationSection(
            id=self.id,
            title=self.title,
            items=allowed_items,
        )


@dataclass(frozen=True)
class NavigationItem:
    """Item do menu lateral primário (com ícone e nome; pode possuir seções de subitens para a segunda barra lateral)."""

    id: str
    label: str
    icon: str
    route: Optional[str] = None
    required_permission: Optional[str] = None
    sections: tuple[NavigationSection, ...] = field(default_factory=tuple)
    position: str = "top"  # 'top' | 'bottom'

    @property
    def has_secondary_menu(self) -> bool:
        return len(self.sections) > 0

    def filter_for_user(self, user: UserProfile) -> Optional[NavigationItem]:
        if not user.has_permission(self.required_permission):
            return None

        if not self.sections:
            return self

        filtered_sections = tuple(
            filtered
            for section in self.sections
            if (filtered := section.filter_for_user(user)) is not None
        )

        # Se o item depende exclusivamente de subitens e o usuário não tem acesso a nenhum subitem, oculta o item pai
        if not filtered_sections:
            return None

        return NavigationItem(
            id=self.id,
            label=self.label,
            icon=self.icon,
            route=self.route,
            required_permission=self.required_permission,
            sections=filtered_sections,
            position=self.position,
        )
