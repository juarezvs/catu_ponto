from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

LIMITE_MENSAL_BANCO_HORAS_MINUTOS = 16 * 60  # 16h (960 minutos) - Portaria 135/2025
LIMITE_MARCACOES_CONTABILIZADAS_DIA = 6  # Seção 7.2 do Documento Único de Reconstrução

ESTADOS_SOLICITACAO_VALIDOS = (
    "RASCUNHO",
    "ENVIADA",
    "EM_ANALISE",
    "DEFERIDA",
    "INDEFERIDA",
    "CANCELADA",
)


def format_minutes_hhmm(minutes: int, with_sign: bool = False) -> str:
    sign = ""
    if with_sign:
        sign = "+" if minutes >= 0 else "-"
    abs_min = abs(minutes)
    hours, mins = divmod(abs_min, 60)
    return f"{sign}{hours:02d}h{mins:02d}"


def classificar_tipo_marcacao_por_sequencia(
    quantidade_marcacoes_no_dia: int, jornada_ininterrupta: bool = True
) -> str:
    """
    RN-PONTO-01 (Domínio Puro):
    Entrada, saída, intervalo e retorno são classificados dinamicamente pela sequência cronológica do dia.
    """
    if quantidade_marcacoes_no_dia == 0:
        return "ENTRADA"
    if quantidade_marcacoes_no_dia == 1:
        return "SAIDA" if jornada_ininterrupta else "SAIDA_INTERVALO"
    if quantidade_marcacoes_no_dia == 2:
        return "RETORNO_INTERVALO"
    return "SAIDA"


def determinar_proxima_acao(marcacoes_hoje: tuple["MarcacaoEntity", ...], jornada_ininterrupta: bool = True) -> tuple[str, str, bool]:
    """
    Retorna (proxima_acao_codigo, descricao_amigavel, exige_biometria_facial).
    Regra do secp_antigo (SPEC 11): 1ª marcação do dia via web exige reconhecimento facial.
    """
    qtd = len(marcacoes_hoje)
    if qtd == 0:
        return ("ENTRADA", "Registrar entrada por reconhecimento facial", True)
    if qtd == 1:
        if jornada_ininterrupta:
            return ("SAIDA", "Registrar saída final da jornada (7h)", False)
        return ("SAIDA_INTERVALO", "Registrar saída para intervalo", False)
    if qtd == 2:
        return ("RETORNO_INTERVALO", "Registrar retorno do intervalo", False)
    if qtd == 3:
        return ("SAIDA", "Registrar saída final da jornada", False)
    if qtd < LIMITE_MARCACOES_CONTABILIZADAS_DIA:
        return ("MANUAL", f"Registrar marcação adicional ({qtd + 1}/{LIMITE_MARCACOES_CONTABILIZADAS_DIA})", False)
    return ("DIA_COMPLETO", "Limite diário de 6 marcações atingido", False)


@dataclass(frozen=True)
class MarcacaoEntity:
    id: str
    usuario_id: str
    data_hora: datetime
    data_referencia: date
    tipo: str  # ENTRADA | SAIDA_INTERVALO | RETORNO_INTERVALO | SAIDA
    fonte: str  # BIOMETRIA_FACIAL | WEB | REP_AFD
    hash_sha256: str
    horario_label: str


@dataclass(frozen=True)
class TimelinePosicao:
    ordem: int
    tipo: str
    titulo: str
    horario: Optional[str]
    fonte: Optional[str]
    concluido: bool


@dataclass(frozen=True)
class PontoDashboardEntity:
    usuario_id: str
    servidor_nome: str
    unidade_label: str
    jornada_nome: str
    jornada_prevista_minutos: int
    trabalhado_hoje_minutos: int
    saldo_banco_minutos: int
    pendencias_count: int
    proxima_acao_codigo: str
    proxima_acao_label: str
    exige_biometria_facial: bool
    timeline_dia: tuple[TimelinePosicao, ...]
    marcacoes_hoje: tuple[MarcacaoEntity, ...]
    frequencia_mes_percentual: float
    dias_regulares_mes: int
    dias_uteis_mes: int


@dataclass(frozen=True)
class EspelhoDiaEntity:
    data: str
    dia_semana: str
    jornada_prevista: str
    marcacoes: tuple[str, ...]
    trabalhado: str
    credito: str
    debito: str
    situacao: str  # Regular | Pendente de ajuste | Recesso forense | Feriado | Homologado
    observacao: Optional[str] = None


@dataclass(frozen=True)
class MovimentoBancoHorasEntity:
    id: str
    data: str
    tipo: str  # CREDITO | DEBITO | COMPENSACAO
    minutos: int
    minutos_formatado: str
    status: str  # VALIDADO | PENDENTE | EXPIRADO
    descricao: str
    expira_em: Optional[str] = None


@dataclass(frozen=True)
class BancoHorasResumoEntity:
    usuario_id: str
    saldo_atual_minutos: int
    saldo_atual_formatado: str
    creditos_mes_minutos: int
    creditos_mes_formatado: str
    limite_mensal_minutos: int
    limite_mensal_formatado: str
    debitos_mes_minutos: int
    debitos_mes_formatado: str
    creditos_a_vencer_minutos: int
    creditos_a_vencer_formatado: str
    horas_acima_limite_minutos: int
    horas_acima_limite_formatado: str
    movimentos: tuple[MovimentoBancoHorasEntity, ...]


@dataclass(frozen=True)
class HomologacaoItemEntity:
    id: str
    usuario_id: str
    servidor_nome: str
    matricula: str
    unidade: str
    competencia: str
    status: str  # CRITICO | PENDENTE | REGULAR | HOMOLOGADO
    trabalhado_formatado: str
    credito_formatado: str
    debito_formatado: str
    faltas: int
    pendencias_resumo: Optional[str] = None
    homologado_por: Optional[str] = None


@dataclass(frozen=True)
class SolicitacaoPontoEntity:
    """
    Entidade de Solicitação (Seção 9 do Documento Único):
    Estados persistidos: RASCUNHO | ENVIADA | EM_ANALISE | DEFERIDA | INDEFERIDA | CANCELADA.
    """

    id: str
    protocolo: str
    usuario_id: str
    servidor_nome: str
    tipo: str
    titulo: str
    descricao: str
    data_referencia: str
    status: str
    justificativa_decisao: Optional[str] = None
    decisor: Optional[str] = None


@dataclass(frozen=True)
class BoletimFrequenciaEntity:
    """Boletim de Frequência da unidade (Seção 10)."""

    id: str
    unidade: str
    competencia: str
    total_servidores: int
    total_homologados: int
    status: str  # GERADO | ENCAMINHADO_SECAP | RECEBIDO
    numero_sei: Optional[str] = None


@dataclass(frozen=True)
class RecessoConvocacaoEntity:
    """Recesso Forense 20/12 a 06/01 como domínio próprio (Seção 11)."""

    id: str
    exercicio: str
    servidor_nome: str
    data_convocada: str
    modalidade: str  # FOLGA | PECUNIA
    chefia_recesso: str
    status: str  # FECHADO_SERVIDOR | HOMOLOGADO_CHEFIA | ACEITO_SECAD | CONSOLIDADO_SEPAG_SECAP
