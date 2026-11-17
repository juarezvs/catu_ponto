from typing import Protocol, Sequence
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    BancoHorasResumoEntity,
    EspelhoDiaEntity,
    HomologacaoItemEntity,
    MarcacaoEntity,
)


class PontoRepositoryOutputPort(Protocol):
    """Outbound Port (Driven Port) para persistência de marcações, apuração, banco de horas e homologação."""

    def list_marcacoes_hoje(self, usuario_id: str) -> Sequence[MarcacaoEntity]:
        ...

    def registrar_marcacao(
        self,
        usuario_id: str,
        fonte: str,
        ip: str | None = None,
        observacao: str | None = None,
    ) -> MarcacaoEntity:
        ...

    def get_espelho_mensal(
        self, usuario_id: str, ano: int, mes: int
    ) -> Sequence[EspelhoDiaEntity]:
        ...

    def get_banco_horas_resumo(self, usuario_id: str) -> BancoHorasResumoEntity:
        ...

    def list_homologacao_queue(self, ano: int, mes: int) -> Sequence[HomologacaoItemEntity]:
        ...

    def homologar_servidor(
        self, homologacao_id: str, chefia_usuario_id: str
    ) -> HomologacaoItemEntity:
        ...
