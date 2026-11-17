from typing import Protocol, Sequence
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    BancoHorasResumoEntity,
    EspelhoDiaEntity,
    HomologacaoItemEntity,
    MarcacaoEntity,
    PontoDashboardEntity,
)


class GetPontoDashboardInputPort(Protocol):
    def execute(self, usuario_id: str) -> PontoDashboardEntity:
        ...


class RegistrarPontoInputPort(Protocol):
    def execute(
        self,
        usuario_id: str,
        fonte: str,
        ip: str | None = None,
        observacao: str | None = None,
    ) -> MarcacaoEntity:
        ...


class GetEspelhoPontoInputPort(Protocol):
    def execute(self, usuario_id: str, ano: int, mes: int) -> Sequence[EspelhoDiaEntity]:
        ...


class GetBancoHorasInputPort(Protocol):
    def execute(self, usuario_id: str) -> BancoHorasResumoEntity:
        ...


class ListHomologacaoQueueInputPort(Protocol):
    def execute(self, ano: int, mes: int) -> Sequence[HomologacaoItemEntity]:
        ...


class HomologarServidorMesInputPort(Protocol):
    def execute(self, homologacao_id: str, chefia_usuario_id: str) -> HomologacaoItemEntity:
        ...
