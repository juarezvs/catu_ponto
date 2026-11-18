export type FonteMarcacaoBruta = 'REP' | 'FACIAL' | 'AFD' | 'WEB';

export type OrigemMarcacaoIcone =
  | 'facial'
  | 'relogio'
  | 'computador'
  | 'celular'
  | 'ajuste'
  | 'afd';

export type TipoMarcacaoSequencia =
  | 'ENTRADA'
  | 'SAIDA_INTERVALO'
  | 'RETORNO_INTERVALO'
  | 'SAIDA'
  | 'MANUAL';

export type StatusApuracaoDia =
  | 'REGULAR'
  | 'CREDITO'
  | 'DEBITO'
  | 'INCOMPLETA'
  | 'ABONADA_FERIAS_RECESSO';

export type StatusCompetenciaEspelho =
  | 'ABERTA'
  | 'SINCRONIZANDO'
  | 'RECALCULANDO'
  | 'ENVIADA_HOMOLOGACAO'
  | 'HOMOLOGADA';

export type CodigoPerfilRbac = 'SERVIDOR' | 'CHEFIA' | 'SECAP' | 'MASTER';

export interface MarcacaoBruta {
  readonly id: string;
  readonly ordemDia: number;
  readonly horario: string; // HH:mm:ss
  readonly dataReferencia: string; // YYYY-MM-DD
  readonly fusoHorario: string; // ex: America/Manaus
  readonly fonte: FonteMarcacaoBruta;
  readonly tipoClassificado: TipoMarcacaoSequencia;
  readonly hashSha256: string;
  readonly equipamentoOuOrigem: string;
  readonly localizacao?: string;
  readonly origemIcone?: OrigemMarcacaoIcone;
  readonly tipoEquipamentoNome?: string;
  readonly ajustada?: boolean;
  readonly imutavel: true;
}

export type StatusConferenciaDia =
  | 'CALCULADA'
  | 'AGUARDANDO'
  | 'INCONSISTENTE'
  | 'DISPENSADA'
  | 'EXCEDENTE_PENDENTE';

export type TipoDiaEspelho =
  | 'NORMAL'
  | 'DESCANSO'
  | 'FERIADO'
  | 'PONTO_FACULTATIVO'
  | 'SUSPENSAO'
  | 'RECESSO'
  | 'TELETRABALHO'
  | 'FERIAS'
  | 'AFASTAMENTO'
  | 'FUTURO'
  | 'SEM_JORNADA';

export interface TotalTipoHoraItem {
  readonly codigo: string;
  readonly label: string;
  readonly cor: string;
  readonly quantidadeRegistros: number;
  readonly totalMinutos: number;
  readonly participacaoPct: number;
  readonly saldoObservacao: string;
  readonly aguardandoAutorizacao?: boolean;
}

export interface OcorrenciaEspelhoItem {
  readonly id: string;
  readonly dataIso: string;
  readonly dataFormatada: string;
  readonly diaSemana: string;
  readonly tipo: string;
  readonly categoria: 'FALTA' | 'ATRASO' | 'SAIDA_ANTECIPADA' | 'EXTRA' | 'COMPENSACAO' | 'AFASTAMENTO' | 'OUTRA';
  readonly periodo: string;
  readonly duracaoMinutos: number;
  readonly duracaoCobertaMinutos?: number;
  readonly situacao: string;
  readonly justificativa: string;
  readonly origem: 'APURACAO' | 'SOLICITACAO' | 'SARH' | 'CALENDARIO';
  readonly numeroPedido?: string;
  readonly solicitacaoId?: string;
  readonly podeEditar?: boolean;
  readonly podeSolicitarAutorizacao?: boolean;
  readonly podeExcluir?: boolean;
}

export interface HistoricoAjusteItem {
  readonly id: string;
  readonly dataSolicitacao: string;
  readonly periodo: string;
  readonly tipoAjuste: string;
  readonly dataAfetada: string;
  readonly status: 'APROVADO' | 'EM_ANALISE' | 'REPROVADO' | 'CANCELADO';
  readonly statusLabel: string;
  readonly aprovadoPor?: string;
  readonly justificativa: string;
  readonly observacaoAnalise?: string;
  readonly anexos?: readonly { nome: string; url?: string }[];
  readonly eventos?: readonly { dataHora: string; descricao: string; autor: string }[];
}

export interface MemoriaCalculoDia {
  readonly jornadaAplicada: string;
  readonly janelaExpediente: string;
  readonly intervaloExigidoMinutos: number;
  readonly intervaloRealizadoMinutos: number;
  readonly toleranciaAplicadaMinutos: number;
  readonly regraPortaria: string;
  readonly observacoes: readonly string[];
}

