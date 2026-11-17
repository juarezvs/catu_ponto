from typing import Optional
from pydantic import BaseModel


class UserProfileDTO(BaseModel):
    id: str
    name: str
    email: str
    roleName: str
    organization: str
    avatarInitials: str
    permissions: list[str]


class NavigationSubItemDTO(BaseModel):
    id: str
    label: str
    route: str
    description: str
    badge: Optional[str] = None
    icon: Optional[str] = None


class NavigationSectionDTO(BaseModel):
    id: str
    title: str
    items: list[NavigationSubItemDTO]


class NavigationItemDTO(BaseModel):
    id: str
    label: str
    icon: str
    route: Optional[str] = None
    hasSecondaryMenu: bool
    sections: list[NavigationSectionDTO]
    position: str


class UserNavigationResponseDTO(BaseModel):
    user: UserProfileDTO
    items: list[NavigationItemDTO]


class CadastroColumnDTO(BaseModel):
    key: str
    label: str
    type: str


class CadastroMetricDTO(BaseModel):
    label: str
    value: str
    trend: str


class CadastroModuleResponseDTO(BaseModel):
    slug: str
    title: str
    subtitle: str
    category: str
    primaryActionLabel: str
    metrics: list[CadastroMetricDTO]
    columns: list[CadastroColumnDTO]
    records: list[dict[str, str]]
