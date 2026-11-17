from typing import Any
from secp.modules.secp_ponto.application.ports.crud_ports import (
    CrudListResult,
    PontoCrudRepositoryOutputPort,
    PontoCrudUseCaseInputPort,
)


class PontoResourceCrudUseCase(PontoCrudUseCaseInputPort):
    """Caso de Uso CRUD aplicando SRP e DIP para todos os cadastros do SECP Ponto."""

    def __init__(self, crud_repo: PontoCrudRepositoryOutputPort) -> None:
        self._crud_repo = crud_repo

    def list_records(self, resource: str, search: str = "") -> CrudListResult:
        return self._crud_repo.list_records(resource=resource, search=search)

    def create_record(self, resource: str, payload: dict[str, Any]) -> dict[str, Any]:
        return self._crud_repo.create_record(resource=resource, payload=payload)

    def update_record(
        self, resource: str, item_id: str, payload: dict[str, Any]
    ) -> dict[str, Any]:
        return self._crud_repo.update_record(
            resource=resource, item_id=item_id, payload=payload
        )

    def delete_record(self, resource: str, item_id: str) -> bool:
        return self._crud_repo.delete_record(resource=resource, item_id=item_id)
