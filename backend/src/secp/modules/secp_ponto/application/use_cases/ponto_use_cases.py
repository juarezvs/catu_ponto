from datetime import datetime
from typing import Sequence
from secp.modules.secp_identidade.application.ports.output_ports import (
    IdentityRepositoryOutputPort,
)
from secp.modules.secp_ponto.application.ports.input_ports import (
    GetBancoHorasInputPort,
    GetEspelhoPontoInputPort,
    GetPontoDashboardInputPort,
    HomologarServidorMesInputPort,
    ListHomologacaoQueueInputPort,
    RegistrarPontoInputPort,
)
from secp.modules.secp_ponto.application.ports.output_ports import (
    PontoRepositoryOutputPort,
)
from secp.modules.secp_ponto.domain.entities.ponto_models import (
    BancoHorasResumoEntity,
    EspelhoDiaEntity,
    HomologacaoItemEntity,
    MarcacaoEntity,
    PontoDashboardEntity,
    TimelinePosicao,
    determinar_proxima_acao,
)


class GetPontoDashboardUseCase(GetPontoDashboardInputPort):
    """
    Caso de Uso (SPEC 10 - secp_antigo):
    Monta o Dashboard do Servidor com foco em Próxima Ação, Timeline de 4 posições,
    Jornada do Dia, Trabalhado Hoje, Banco de Horas e Pendências.
    """

    def __init__(
        self,
        ponto_repo: PontoRepositoryOutputPort,
        identity_repo: IdentityRepositoryOutputPort,
    ) -> None:
        self._ponto_repo = ponto_repo
        self._identity_repo = identity_repo

    def execute(self, usuario_id: str) -> PontoDashboardEntity:
        user = self._identity_repo.get_user_by_id(usuario_id)
        servidor_nome = user.name if user else "Servidor SECP"
        orgao = (
            self._identity_repo.get_orgao_by_id(user.default_orgao_id)
            if user
            else None
        )
        unidade_label = (
            f"{orgao.sigla} > {orgao.unidade_ativa}" if orgao else "SEMAD > Sede Central"
        )

        marcacoes = tuple(self._ponto_repo.list_marcacoes_hoje(usuario_id))
        banco = self._ponto_repo.get_banco_horas_resumo(usuario_id)
        acao_cod, acao_label, exige_facial = determinar_proxima_acao(
            marcacoes, jornada_ininterrupta=False
        )

        # Calcula tempo trabalhado em minutos entre pares de marcações
        trabalhado_min = 0
        if len(marcacoes) >= 2:
            trabalhado_min += max(
                0,
                int((marcacoes[1].data_hora - marcacoes[0].data_hora).total_seconds() // 60),
            )
        if len(marcacoes) >= 4:
            trabalhado_min += max(
                0,
                int((marcacoes[3].data_hora - marcacoes[2].data_hora).total_seconds() // 60),
            )
        elif len(marcacoes) in (1, 3):
            # Em andamento: calcula diferença parcial até agora para feedback visual imediato
            ultima = marcacoes[-1].data_hora
            agora = datetime.now(ultima.tzinfo)
            trabalhado_min += max(0, int((agora - ultima).total_seconds() // 60))

        posicoes_spec = (
            (1, "ENTRADA", "Entrada"),
            (2, "SAIDA_INTERVALO", "Saída Intervalo"),
            (3, "RETORNO_INTERVALO", "Retorno Intervalo"),
            (4, "SAIDA", "Saída Final"),
        )
        timeline = []
        for idx, tipo_cod, titulo in posicoes_spec:
            marc = marcacoes[idx - 1] if len(marcacoes) >= idx else None
            timeline.append(
                TimelinePosicao(
                    ordem=idx,
                    tipo=tipo_cod,
                    titulo=titulo,
                    horario=marc.horario_label if marc else None,
                    fonte=marc.fonte if marc else None,
                    concluido=marc is not None,
                )
            )

        return PontoDashboardEntity(
            usuario_id=usuario_id,
            servidor_nome=servidor_nome,
            unidade_label=unidade_label,
            jornada_nome="Jornada Padrão 7h Ininterrupta (ou 8h c/ Intervalo)",
            jornada_prevista_minutos=420,
            trabalhado_hoje_minutos=trabalhado_min,
            saldo_banco_minutos=banco.saldo_atual_minutos,
            pendencias_count=1 if len(marcacoes) == 0 else 0,
            proxima_acao_codigo=acao_cod,
            proxima_acao_label=acao_label,
            exige_biometria_facial=exige_facial,
            timeline_dia=tuple(timeline),
            marcacoes_hoje=marcacoes,
            frequencia_mes_percentual=96.4,
            dias_regulares_mes=18,
            dias_uteis_mes=20,
        )


class RegistrarPontoUseCase(RegistrarPontoInputPort):
    def __init__(self, ponto_repo: PontoRepositoryOutputPort) -> None:
        self._ponto_repo = ponto_repo

    def execute(
        self,
        usuario_id: str,
        fonte: str,
        ip: str | None = None,
        observacao: str | None = None,
    ) -> MarcacaoEntity:
        return self._ponto_repo.registrar_marcacao(
            usuario_id=usuario_id, fonte=fonte, ip=ip, observacao=observacao
        )


class GetEspelhoPontoUseCase(GetEspelhoPontoInputPort):
    def __init__(self, ponto_repo: PontoRepositoryOutputPort) -> None:
        self._ponto_repo = ponto_repo

    def execute(self, usuario_id: str, ano: int, mes: int) -> Sequence[EspelhoDiaEntity]:
        return self._ponto_repo.get_espelho_mensal(usuario_id=usuario_id, ano=ano, mes=mes)


class GetBancoHorasUseCase(GetBancoHorasInputPort):
    def __init__(self, ponto_repo: PontoRepositoryOutputPort) -> None:
        self._ponto_repo = ponto_repo

    def execute(self, usuario_id: str) -> BancoHorasResumoEntity:
        return self._ponto_repo.get_banco_horas_resumo(usuario_id=usuario_id)


class ListHomologacaoQueueUseCase(ListHomologacaoQueueInputPort):
    def __init__(self, ponto_repo: PontoRepositoryOutputPort) -> None:
        self._ponto_repo = ponto_repo

    def execute(self, ano: int, mes: int) -> Sequence[HomologacaoItemEntity]:
        return self._ponto_repo.list_homologacao_queue(ano=ano, mes=mes)


class HomologarServidorMesUseCase(HomologarServidorMesInputPort):
    def __init__(self, ponto_repo: PontoRepositoryOutputPort) -> None:
        self._ponto_repo = ponto_repo

    def execute(self, homologacao_id: str, chefia_usuario_id: str) -> HomologacaoItemEntity:
        return self._ponto_repo.homologar_servidor(
            homologacao_id=homologacao_id, chefia_usuario_id=chefia_usuario_id
        )
