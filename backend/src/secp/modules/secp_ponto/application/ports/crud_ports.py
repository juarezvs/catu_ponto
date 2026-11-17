from dataclasses import dataclass, field
from typing import Any, Protocol


@dataclass(frozen=True)
class CrudFieldSchema:
    key: str
    label: str
    field_type: str = "text"  # text | select | boolean | number | date
    required: bool = True
    options: tuple[str, ...] = field(default_factory=tuple)


@dataclass(frozen=True)
class CrudColumnSchema:
    key: str
    label: str
    type: str = "text"  # text | code | badge | status


@dataclass(frozen=True)
class CrudListResult:
    resource: str
    title: str
    subtitle: str
    primary_action_label: str
    fields: tuple[CrudFieldSchema, ...]
    columns: tuple[CrudColumnSchema, ...]
    records: tuple[dict[str, Any], ...]
    total: int


class PontoCrudRepositoryOutputPort(Protocol):
    """Outbound Port (Driven Port) para operações CRUD nos recursos do módulo SECP Ponto."""

    def list_records(self, resource: str, search: str = "") -> CrudListResult:
        ...

    def create_record(self, resource: str, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    def update_record(
        self, resource: str, item_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        ...

    def delete_record(self, resource: str, item_id: str) -> bool:
        ...


class PontoCrudUseCaseInputPort(Protocol):
    """Inbound Port (Driving Port) para o CRUD unificado de cadastros e tabelas do SECP Ponto."""

    def list_records(self, resource: str, search: str = "") -> CrudListResult:
        ...

    def create_record(self, resource: str, payload: dict[str, Any]) -> dict[str, Any]:
        ...

    def update_record(
        self, resource: str, item_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        ...

    def delete_record(self, resource: str, item_id: str) -> bool:
        ...