export interface ApuracaoDiaria {
  readonly id: string;
  readonly dataIso: string;
  readonly dataFormatada: string;
  readonly diaSemana: string;
  readonly diaUtil: boolean;
  readonly cargaPrevistaMinutos: number;
  readonly trabalhadoMinutos: number;
  readonly intervaloMinutos?: number;
  readonly creditoMinutos: number;
  readonly debitoMinutos: number;
  readonly excedenteAutorizadoMinutos?: number;
  readonly excedentePendenteMinutos?: number;
  readonly saldoMinutos?: number;
  readonly status: StatusApuracaoDia;
  readonly statusLabel: string;
  readonly conferenciaStatus?: StatusConferenciaDia;
  readonly tipoDia?: TipoDiaEspelho;
  readonly contabilizavel?: boolean;
  readonly eventoInstitucional?: string;
  readonly marcacoes: readonly MarcacaoBruta[];
  readonly memoriaCalculo: MemoriaCalculoDia;
}

export interface EspelhoMensal {
  readonly competencia: string; // MM/YYYY
  readonly competenciaLabel: string;
  readonly statusCompetencia: StatusCompetenciaEspelho;
  readonly statusCompetenciaLabel?: string;
  readonly ultimaSincronizacaoSarh: string;
  readonly ultimoRecalculo: string;
  readonly totalPrevistoMinutos: number;
  readonly totalTrabalhadoMinutos: number;
  readonly totalCreditoMinutos: number;
  readonly totalDebitoMinutos: number;
  readonly totalExcedenteAutorizadoMinutos?: number;
  readonly totalExcedentePendenteMinutos?: number;
  readonly bancoComputavelMinutos: number;
  readonly faltasOuInconsistencias: number;
  readonly diasComJornada?: number;
  readonly unidadeLabel?: string;
  readonly chefiaNome?: string;
  readonly enviadoEm?: string;
  readonly homologadoEm?: string;
  readonly homologadoPor?: string;
  readonly dias: readonly ApuracaoDiaria[];
  readonly totaisPorTipo?: readonly TotalTipoHoraItem[];
  readonly ocorrencias?: readonly OcorrenciaEspelhoItem[];
  readonly historicoAjustes?: readonly HistoricoAjusteItem[];
}

export interface RegulamentacaoOrgao {
  readonly orgaoId: string;
  readonly orgaoSigla: string;
  readonly numeroPortaria: string;
  readonly limiteCreditoMensalMinutos: number; // 960 min (16h)
  readonly mesesExpiracaoCompensacao: number; // 3 meses
  readonly jornada7hCreditoMinimoMinutos: number; // 480 min na SJAM
  readonly exigeAutorizacaoPreviaCredito: boolean;
  readonly expedientePadraoInicio: string; // 08:00
  readonly expedientePadraoFim: string; // 15:00
  readonly entradaMinimaPermitida: string; // 06:00
  readonly saidaMaximaPermitida: string; // 19:00
  readonly prazoHomologacaoDiaMesSeguinte: number; // 10
  readonly limiteViradaMadrugada: string; // 04:00
  readonly percentualCreditoSabado: number; // 50
  readonly percentualCreditoDomingoFeriado: number; // 100
  readonly percentualCreditoRecesso: number; // 100
  readonly limiteMarcacoesDia: number; // 6
}

export interface MenuCatalogoItem {
  readonly id: string;
  readonly label: string;
  readonly route: string;
  readonly icon: 'home' | 'calendar' | 'clock' | 'users' | 'file-check' | 'shield' | 'sliders';
  readonly group: 'MINHA ÁREA' | 'GESTÃO DE EQUIPE' | 'ADMINISTRAÇÃO SECP';
  readonly requiredPermission: string;
  readonly badge?: string;
}

export interface CartoSubMenuItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly route: string;
  readonly requiredPermission: string;
  readonly badge?: string;
}

export interface CartoSubMenuSection {
  readonly title: string;
  readonly items: readonly CartoSubMenuItem[];
}

export interface CartoPrimaryMenuItem {
  readonly id: string;
  readonly label: string;
  readonly icon: 'home' | 'clock' | 'folder' | 'workflows' | 'users' | 'shield' | 'settings';
  readonly route?: string;
  readonly requiredPermission?: string;
  readonly sections: readonly CartoSubMenuSection[];
}

export interface PerfilAcesso {
  readonly codigo: CodigoPerfilRbac;
  readonly nome: string;
  readonly descricao: string;
  readonly permissions: readonly string[];
}

export interface OrgaoContexto {
  readonly id: string;
  readonly sigla: string;
  readonly nome: string;
  readonly unidadeLabel: string;
  readonly fusoHorario: string;
}

export interface NotificacaoSistema {
  readonly id: string;
  readonly titulo: string;
  readonly mensagem: string;
  readonly dataHora: string;
  readonly lida: boolean;
}

export interface ToastMensagem {
  readonly id: string;
  readonly tipo: 'success' | 'info' | 'warning' | 'error';
  readonly texto: string;
}

export interface SolicitacaoAjustePayload {
  readonly dataIso: string;
  readonly tipo: 'AJUSTE_PONTO' | 'COMPENSACAO' | 'ABONO_JUSTIFICATIVA';
  readonly horarioSugerido?: string;
  readonly justificativa: string;
}
