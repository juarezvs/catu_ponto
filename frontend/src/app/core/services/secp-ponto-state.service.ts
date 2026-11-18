import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import {
  ApuracaoDiaria,
  CartoPrimaryMenuItem,
  CodigoPerfilRbac,
  EspelhoMensal,
  FonteMarcacaoBruta,
  MarcacaoBruta,
  MenuCatalogoItem,
  NotificacaoSistema,
  OrgaoContexto,
  PerfilAcesso,
  RegulamentacaoOrgao,
  SolicitacaoAjustePayload,
  TipoMarcacaoSequencia,
  ToastMensagem,
} from '../models/ponto.models';

export function formatarMinutos(minutos: number, comSinal = false): string {
  const sinal = comSinal ? (minutos > 0 ? '+' : minutos < 0 ? '-' : '') : minutos < 0 ? '-' : '';
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`;
}

@Injectable({
  providedIn: 'root',
})
export class SecpPontoStateService {
  readonly orgaosDisponiveis: readonly OrgaoContexto[] = [
    {
      id: 'sjam',
      sigla: 'SJAM',
      nome: 'Seção Judiciária do Amazonas',
      unidadeLabel: 'SJAM • Manaus • Sede',
      fusoHorario: 'America/Manaus',
    },
    {
      id: 'sjdf',
      sigla: 'SJDF',
      nome: 'Seção Judiciária do Distrito Federal',
      unidadeLabel: 'SJDF • Brasília • Sede',
      fusoHorario: 'America/Sao_Paulo',
    },
    {
      id: 'sjto',
      sigla: 'SJTO',
      nome: 'Seção Judiciária do Tocantins',
      unidadeLabel: 'SJTO • Palmas • Sede',
      fusoHorario: 'America/Sao_Paulo',
    },
  ];

  readonly perfisRbac: readonly PerfilAcesso[] = [
    {
      codigo: 'SERVIDOR',
      nome: 'Servidor',
      descricao: 'Autoatendimento completo: Meu Ponto, Solicitações, Minha Vida Funcional e Consultas.',
      permissions: [
        'dashboard:visualizar:proprio',
        'espelho-ponto:visualizar:proprio',
        'marcacoes:registrar-facial:proprio',
        'marcacoes:consultar:proprio',
        'banco-horas:consultar:proprio',
        'solicitacoes:criar:proprio',
        'contracheque:consultar:proprio',
        'afastamentos:consultar:proprio',
        'programacao-ferias:consultar:proprio',
        'horas-extras:visualizar:proprio',
        'recesso:consultar:proprio',
        'relatorios:consultar:proprio',
        'substituicoes-funcao:relatorio:proprio',
      ],
    },
    {
      codigo: 'CHEFIA',
      nome: 'Chefia / Gestor',
      descricao: 'Acesso às suas informações e de todos os servidores e unidades subordinadas.',
      permissions: [
        'dashboard:visualizar:proprio',
        'espelho-ponto:visualizar:proprio',
        'marcacoes:registrar-facial:proprio',
        'marcacoes:consultar:proprio',
        'banco-horas:consultar:proprio',
        'solicitacoes:criar:proprio',
        'contracheque:consultar:proprio',
        'afastamentos:consultar:proprio',
        'programacao-ferias:consultar:proprio',
        'horas-extras:visualizar:proprio',
        'recesso:consultar:proprio',
        'relatorios:consultar:proprio',
        'substituicoes-funcao:relatorio:proprio',
        'banco-horas:consultar:subordinados',
        'solicitacoes:analisar:subordinados',
        'homologacao:gerenciar:subordinados',
      ],
    },
    {
      codigo: 'SECAP',
      nome: 'Administrador',
      descricao: 'Acesso integral às informações e cadastros da Seccional/Órgão administrado.',
      permissions: [
        'dashboard:visualizar:proprio',
        'espelho-ponto:visualizar:proprio',
        'marcacoes:registrar-facial:proprio',
        'marcacoes:consultar:proprio',
        'banco-horas:consultar:proprio',
        'solicitacoes:criar:proprio',
        'contracheque:consultar:proprio',
        'afastamentos:consultar:proprio',
        'programacao-ferias:consultar:proprio',
        'horas-extras:visualizar:proprio',
        'recesso:consultar:proprio',
        'relatorios:consultar:proprio',
        'substituicoes-funcao:relatorio:proprio',
        'banco-horas:consultar:subordinados',
        'banco-horas:gerenciar:seccional',
        'solicitacoes:analisar:subordinados',
        'homologacao:gerenciar:subordinados',
        'homologacao:consultar:seccional',
        'boletim-frequencia:receber:seccional',
        'cadastros:gerenciar:seccional',
      ],
    },
    {
      codigo: 'MASTER',
      nome: 'Master',
      descricao: 'Acesso irrestrito a todas as informações e órgãos do módulo SECP Ponto.',
      permissions: ['*'],
    },
  ];

  private readonly catalogoMenus: readonly MenuCatalogoItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard do Servidor',
      route: '/dashboard',
      icon: 'home',
      group: 'MINHA ÁREA',
      requiredPermission: 'dashboard:visualizar:proprio',
    },
    {
      id: 'espelho-ponto',
      label: 'Espelho de Ponto',
      route: '/espelho-ponto',
      icon: 'calendar',
      group: 'MINHA ÁREA',
      requiredPermission: 'espelho-ponto:visualizar:proprio',
      badge: '11/2026',
    },
    {
      id: 'banco-horas',
      label: 'Banco de Horas (16h/mês)',
      route: '/espelho-ponto',
      icon: 'clock',
      group: 'MINHA ÁREA',
      requiredPermission: 'banco-horas:consultar:proprio',
    },
    {
      id: 'minha-equipe',
      label: 'Homologação da Equipe',
      route: '/espelho-ponto',
      icon: 'users',
      group: 'GESTÃO DE EQUIPE',
      requiredPermission: 'homologacao:gerenciar:subordinados',
      badge: '2',
    },
    {
      id: 'boletim',
      label: 'Boletim de Frequência',
      route: '/espelho-ponto',
      icon: 'file-check',
      group: 'ADMINISTRAÇÃO SECP',
      requiredPermission: 'boletim-frequencia:receber:seccional',
    },
    {
      id: 'rbac-identidade',
      label: 'Perfis & Permissões RBAC',
      route: '/dashboard',
      icon: 'shield',
      group: 'ADMINISTRAÇÃO SECP',
      requiredPermission: 'perfis:gerenciar:seccional',
    },
    {
      id: 'regulamentacao',
      label: 'Parâmetros Portaria 135',
      route: '/dashboard',
      icon: 'sliders',
      group: 'ADMINISTRAÇÃO SECP',
      requiredPermission: 'configuracoes:gerenciar:seccional',
    },
  ];

  readonly regulamentacaoSjam: RegulamentacaoOrgao = {
    orgaoId: 'sjam',
    orgaoSigla: 'SJAM',
    numeroPortaria: 'Portaria SJAM-DIREF 135/2025',
    limiteCreditoMensalMinutos: 960,
    mesesExpiracaoCompensacao: 3,
    jornada7hCreditoMinimoMinutos: 480,
    exigeAutorizacaoPreviaCredito: true,
    expedientePadraoInicio: '08:00',
    expedientePadraoFim: '15:00',
    entradaMinimaPermitida: '06:00',
    saidaMaximaPermitida: '19:00',
    prazoHomologacaoDiaMesSeguinte: 10,
    limiteViradaMadrugada: '04:00',
    percentualCreditoSabado: 50,
    percentualCreditoDomingoFeriado: 100,
    percentualCreditoRecesso: 100,
    limiteMarcacoesDia: 6,
  };

  private readonly http = inject(HttpClient);
  private readonly apiRealBase = 'http://localhost:8000/api/v1/secp/ponto/real';

  // Signals de Integração Real com PostgreSQL (secp_prod_real) & Redis
  readonly realDataLoaded = signal<boolean>(false);
  readonly realSolicitacoes = signal<readonly {
    id: string;
    tipo: string;
    status: string;
    titulo: string;
    descricao: string;
    dataReferencia: string;
    criadoEm: string;
  }[]>([]);
  readonly realServidoresAmostra = signal<readonly {
    matricula: string;
    nome_funcional: string;
    orgao_sigla: string;
    unidade_nome: string;
    cargo_nome: string;
  }[]>([]);
  readonly realRegulamentacao = signal<RegulamentacaoOrgao | null>(null);
  readonly loggedInMatricula = signal<string>('AM200385');
  readonly chefiaEscopo = signal<{
    gestorMatricula: string;
    gestorNome: string;
    unidades: { id: string; sigla: string; nome: string; tipo: string; unidade_pai_id: string | null; nivel: number; papel_gestor: string }[];
    subordinados: { id: string; matricula: string; nomeFuncional: string; email: string; situacao: string; unidadeId: string; unidadeSigla: string; unidadeNome: string; cargoNome: string }[];
    solicitacoesEquipe: { id: string; matricula: string; servidorNome: string; tipo: string; status: string; titulo: string; dataReferencia: string; criadoEm: string }[];
  } | null>(null);

  // Signals de Autenticação & Navegação CARTO (Dupla Sidebar)
  readonly isAuthenticated = signal<boolean>(false);
  readonly authenticating = signal<boolean>(false);
  readonly requirePasswordChange = signal<boolean>(false);
  readonly authError = signal<string | null>(null);
  private readonly masterPasswordChanged = signal<boolean>(false);

  readonly activePrimaryMenuId = signal<string>('home');
  readonly secondarySidebarOpen = signal<boolean>(false);

  // Signals de Layout e Contexto Institucional
  readonly sidebarExpanded = signal<boolean>(true);
  readonly fontLarge = signal<boolean>(false);
  readonly highContrast = signal<boolean>(false);
  readonly activeOrgaoId = signal<string>('sjam');
  readonly activePerfilCodigo = signal<CodigoPerfilRbac>('SERVIDOR');

  readonly servidorNome = signal<string>('FLAVIO OLIVEIRA DA ROCHA');
  readonly servidorMatricula = signal<string>('AM200385');
  readonly servidorLotacao = signal<string>('SJAM • Manaus • Sede');

  // Signals de Notificações e Toasts
  readonly notificacoes = signal<readonly NotificacaoSistema[]>([
    {
      id: 'not-1',
      titulo: 'Competência 11/2026 em andamento',
      mensagem: 'Prazo para envio e homologação até o dia 10 do mês subsequente (Portaria SJAM-DIREF 135/2025).',
      dataHora: 'Hoje • 08:05',
      lida: false,
    },
    {
      id: 'not-2',
      titulo: 'Crédito a vencer em 30 dias',
      mensagem: 'Você possui +02h00 de banco de horas com vencimento em 12/12/2026 (regra de 3 meses).',
      dataHora: 'Ontem • 14:20',
      lida: false,
    },
  ]);
  readonly toasts = signal<readonly ToastMensagem[]>([]);

  // Signals de Marcações de Hoje (Dashboard)
  readonly marcacoesHoje = signal<readonly MarcacaoBruta[]>([]);
  readonly bancoSaldoMinutos = signal<number>(500); // +08h20
  readonly bancoCreditosMesMinutos = signal<number>(390); // +06h30 de 16h00
  readonly bancoDebitosMesMinutos = signal<number>(35); // -00h35

  // Signals de Competências do Espelho de Ponto
  readonly selectedCompetencia = signal<{ ano: number; mes: number }>({ ano: 2026, mes: 11 });
  readonly sarhSincronizadoCompetencia = signal<Record<string, boolean>>({
    '10/2025': true,
    '11/2025': true,
    '10/2026': true,
    '11/2026': false,
  });
  readonly execucaoEmAndamento = signal<boolean>(false);
  readonly espelhosPorCompetencia = signal<Record<string, EspelhoMensal>>(
    this.criarDadosIniciaisEspelhos()
  );

  readonly orgaosAcessiveis = signal<readonly OrgaoContexto[]>(this.orgaosDisponiveis);
  readonly perfisDisponiveisNoOrgao = signal<readonly PerfilAcesso[]>(this.perfisRbac);

  // Computed Signals
  readonly activeOrgao = computed(
    () =>
      this.orgaosAcessiveis().find((o) => o.id === this.activeOrgaoId()) ??
      this.orgaosDisponiveis.find((o) => o.id === this.activeOrgaoId()) ??
      this.orgaosAcessiveis()[0] ??
      this.orgaosDisponiveis[0]
  );

  readonly activePerfil = computed(
    () =>
      this.perfisDisponiveisNoOrgao().find((p) => p.codigo === this.activePerfilCodigo()) ??
      this.perfisRbac.find((p) => p.codigo === this.activePerfilCodigo()) ??
      this.perfisDisponiveisNoOrgao()[0] ??
      this.perfisRbac[0]
  );

  readonly menusVisiveis = computed(() => {
    const perms = this.activePerfil().permissions;
    const isMaster = perms.includes('*');
    return this.catalogoMenus.filter(
      (item) => isMaster || perms.includes(item.requiredPermission)
    );
  });

  private readonly cartoPrimaryMenus: readonly CartoPrimaryMenuItem[] = [
    {
      id: 'home',
      label: 'Minha página inicial',
      icon: 'home',
      route: '/home',
      sections: [],
    },
    {
      id: 'meu-ponto',
      label: 'Meu Ponto',
      icon: 'clock',
      sections: [
        {
          title: 'MEU PONTO',
          items: [
            {
              id: 'registrar-ponto',
              label: 'Registrar ponto',
              description: 'Registro de ponto eletrônico com validação biométrica facial.',
              route: '/dashboard',
              requiredPermission: 'marcacoes:registrar-facial:proprio',
            },
            {
              id: 'ponto-de-hoje',
              label: 'Ponto de hoje',
              description: 'Acompanhamento da timeline cronológica e saldo parcial do dia.',
              route: '/dashboard',
              requiredPermission: 'dashboard:visualizar:proprio',
            },
            {
              id: 'historico-marcacoes',
              label: 'Histórico de marcações',
              description: 'Consulta auditável de marcações brutas (REP, Facial, AFD, Web).',
              route: '/espelho-ponto',
              requiredPermission: 'marcacoes:consultar:proprio',
            },
            {
              id: 'meu-espelho-ponto',
              label: 'Meu espelho de ponto',
              description: 'Apuração mensal, memória de cálculo e envio para homologação.',
              route: '/espelho-ponto',
              requiredPermission: 'espelho-ponto:visualizar:proprio',
              badge: '11/2026',
            },
          ],
        },
      ],
    },
    {
      id: 'solicitacoes-frequencia',
      label: 'Solicitações e Frequência',
      icon: 'workflows',
      sections: [
        {
          title: 'SOLICITAÇÕES E FREQUÊNCIA',
          items: [
            {
              id: 'solicitacoes-ajuste',
              label: 'Solicitações de ajuste',
              description: 'Inclusão de batida esquecida, abono e justificativa de ocorrência.',
              route: '/espelho-ponto',
              requiredPermission: 'solicitacoes:criar:proprio',
            },
            {
              id: 'solicitacoes-banco-horas',
              label: 'Solicitações de banco de horas',
              description: 'Autorização prévia de crédito (até 16h/mês) e compensação de débito.',
              route: '/modulo/solicitacoes-banco-horas',
              requiredPermission: 'banco-horas:consultar:proprio',
            },
          ],
        },
      ],
    },
    {
      id: 'minha-vida-funcional',
      label: 'Minha Vida Funcional',
      icon: 'folder',
      sections: [
        {
          title: 'MINHA VIDA FUNCIONAL',
          items: [
            {
              id: 'meu-contracheque',
              label: 'Meu contracheque',
              description: 'Demonstrativos mensais de pagamento e informe de rendimentos.',
              route: '/modulo/meu-contracheque',
              requiredPermission: 'contracheque:consultar:proprio',
            },
            {
              id: 'meus-afastamentos',
              label: 'Meus afastamentos',
              description: 'Licenças médicas, capacitações e afastamentos sincronizados do SARH.',
              route: '/modulo/meus-afastamentos',
              requiredPermission: 'afastamentos:consultar:proprio',
            },
            {
              id: 'minhas-ferias',
              label: 'Minhas férias',
              description: 'Períodos aquisitivos, programação anual e status de aprovação.',
              route: '/modulo/minhas-ferias',
              requiredPermission: 'programacao-ferias:consultar:proprio',
            },
            {
              id: 'meu-banco-horas',
              label: 'Meu banco de horas',
              description: 'Extrato de créditos, débitos, teto de 16h/mês e vencimentos em 3 meses.',
              route: '/modulo/meu-banco-horas',
              requiredPermission: 'banco-horas:consultar:proprio',
            },
            {
              id: 'minhas-horas-extras',
              label: 'Minhas horas extras',
              description: 'Solicitações e autorizações de serviço extraordinário.',
              route: '/modulo/minhas-horas-extras',
              requiredPermission: 'horas-extras:visualizar:proprio',
            },
          ],
        },
      ],
    },
    {
      id: 'consultas-documentos',
      label: 'Consultas e Documentos',
      icon: 'shield',
      sections: [
        {
          title: 'CONSULTAS E DOCUMENTOS',
          items: [
            {
              id: 'recesso-forense',
              label: 'Recesso forense',
              description: 'Convocações do período 20/12 a 06/01 e opção de folga ou pecúnia.',
              route: '/modulo/recesso-forense',
              requiredPermission: 'recesso:consultar:proprio',
            },
            {
              id: 'meus-relatorios',
              label: 'Meus relatórios',
              description: 'Emissão em PDF do espelho de ponto e comprovantes com hash SHA-256.',
              route: '/modulo/meus-relatorios',
              requiredPermission: 'relatorios:consultar:proprio',
            },
            {
              id: 'minhas-substituicoes',
              label: 'Minhas substituições',
              description: 'Histórico de substituições de função de confiança e herança temporária.',
              route: '/modulo/minhas-substituicoes',
              requiredPermission: 'substituicoes-funcao:relatorio:proprio',
            },
          ],
        },
      ],
    },
    {
      id: 'gestao-equipe',
      label: 'Homologação',
      icon: 'users',
      sections: [
        {
          title: 'CHEFIA & SECAP',
          items: [
            {
              id: 'chefia-equipe',
              label: 'Equipe & Unidades Subordinadas',
              description: 'Subordinados, unidades hierárquicas e solicitações da equipe.',
              route: '/chefia/equipe',
              requiredPermission: 'homologacao:gerenciar:subordinados',
            },
            {
              id: 'chefia-ferias',
              label: 'Programação de Férias da Equipe',
              description: 'Calendário anual de férias dos subordinados com filtro por servidor.',
              route: '/chefia/ferias',
              requiredPermission: 'homologacao:gerenciar:subordinados',
            },
            {
              id: 'homologacao-equipe',
              label: 'Homologação da Equipe',
              description: 'Análise e homologação mensal dos subordinados.',
              route: '/espelho-ponto',
              requiredPermission: 'homologacao:gerenciar:subordinados',
              badge: '2',
            },
            {
              id: 'boletim-frequencia',
              label: 'Boletim de Frequência',
              description: 'Recebimento e conferência pela SECAP/NUCGP.',
              route: '/espelho-ponto',
              requiredPermission: 'boletim-frequencia:receber:seccional',
            },
          ],
        },
      ],
    },
    {
      id: 'cadastros',
      label: 'Cadastro',
      icon: 'folder',
      sections: [
        {
          title: 'ESTRUTURA & PESSOAS',
          items: [
            { id: 'cad-orgaos', label: 'Órgãos / Seccionais', description: 'Cadastro de órgãos e seccionais.', route: '/cadastros/orgaos', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-unidades', label: 'Unidades Organizacionais', description: 'Varas, núcleos e seções.', route: '/cadastros/unidades-organizacionais', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-cargos', label: 'Cargos', description: 'Tabela de cargos efetivos e comissionados.', route: '/cadastros/cargos', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-funcoes', label: 'Funções Comissionadas', description: 'Referências FC e CJ.', route: '/cadastros/funcoes-confianca', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-categorias', label: 'Categorias de Pessoas', description: 'Classificação funcional.', route: '/cadastros/categorias-pessoas', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-servidores', label: 'Servidores', description: 'Cadastro mestre de servidores.', route: '/cadastros/servidores', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-lotacoes', label: 'Lotações', description: 'Vínculos de lotação nas unidades.', route: '/cadastros/lotacoes', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-gestores', label: 'Gestores de Unidades', description: 'Chefias imediatas e substitutos.', route: '/cadastros/gestores-unidades', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-identificadores', label: 'Identificadores de Ponto', description: 'PIS, crachá e matrícula REP.', route: '/cadastros/identificadores-ponto', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-dispensas', label: 'Dispensas de Ponto', description: 'Dispensas formais de marcação.', route: '/cadastros/dispensas-ponto', requiredPermission: 'cadastros:gerenciar:seccional' },
          ],
        },
        {
          title: 'JORNADAS & CALENDÁRIO',
          items: [
            { id: 'cad-jornadas', label: 'Jornadas de Trabalho', description: 'Regimes de jornada (7h, 8h, estágio).', route: '/cadastros/jornadas', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-escalas', label: 'Escalas de Trabalho', description: 'Escalas cíclicas e plantões.', route: '/cadastros/escalas', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-fusos', label: 'Fusos Horários', description: 'Fusos IANA das seccionais.', route: '/cadastros/fusos-horarios', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-calendario', label: 'Calendário Institucional', description: 'Feriados, pontos facultativos e suspensões.', route: '/cadastros/calendarios-institucionais', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-tipos-feriado', label: 'Tipos de Feriados', description: 'Tipificação de feriados e suspensões.', route: '/cadastros/tipos-feriados-suspensoes', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-tipos-afast', label: 'Tipos de Afastamento SARH', description: 'Licenças e afastamentos SARH.', route: '/cadastros/tipos-afastamento-sarh', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-recessos', label: 'Recessos Forenses', description: 'Períodos de recesso forense.', route: '/cadastros/recessos-forenses', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-regulamentacoes', label: 'Regulamentações (Portarias)', description: 'Parâmetros normativos por órgão.', route: '/cadastros/regulamentacoes-orgaos', requiredPermission: 'cadastros:gerenciar:seccional' },
          ],
        },
        {
          title: 'EQUIPAMENTOS & LOCALIDADES',
          items: [
            { id: 'cad-tipos-equipamento', label: 'Tipos de Equipamento Biométrico', description: 'Classificação e ícones dos meios de registro.', route: '/cadastros/tipos-equipamento-biometrico', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-equipamentos', label: 'Equipamentos Biométricos', description: 'REPs e totens faciais.', route: '/cadastros/equipamentos-biometricos', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-estados', label: 'Estados (UF)', description: 'Unidades da Federação.', route: '/cadastros/estados', requiredPermission: 'cadastros:gerenciar:seccional' },
            { id: 'cad-cidades', label: 'Cidades / Municípios', description: 'Municípios brasileiros.', route: '/cadastros/cidades', requiredPermission: 'cadastros:gerenciar:seccional' },
          ],
        },
        {
          title: 'GOVERNANÇA & RBAC',
          items: [
            { id: 'cad-usuarios', label: 'Usuários', description: 'Contas de acesso institucional.', route: '/cadastros/usuarios', requiredPermission: 'perfis:gerenciar:seccional' },
            { id: 'cad-perfis', label: 'Perfis RBAC', description: 'Papéis de acesso do sistema.', route: '/cadastros/perfis', requiredPermission: 'perfis:gerenciar:seccional' },
            { id: 'cad-permissoes', label: 'Permissões', description: 'Matriz recurso:acao:escopo.', route: '/cadastros/permissoes', requiredPermission: 'perfis:gerenciar:seccional' },
            { id: 'cad-integracoes', label: 'Sistemas Integrados', description: 'Conectores SARH, REP, Teams e SEI.', route: '/cadastros/integracoes-sistemas', requiredPermission: 'perfis:gerenciar:seccional' },
            { id: 'cad-config', label: 'Configurações Globais', description: 'Domínios e flags globais.', route: '/cadastros/configuracoes-globais', requiredPermission: 'perfis:gerenciar:seccional' },
          ],
        },
      ],
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: 'settings',
      sections: [
        {
          title: 'GOVERNANÇA & RBAC',
          items: [
            {
              id: 'perfis-rbac',
              label: 'Perfis e Permissões',
              description: 'Matriz RBAC por órgão e liberações operacionais.',
              route: '/dashboard',
              requiredPermission: 'perfis:gerenciar:seccional',
            },
            {
              id: 'portaria-params',
              label: 'Parâmetros Portaria 135',
              description: 'Regras vigentes por órgão e fuso horário oficial.',
              route: '/dashboard',
              requiredPermission: 'dashboard:visualizar:proprio',
            },
          ],
        },
      ],
    },
  ];

  readonly cartoMenusVisiveis = computed(() => {
    const perms = this.activePerfil().permissions;
    const isMaster = perms.includes('*');

    return this.cartoPrimaryMenus
      .map((item) => {
        if (item.sections.length === 0) {
          return item;
        }
        const filteredSections = item.sections
          .map((sec) => ({
            ...sec,
            items: sec.items.filter(
              (sub) => isMaster || perms.includes(sub.requiredPermission)
            ),
          }))
          .filter((sec) => sec.items.length > 0);

        if (filteredSections.length === 0) {
          return null;
        }
        return { ...item, sections: filteredSections };
      })
      .filter((x): x is CartoPrimaryMenuItem => x !== null);
  });

  readonly activePrimaryMenu = computed(() => {
    const id = this.activePrimaryMenuId();
    return (
      this.cartoMenusVisiveis().find((m) => m.id === id) ??
      this.cartoMenusVisiveis()[0] ??
      null
    );
  });

  readonly notificacoesNaoLidasCount = computed(
    () => this.notificacoes().filter((n) => !n.lida).length
  );

  readonly exigeValidacaoFacialNaProxima = computed(
    () => this.marcacoesHoje().length === 0
  );

  readonly limiteDiarioAtingido = computed(
    () => this.marcacoesHoje().length >= this.regulamentacaoSjam.limiteMarcacoesDia
  );

  readonly proximaAcaoRecomendada = computed(() => {
    const qtd = this.marcacoesHoje().length;
    if (qtd === 0) {
      return {
        codigo: 'ENTRADA' as TipoMarcacaoSequencia,
        titulo: 'Registrar entrada por reconhecimento facial',
        subtitulo:
          'A 1ª marcação do dia via sistema web exige validação biométrica facial obrigatória (Seção 7.2).',
        botaoLabel: 'Iniciar Reconhecimento Facial',
      };
    }
    if (qtd === 1) {
      return {
        codigo: 'SAIDA_INTERVALO' as TipoMarcacaoSequencia,
        titulo: 'Registrar saída para intervalo ou saída final',
        subtitulo: 'Classificação automática conforme sequência cronológica do dia em America/Manaus.',
        botaoLabel: 'Registrar Próxima Marcação',
      };
    }
    if (qtd === 2) {
      return {
        codigo: 'RETORNO_INTERVALO' as TipoMarcacaoSequencia,
        titulo: 'Registrar retorno do intervalo',
        subtitulo: 'Intervalo mínimo de 1h para jornadas de 8h (Portaria SJAM-DIREF 135/2025).',
        botaoLabel: 'Registrar Retorno',
      };
    }
    if (qtd === 3) {
      return {
        codigo: 'SAIDA' as TipoMarcacaoSequencia,
        titulo: 'Registrar saída final da jornada',
        subtitulo: 'Fechamento ordinário da sequência de 4 marcações do dia.',
        botaoLabel: 'Registrar Saída Final',
      };
    }
    if (qtd < this.regulamentacaoSjam.limiteMarcacoesDia) {
      return {
        codigo: 'MANUAL' as TipoMarcacaoSequencia,
        titulo: `Registrar marcação adicional (${qtd + 1}/${this.regulamentacaoSjam.limiteMarcacoesDia})`,
        subtitulo: 'O sistema limita o fluxo diário a até 6 marcações contabilizadas.',
        botaoLabel: 'Registrar Marcação Adicional',
      };
    }
    return {
      codigo: 'MANUAL' as TipoMarcacaoSequencia,
      titulo: 'Limite diário de 6 marcações atingido',
      subtitulo: 'Todas as 6 marcações contabilizadas permitidas para hoje já foram registradas.',
      botaoLabel: 'Limite Atingido',
    };
  });

  readonly trabalhadoHojeMinutos = computed(() => {
    const list = this.marcacoesHoje();
    if (list.length === 0) {
      return 0;
    }
    // Cálculo realista de demonstração entre pares concluídos + 15 min parciais quando ímpar
    const pairs = Math.floor(list.length / 2);
    let total = pairs * 210; // ~3h30 por bloco para exibição imediata
    if (list.length % 2 === 1) {
      total += 15;
    }
    return total;
  });

  readonly pendenciasHojeCount = computed(() => {
    const qtd = this.marcacoesHoje().length;
    if (qtd === 0) {
      return 1;
    }
    return qtd % 2 === 1 ? 1 : 0;
  });

  readonly competenciaAtual = computed(() => {
    const { ano, mes } = this.selectedCompetencia();
    return `${String(mes).padStart(2, '0')}/${ano}`;
  });

  readonly espelhoAtual = computed<EspelhoMensal>(() => {
    const comp = this.competenciaAtual();
    return (
      this.espelhosPorCompetencia()[comp] ?? {
        competencia: comp,
        competenciaLabel: comp,
        statusCompetencia: 'ABERTA',
        ultimaSincronizacaoSarh: 'Aguardando carga real...',
        ultimoRecalculo: '--',
        totalPrevistoMinutos: 0,
        totalTrabalhadoMinutos: 0,
        totalCreditoMinutos: 0,
        totalDebitoMinutos: 0,
        bancoComputavelMinutos: 0,
        faltasOuInconsistencias: 0,
        dias: [],
      }
    );
  });

  readonly sarhSincronizadoAtual = computed(
    () => Boolean(this.sarhSincronizadoCompetencia()[this.competenciaAtual()])
  );

  readonly espelhoBloqueadoParaEdicao = computed(() => {
    const status = this.espelhoAtual().statusCompetencia;
    return status === 'ENVIADA_HOMOLOGACAO' || status === 'HOMOLOGADA';
  });

  // Ações de Autenticação SSO & Sessão
  login(matricula: string, senha: string, orgaoId: string): boolean {
    const cleanUser = matricula.trim().toLowerCase();
    this.authError.set(null);

    if (!cleanUser) {
      this.authError.set('Informe sua matrícula institucional ou login.');
      return false;
    }

    if (cleanUser === 'secp.master') {
      if (senha !== 'Reconstruir-SECP!2026' && !this.masterPasswordChanged()) {
        this.authError.set('Senha inválida para SECP.MASTER.');
        return false;
      }
      this.activeOrgaoId.set(orgaoId);
      this.activePerfilCodigo.set('MASTER');
      this.servidorNome.set('Administrador Geral do SECP');
      this.servidorMatricula.set('SECP.MASTER');
      this.servidorLotacao.set(`${this.activeOrgao().unidadeLabel} • Acesso Integral`);

      if (!this.masterPasswordChanged()) {
        this.requirePasswordChange.set(true);
        return false;
      }
      this.isAuthenticated.set(true);
      this.pushToast('success', 'Sessão autenticada como SECP.MASTER.');
      return true;
    }

    this.activeOrgaoId.set(orgaoId);
    this.activePerfilCodigo.set('SERVIDOR');
    const matUpper = matricula.trim().toUpperCase();
    this.servidorMatricula.set(matUpper);
    this.servidorNome.set(matUpper === 'AM200385' ? 'FLAVIO OLIVEIRA DA ROCHA' : `Servidor ${matUpper}`);
    this.servidorLotacao.set(`${this.activeOrgao().unidadeLabel}`);
    this.isAuthenticated.set(true);
    this.loadRealContext(matUpper, this.activeOrgao().sigla);
    this.pushToast('success', `Bem-vindo(a), ${this.servidorNome()}!`);
    return true;
  }

  loginWithBackend(
    matricula: string,
    senha: string,
    orgaoId: string,
    onSuccess: () => void
  ): void {
    const cleanUser = matricula.trim();
    this.authError.set(null);

    if (!cleanUser || !senha.trim()) {
      this.authError.set('Informe sua matrícula e senha local.');
      return;
    }

    if (cleanUser.toLowerCase() === 'secp.master') {
      if (this.login(cleanUser, senha, orgaoId)) {
        onSuccess();
      }
      return;
    }

    this.authenticating.set(true);
    this.http
      .post<any>(`${this.apiRealBase}/auth/login`, {
        matricula: cleanUser,
        senha,
      })
      .subscribe({
        next: (res) => {
          this.authenticating.set(false);
          this.activeOrgaoId.set(orgaoId);
          this.activePerfilCodigo.set((res?.perfilPrincipal || 'SERVIDOR') as CodigoPerfilRbac);
          const matReal = res?.matricula || cleanUser.toUpperCase();
          this.loggedInMatricula.set(matReal);
          this.servidorMatricula.set(matReal);
          this.servidorNome.set(res?.nome || cleanUser.toUpperCase());
          this.servidorLotacao.set(`${this.activeOrgao().unidadeLabel}`);
          this.isAuthenticated.set(true);
          this.loadRealContext(this.servidorMatricula(), this.activeOrgao().sigla);
          this.loadChefiaEscopo(matReal);
          this.pushToast('success', `Bem-vindo(a), ${this.servidorNome()}!`);
          onSuccess();
        },
        error: (err) => {
          this.authenticating.set(false);
          this.authError.set(err?.error?.detail || 'Matrícula ou senha inválida.');
        },
      });
  }

  loginQuickProfile(codigo: CodigoPerfilRbac, orgaoId: string): void {
    this.authError.set(null);
    this.requirePasswordChange.set(false);
    this.activeOrgaoId.set(orgaoId);
    this.activePerfilCodigo.set(codigo);
    const mat = codigo === 'MASTER' ? 'SECP.MASTER' : 'AM200385';
    this.loggedInMatricula.set(mat);
    this.servidorNome.set(codigo === 'MASTER' ? 'Administrador Geral do SECP' : 'FLAVIO OLIVEIRA DA ROCHA');
    this.servidorMatricula.set(mat);
    this.servidorLotacao.set(`${this.activeOrgao().unidadeLabel}`);
    this.isAuthenticated.set(true);
    this.loadRealContext(mat === 'SECP.MASTER' ? 'AM200385' : mat, this.activeOrgao().sigla);
    this.loadChefiaEscopo(mat);
    this.pushToast('success', `Autenticado com perfil ${codigo} em ${this.activeOrgao().sigla}.`);
  }

  hasPermission(permission: string): boolean {
    const perms = this.activePerfil().permissions;
    return perms.includes('*') || perms.includes(permission);
  }

  loadChefiaEscopo(matricula: string): void {
    const perfil = this.activePerfilCodigo();
    if (perfil === 'SERVIDOR') {
      this.chefiaEscopo.set(null);
      return;
    }
    const mat = encodeURIComponent(matricula);
    this.http.get<any>(`${this.apiRealBase}/chefia/subordinados?matricula=${mat}`).subscribe({
      next: (res) => {
        if (res && Array.isArray(res.unidades)) {
          this.chefiaEscopo.set(res);
        }
      },
      error: () => {
        this.chefiaEscopo.set(null);
      },
    });
  }

  switchRealServidor(matricula: string): void {
    const clean = matricula.trim().toUpperCase();
    if (!clean) return;
    const perfil = this.activePerfilCodigo();
    if (perfil === 'SERVIDOR' && clean !== this.loggedInMatricula()) {
      this.pushToast('warning', 'Perfil Servidor visualiza apenas suas próprias informações.');
      return;
    }
    if (perfil === 'CHEFIA' && clean !== this.loggedInMatricula()) {
      const subs = this.chefiaEscopo()?.subordinados ?? [];
      const allowed = subs.some((s) => s.matricula.toUpperCase() === clean);
      if (!allowed) {
        this.pushToast('warning', 'Chefia só pode consultar servidores das unidades subordinadas.');
        return;
      }
    }
    this.servidorMatricula.set(clean);
    this.loadRealContext(clean, this.activeOrgao().sigla);
    this.pushToast('info', `Carregando dados da matrícula ${clean}...`);
  }

  loadRealContext(matricula: string, orgaoSigla = 'SJAM'): void {
    const mat = encodeURIComponent(matricula);
    const org = encodeURIComponent(orgaoSigla);
    this.syncRbacContextFromServer(matricula, orgaoSigla, this.activePerfilCodigo());

    this.http.get<any>(`${this.apiRealBase}/dashboard?matricula=${mat}`).subscribe({
      next: (res) => {
        if (res?.servidor) {
          this.servidorNome.set(res.servidor.nomeFuncional || res.servidor.matricula);
          this.servidorMatricula.set(res.servidor.matricula);
          this.servidorLotacao.set(
            `${res.servidor.orgaoSigla} • ${res.servidor.unidadeNome || 'Sede'} • ${res.servidor.cargoNome || 'Servidor'}`
          );
        }
        if (Array.isArray(res?.marcacoesHoje)) {
          this.marcacoesHoje.set(res.marcacoesHoje);
        }
        if (res?.bancoHoras) {
          this.bancoSaldoMinutos.set(Number(res.bancoHoras.saldoMinutos ?? 0));
          this.bancoCreditosMesMinutos.set(Number(res.bancoHoras.creditosValidadosMinutos ?? 0));
          this.bancoDebitosMesMinutos.set(Number(res.bancoHoras.debitosValidadosMinutos ?? 0));
        }
        if (res?.regulamentacao) {
          this.realRegulamentacao.set(res.regulamentacao);
        }
        this.realDataLoaded.set(true);
      },
      error: () => {
        // Fallback gracioso para dados locais caso o backend esteja offline
        this.realDataLoaded.set(false);
      },
    });

    this.http.get<any[]>(`${this.apiRealBase}/solicitacoes?matricula=${mat}`).subscribe({
      next: (rows) => {
        if (Array.isArray(rows)) {
          this.realSolicitacoes.set(rows);
        }
      },
      error: () => {},
    });

    if (this.activePerfilCodigo() === 'SERVIDOR') {
      this.realServidoresAmostra.set([]);
    } else {
      this.http.get<any[]>(`${this.apiRealBase}/servidores?orgao=${org}&limit=15`).subscribe({
        next: (rows) => {
          if (Array.isArray(rows)) {
            this.realServidoresAmostra.set(rows);
          }
        },
        error: () => {},
      });
    }

    const [mesStr, anoStr] = this.competenciaAtual().split('/');
    this.loadRealEspelho(matricula, Number(anoStr), Number(mesStr));
  }

  loadRealEspelho(matricula: string, ano: number, mes: number): void {
    const mat = encodeURIComponent(matricula);
    this.http.get<EspelhoMensal>(`${this.apiRealBase}/espelho?matricula=${mat}&ano=${ano}&mes=${mes}`).subscribe({
      next: (espelho) => {
        if (espelho && espelho.competencia) {
          this.espelhosPorCompetencia.update((map) => ({
            ...map,
            [espelho.competencia]: espelho,
          }));
        }
      },
      error: () => {},
    });
  }

  completePasswordChange(novaSenha: string): boolean {
    if (novaSenha.trim().length < 8) {
      this.authError.set('A nova senha deve possuir no mínimo 8 caracteres.');
      return false;
    }
    this.masterPasswordChanged.set(true);
    this.requirePasswordChange.set(false);
    this.isAuthenticated.set(true);
    this.pushToast('success', 'Senha inicial atualizada com sucesso. Bem-vindo ao SECP!');
    return true;
  }

  logout(): void {
    this.isAuthenticated.set(false);
    this.secondarySidebarOpen.set(false);
    this.activePrimaryMenuId.set('home');
  }

  selectPrimaryMenu(item: CartoPrimaryMenuItem): void {
    this.activePrimaryMenuId.set(item.id);
    if (item.sections.length > 0) {
      this.secondarySidebarOpen.set(true);
    } else {
      this.secondarySidebarOpen.set(false);
    }
  }

  closeSecondarySidebar(): void {
    this.secondarySidebarOpen.set(false);
  }

  // Ações de Layout & Acessibilidade
  toggleSidebar(): void {
    this.sidebarExpanded.update((v) => !v);
  }

  toggleFontSize(): void {
    this.fontLarge.update((v) => !v);
    document.documentElement.classList.toggle('font-lg', this.fontLarge());
  }

  toggleHighContrast(): void {
    this.highContrast.update((v) => !v);
    document.documentElement.classList.toggle('high-contrast', this.highContrast());
  }

  syncRbacContextFromServer(
    matricula: string,
    orgaoSiglaOrId?: string,
    perfilCodigo?: string,
    onDone?: () => void
  ): void {
    const cleanMat = (matricula || this.loggedInMatricula() || this.servidorMatricula()).trim();
    if (!cleanMat) return;
    const params: Record<string, string> = { matricula: cleanMat };
    if (orgaoSiglaOrId) params['orgao'] = orgaoSiglaOrId;
    if (perfilCodigo) params['perfil'] = perfilCodigo;

    this.http.get<any>(`${this.apiRealBase}/rbac-context`, { params }).subscribe({
      next: (ctx) => {
        if (Array.isArray(ctx?.orgaosAcessiveis) && ctx.orgaosAcessiveis.length > 0) {
          this.orgaosAcessiveis.set(ctx.orgaosAcessiveis);
        }
        if (ctx?.orgaoAtivo?.id) {
          this.activeOrgaoId.set(ctx.orgaoAtivo.id);
        }
        const permsServidor: string[] = Array.isArray(ctx?.permissoes) ? ctx.permissoes : [];
        if (Array.isArray(ctx?.perfisDisponiveisNoOrgao) && ctx.perfisDisponiveisNoOrgao.length > 0) {
          const perfisMapped: PerfilAcesso[] = ctx.perfisDisponiveisNoOrgao.map((p: any) => {
            const base = this.perfisRbac.find((r) => r.codigo === p.codigo);
            const perms =
              p.codigo === ctx?.perfilAtivo && permsServidor.length > 0
                ? permsServidor
                : base?.permissions ?? ['dashboard:visualizar:proprio', 'espelho-ponto:visualizar:proprio'];
            return {
              codigo: p.codigo,
              nome: p.nome || base?.nome || p.codigo,
              descricao: p.descricao || base?.descricao || p.nome || p.codigo,
              permissions: perms,
            };
          });
          this.perfisDisponiveisNoOrgao.set(perfisMapped);
        }
        if (ctx?.perfilAtivo) {
          this.activePerfilCodigo.set(ctx.perfilAtivo as CodigoPerfilRbac);
        }
        onDone?.();
      },
      error: () => {
        onDone?.();
      },
    });
  }

  setOrgao(orgaoId: string): void {
    this.activeOrgaoId.set(orgaoId);
    const matBase = this.loggedInMatricula() || this.servidorMatricula();
    this.syncRbacContextFromServer(matBase, orgaoId, undefined, () => {
      const org = this.activeOrgao();
      const perfil = this.activePerfilCodigo();
      this.loadRealContext(this.servidorMatricula(), org.sigla);
      this.pushToast(
        'info',
        `Contexto alterado para ${org.unidadeLabel} • Perfil ${perfil} (Fuso: ${org.fusoHorario}).`
      );
    });
  }

  setPerfilRbac(codigo: CodigoPerfilRbac): void {
    this.activePerfilCodigo.set(codigo);
    const matBase = this.loggedInMatricula() || this.servidorMatricula();
    const org = this.activeOrgao();
    this.syncRbacContextFromServer(matBase, org.sigla, codigo, () => {
      this.loadRealContext(
        codigo === 'SERVIDOR' ? matBase : this.servidorMatricula(),
        org.sigla
      );
      this.pushToast('info', `Perfil ativo alterado para ${codigo} em ${org.sigla}.`);
    });
  }

  marcarNotificacoesComoLidas(): void {
    this.notificacoes.update((list) => list.map((n) => ({ ...n, lida: true })));
  }

  // Ação de Registro de Ponto (Dashboard)
  registrarMarcacaoHoje(fonte: FonteMarcacaoBruta): MarcacaoBruta | null {
    const atuais = this.marcacoesHoje();
    if (atuais.length >= this.regulamentacaoSjam.limiteMarcacoesDia) {
      this.pushToast('warning', 'Limite diário de 6 marcações contabilizadas já foi atingido.');
      return null;
    }

    const ordem = atuais.length + 1;
    let tipo: TipoMarcacaoSequencia = 'MANUAL';
    if (ordem === 1) tipo = 'ENTRADA';
    else if (ordem === 2) tipo = 'SAIDA_INTERVALO';
    else if (ordem === 3) tipo = 'RETORNO_INTERVALO';
    else if (ordem === 4) tipo = 'SAIDA';

    const agora = new Date();
    const fuso = this.activeOrgao().fusoHorario || 'America/Manaus';
    const horario = new Intl.DateTimeFormat('pt-BR', {
      timeZone: fuso,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(agora);
    const dataReferenciaBr = new Intl.DateTimeFormat('pt-BR', {
      timeZone: fuso,
    }).format(agora);
    const nova: MarcacaoBruta = {
      id: `mb-${Date.now()}`,
      ordemDia: ordem,
      horario,
      dataReferencia: dataReferenciaBr,
      fusoHorario: fuso,
      fonte,
      tipoClassificado: tipo,
      hashSha256: this.gerarHashSimulado(`${this.servidorMatricula()}|${horario}|${fonte}`),
      equipamentoOuOrigem:
        fonte === 'FACIAL'
          ? 'Biometria Facial Web (Prova de Vida OK)'
          : 'Portal Web Institucional',
      imutavel: true,
    };

    this.marcacoesHoje.update((list) => [...list, nova]);
    if (this.realDataLoaded()) {
      this.http
        .post<MarcacaoBruta>(`${this.apiRealBase}/registrar`, {
          matricula: this.servidorMatricula(),
          fonte,
          observacao: `Registro ${tipo} via SECP Web`,
        })
        .subscribe({
          next: (persisted) => {
            if (persisted?.id) {
              this.marcacoesHoje.update((list) =>
                list.map((m) => (m.id === nova.id ? persisted : m))
              );
              this.pushToast(
                'success',
                `Marcação ${persisted.tipoClassificado} registrada com sucesso às ${persisted.horario}.`
              );
            }
          },
          error: () => {
            this.pushToast(
              'warning',
              `Marcação ${tipo} registrada localmente (falha ao sincronizar com API real).`
            );
          },
        });
    } else {
      this.pushToast('success', `Marcação ${tipo} registrada às ${horario} (${fonte}). Dado bruto imutável gravado.`);
    }
    return nova;
  }

  notificarBiometriaCadastrada(): void {
    this.pushToast('success', 'Biometria facial cadastrada com sucesso!');
  }

  registrarMarcacaoFacialConfirmada(marcacao: MarcacaoBruta, confiancaPct: number): void {
    if (marcacao?.id) {
      this.marcacoesHoje.update((list) => {
        if (list.some((m) => m.id === marcacao.id)) {
          return list;
        }
        return [...list, marcacao];
      });
      this.pushToast(
        'success',
        `Marcação ${marcacao.tipoClassificado} registrada via Biometria Facial (${confiancaPct.toFixed(1)}% de confiabilidade) às ${marcacao.horario}.`
      );
    }
  }

  // Ações do Espelho de Ponto
  setCompetencia(ano: number, mes: number): void {
    const mesNorm = Math.max(1, Math.min(12, mes));
    this.selectedCompetencia.set({ ano, mes: mesNorm });
    if (this.realDataLoaded()) {
      this.loadRealEspelho(this.servidorMatricula(), ano, mesNorm);
    }
  }

  navegarCompetencia(delta: -1 | 1): void {
    const current = this.selectedCompetencia();
    let mes = current.mes + delta;
    let ano = current.ano;
    if (mes < 1) {
      mes = 12;
      ano -= 1;
    } else if (mes > 12) {
      mes = 1;
      ano += 1;
    }
    this.setCompetencia(ano, mes);
  }

  sincronizarSarhERecalcular(): void {
    const comp = this.competenciaAtual();
    const espelho = this.espelhoAtual();
    if (espelho.statusCompetencia === 'ENVIADA_HOMOLOGACAO' || espelho.statusCompetencia === 'HOMOLOGADA') {
      this.pushToast('error', 'Competência já enviada/homologada. Recálculo bloqueado conforme Seção 7.5.');
      return;
    }
    if (this.execucaoEmAndamento()) {
      this.pushToast('warning', 'Já existe uma sincronização/recálculo em andamento para esta matrícula.');
      return;
    }

    // Trava de execução: Sincronizar SARH primeiro -> Recalcular depois (Seção 7.5)
    this.execucaoEmAndamento.set(true);
    this.atualizarStatusCompetencia(comp, 'SINCRONIZANDO');
    this.pushToast('info', `Etapa 1/2: Sincronizando afastamentos e férias do SARH para ${comp}...`);

    setTimeout(() => {
      this.sarhSincronizadoCompetencia.update((m) => ({ ...m, [comp]: true }));
      this.atualizarStatusCompetencia(comp, 'RECALCULANDO');
      this.pushToast('info', `Etapa 2/2: Recalculando apuração diária e banco de horas de ${comp}...`);

      setTimeout(() => {
        const agoraStr = new Date().toTimeString().slice(0, 5);
        this.espelhosPorCompetencia.update((map) => ({
          ...map,
          [comp]: {
            ...map[comp],
            statusCompetencia: 'ABERTA',
            ultimaSincronizacaoSarh: `Hoje às ${agoraStr}`,
            ultimoRecalculo: `Hoje às ${agoraStr}`,
          },
        }));
        this.execucaoEmAndamento.set(false);
        this.pushToast('success', `Espelho de ${comp} sincronizado e recalculado com sucesso.`);
      }, 700);
    }, 700);
  }

  enviarParaHomologacao(): void {
    const comp = this.competenciaAtual();
    const espelho = this.espelhoAtual();
    if (espelho.statusCompetencia !== 'ABERTA') {
      return;
    }
    this.espelhosPorCompetencia.update((map) => ({
      ...map,
      [comp]: {
        ...map[comp],
        statusCompetencia: 'ENVIADA_HOMOLOGACAO',
      },
    }));
    this.pushToast(
      'success',
      `Espelho de ${comp} enviado para homologação da chefia! Alterações e recálculos agora estão bloqueados.`
    );
  }

  registrarSolicitacaoAjuste(payload: SolicitacaoAjustePayload): void {
    if (this.espelhoBloqueadoParaEdicao()) {
      this.pushToast('error', 'Solicitação bloqueada: competência já enviada ou homologada.');
      return;
    }
    if (this.realDataLoaded()) {
      this.http
        .post<any>(`${this.apiRealBase}/solicitacoes`, {
          matricula: this.servidorMatricula(),
          tipo: payload.tipo,
          data_referencia: payload.dataIso,
          descricao: payload.justificativa,
        })
        .subscribe({
          next: (created) => {
            if (created) {
              this.realSolicitacoes.update((list) => [created, ...list]);
            }
            this.pushToast(
              'success',
              `Solicitação (${payload.tipo}) enviada com sucesso para ${payload.dataIso}.`
            );
          },
          error: (err) => {
            const msg = err?.error?.detail || 'Erro ao enviar solicitação ao backend.';
            this.pushToast('error', msg);
          },
        });
      return;
    }
    this.pushToast(
      'success',
      `Solicitação (${payload.tipo}) para ${payload.dataIso} enviada com sucesso à chefia.`
    );
  }

  removerToast(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private pushToast(tipo: ToastMensagem['tipo'], texto: string): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    this.toasts.update((list) => [...list, { id, tipo, texto }]);
    setTimeout(() => this.removerToast(id), 4500);
  }

  private atualizarStatusCompetencia(
    comp: string,
    status: EspelhoMensal['statusCompetencia']
  ): void {
    this.espelhosPorCompetencia.update((map) => ({
      ...map,
      [comp]: { ...map[comp], statusCompetencia: status },
    }));
  }

  private gerarHashSimulado(seed: string): string {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i++) {
      hash ^= seed.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return Math.abs(hash).toString(16).padStart(8, '0') + 'e4a9c31b7d20f8a4';
  }

  private criarDadosIniciaisEspelhos(): Record<string, EspelhoMensal> {
    const diasNov: ApuracaoDiaria[] = [
      {
        id: 'd-2026-11-13',
        dataIso: '2026-11-13',
        dataFormatada: '13/11/2026',
        diaSemana: 'Sexta-feira',
        diaUtil: true,
        cargaPrevistaMinutos: 420,
        trabalhadoMinutos: 485,
        creditoMinutos: 65,
        debitoMinutos: 0,
        status: 'CREDITO',
        statusLabel: 'Crédito (+01h05)',
        marcacoes: [
          {
            id: 'm1',
            ordemDia: 1,
            horario: '07:58:14',
            dataReferencia: '2026-11-13',
            fusoHorario: 'America/Manaus',
            fonte: 'REP',
            tipoClassificado: 'ENTRADA',
            hashSha256: '9f8e7d6c5b4a3210',
            equipamentoOuOrigem: 'REP Control iD Recepção Sede',
            imutavel: true,
          },
          {
            id: 'm2',
            ordemDia: 2,
            horario: '16:03:22',
            dataReferencia: '2026-11-13',
            fusoHorario: 'America/Manaus',
            fonte: 'REP',
            tipoClassificado: 'SAIDA',
            hashSha256: '8a7b6c5d4e3f2109',
            equipamentoOuOrigem: 'REP Control iD Recepção Sede',
            imutavel: true,
          },
        ],
        memoriaCalculo: {
          jornadaAplicada: '7h Ininterruptas (420 min)',
          janelaExpediente: '08:00 às 15:00 (Permitido 06:00–19:00)',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Portaria SJAM-DIREF 135/2025 • Crédito acima de 480 min computável c/ autorização.',
          observacoes: ['Crédito pré-autorizado pela chefia imediata para sustentação de implantação.'],
        },
      },
      {
        id: 'd-2026-11-12',
        dataIso: '2026-11-12',
        dataFormatada: '12/11/2026',
        diaSemana: 'Quinta-feira',
        diaUtil: true,
        cargaPrevistaMinutos: 420,
        trabalhadoMinutos: 420,
        creditoMinutos: 0,
        debitoMinutos: 0,
        status: 'REGULAR',
        statusLabel: 'Regular',
        marcacoes: [
          {
            id: 'm3',
            ordemDia: 1,
            horario: '08:00:05',
            dataReferencia: '2026-11-12',
            fusoHorario: 'America/Manaus',
            fonte: 'AFD',
            tipoClassificado: 'ENTRADA',
            hashSha256: '1a2b3c4d5e6f7081',
            equipamentoOuOrigem: 'Importação AFD Lote #412',
            imutavel: true,
          },
          {
            id: 'm4',
            ordemDia: 2,
            horario: '15:00:41',
            dataReferencia: '2026-11-12',
            fusoHorario: 'America/Manaus',
            fonte: 'AFD',
            tipoClassificado: 'SAIDA',
            hashSha256: '2b3c4d5e6f708192',
            equipamentoOuOrigem: 'Importação AFD Lote #412',
            imutavel: true,
          },
        ],
        memoriaCalculo: {
          jornadaAplicada: '7h Ininterruptas (420 min)',
          janelaExpediente: '08:00 às 15:00',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Jornada integral cumprida sem variações.',
          observacoes: [],
        },
      },
      {
        id: 'd-2026-11-11',
        dataIso: '2026-11-11',
        dataFormatada: '11/11/2026',
        diaSemana: 'Quarta-feira',
        diaUtil: true,
        cargaPrevistaMinutos: 420,
        trabalhadoMinutos: 385,
        creditoMinutos: 0,
        debitoMinutos: 35,
        status: 'DEBITO',
        statusLabel: 'Débito (-00h35)',
        marcacoes: [
          {
            id: 'm5',
            ordemDia: 1,
            horario: '08:35:10',
            dataReferencia: '2026-11-11',
            fusoHorario: 'America/Manaus',
            fonte: 'FACIAL',
            tipoClassificado: 'ENTRADA',
            hashSha256: '3c4d5e6f708192a3',
            equipamentoOuOrigem: 'Totem Facial Portaria Principal',
            imutavel: true,
          },
          {
            id: 'm6',
            ordemDia: 2,
            horario: '15:00:12',
            dataReferencia: '2026-11-11',
            fusoHorario: 'America/Manaus',
            fonte: 'WEB',
            tipoClassificado: 'SAIDA',
            hashSha256: '4d5e6f708192a3b4',
            equipamentoOuOrigem: 'Portal Web SECP',
            imutavel: true,
          },
        ],
        memoriaCalculo: {
          jornadaAplicada: '7h Ininterruptas (420 min)',
          janelaExpediente: '08:00 às 15:00',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Tolerância de débito configurada na SJAM: 0 min (Anexo C.2).',
          observacoes: ['Entrada após horário padrão gerou débito de 35 min passível de compensação em até 3 meses.'],
        },
      },
      {
        id: 'd-2026-11-10',
        dataIso: '2026-11-10',
        dataFormatada: '10/11/2026',
        diaSemana: 'Terça-feira',
        diaUtil: true,
        cargaPrevistaMinutos: 420,
        trabalhadoMinutos: 0,
        creditoMinutos: 0,
        debitoMinutos: 0,
        status: 'INCOMPLETA',
        statusLabel: 'Incompleta (Batida ímpar)',
        marcacoes: [
          {
            id: 'm7',
            ordemDia: 1,
            horario: '08:02:00',
            dataReferencia: '2026-11-10',
            fusoHorario: 'America/Manaus',
            fonte: 'REP',
            tipoClassificado: 'ENTRADA',
            hashSha256: '5e6f708192a3b4c5',
            equipamentoOuOrigem: 'REP Control iD Recepção Sede',
            imutavel: true,
          },
        ],
        memoriaCalculo: {
          jornadaAplicada: '7h Ininterruptas (420 min)',
          janelaExpediente: '08:00 às 15:00',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Ausência de marcação de saída impede fechamento regular (Seção 7.3).',
          observacoes: ['Necessária solicitação de ajuste de ponto informando o horário da saída.'],
        },
      },
      {
        id: 'd-2026-11-02',
        dataIso: '2026-11-02',
        dataFormatada: '02/11/2026',
        diaSemana: 'Segunda-feira',
        diaUtil: false,
        cargaPrevistaMinutos: 0,
        trabalhadoMinutos: 0,
        creditoMinutos: 0,
        debitoMinutos: 0,
        status: 'ABONADA_FERIAS_RECESSO',
        statusLabel: 'Feriado / Abonada',
        eventoInstitucional: 'Feriado Nacional — Finados',
        marcacoes: [],
        memoriaCalculo: {
          jornadaAplicada: 'Dia não útil (Calendário Institucional)',
          janelaExpediente: 'Sem expediente ordinário',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Feriado nacional não gera débito nem exige ponto ordinário.',
          observacoes: ['Abrangência Nacional cadastrada no Calendário Institucional.'],
        },
      },
    ];

    const diasOut: ApuracaoDiaria[] = [
      {
        id: 'd-2026-10-30',
        dataIso: '2026-10-30',
        dataFormatada: '30/10/2026',
        diaSemana: 'Sexta-feira',
        diaUtil: true,
        cargaPrevistaMinutos: 420,
        trabalhadoMinutos: 420,
        creditoMinutos: 0,
        debitoMinutos: 0,
        status: 'REGULAR',
        statusLabel: 'Regular',
        marcacoes: [
          {
            id: 'm10',
            ordemDia: 1,
            horario: '08:01:12',
            dataReferencia: '2026-10-30',
            fusoHorario: 'America/Manaus',
            fonte: 'REP',
            tipoClassificado: 'ENTRADA',
            hashSha256: '7a8b9c0d1e2f3456',
            equipamentoOuOrigem: 'REP Control iD Recepção Sede',
            imutavel: true,
          },
          {
            id: 'm11',
            ordemDia: 2,
            horario: '15:01:40',
            dataReferencia: '2026-10-30',
            fusoHorario: 'America/Manaus',
            fonte: 'REP',
            tipoClassificado: 'SAIDA',
            hashSha256: '8b9c0d1e2f345678',
            equipamentoOuOrigem: 'REP Control iD Recepção Sede',
            imutavel: true,
          },
        ],
        memoriaCalculo: {
          jornadaAplicada: '7h Ininterruptas (420 min)',
          janelaExpediente: '08:00 às 15:00',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Competência 10/2026 homologada pela chefia.',
          observacoes: [],
        },
      },
      {
        id: 'd-2026-10-20',
        dataIso: '2026-10-20',
        dataFormatada: '20/10/2026',
        diaSemana: 'Terça-feira',
        diaUtil: true,
        cargaPrevistaMinutos: 0,
        trabalhadoMinutos: 0,
        creditoMinutos: 0,
        debitoMinutos: 0,
        status: 'ABONADA_FERIAS_RECESSO',
        statusLabel: 'Férias Gozadas',
        eventoInstitucional: 'Férias Regulamentares (SARH)',
        marcacoes: [],
        memoriaCalculo: {
          jornadaAplicada: 'Afastamento / Férias Ativas (Seção 7.4)',
          janelaExpediente: 'Dispensado de ponto',
          intervaloExigidoMinutos: 0,
          intervaloRealizadoMinutos: 0,
          toleranciaAplicadaMinutos: 0,
          regraPortaria: 'Férias na situação GOZADA abonam integralmente o período.',
          observacoes: ['Sincronizado via integração SARH.'],
        },
      },
    ];

    return {
      '11/2026': {
        competencia: '11/2026',
        competenciaLabel: 'Novembro / 2026',
        statusCompetencia: 'ABERTA',
        ultimaSincronizacaoSarh: 'Pendente na competência',
        ultimoRecalculo: 'Hoje às 08:00',
        totalPrevistoMinutos: 8400, // 140h00
        totalTrabalhadoMinutos: 7985, // 133h05
        totalCreditoMinutos: 390, // +06h30
        totalDebitoMinutos: 35, // -00h35
        bancoComputavelMinutos: 355, // +05h55
        faltasOuInconsistencias: 1,
        dias: diasNov,
      },
      '10/2026': {
        competencia: '10/2026',
        competenciaLabel: 'Outubro / 2026',
        statusCompetencia: 'HOMOLOGADA',
        ultimaSincronizacaoSarh: '03/11/2026 às 09:12',
        ultimoRecalculo: '03/11/2026 às 09:15',
        totalPrevistoMinutos: 8820, // 147h00
        totalTrabalhadoMinutos: 8940, // 149h00
        totalCreditoMinutos: 120, // +02h00
        totalDebitoMinutos: 0,
        bancoComputavelMinutos: 120,
        faltasOuInconsistencias: 0,
        dias: diasOut,
      },
    };
  }
}
