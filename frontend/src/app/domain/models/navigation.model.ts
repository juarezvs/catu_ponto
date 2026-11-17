export type SecpViewMode = 'login-sso' | 'hub-launcher' | 'module-workspace';

export interface OrgaoScope {
  readonly id: string;
  readonly sigla: string;
  readonly nome: string;
  readonly unidadeAtiva: string;
  readonly tetoHoraExtraMensal: string;
}

export interface SecpUser {
  readonly id: string;
  readonly matricula: string;
  readonly name: string;
  readonly email: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly defaultOrgaoId: string;
  readonly avatarInitials: string;
  readonly allowedModules: readonly string[];
  readonly permissions: readonly string[];
}

export interface SecpModuleCard {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly themeColorHex: string;
  readonly tailwindAccent: string;
  readonly icon: string;
  readonly badgeText: string;
  readonly statsLabel: string;
}

export interface SsoSessionResponse {
  readonly token: string;
  readonly user: SecpUser;
  readonly activeOrgao: OrgaoScope;
  readonly availableOrgaos: readonly OrgaoScope[];
  readonly allProfiles: readonly SecpUser[];
  readonly requirePasswordChange?: boolean;
}

export interface HubModulesResponse {
  readonly user: SecpUser;
  readonly activeOrgao: OrgaoScope;
  readonly availableOrgaos: readonly OrgaoScope[];
  readonly modules: readonly SecpModuleCard[];
}

export interface NavigationSubItem {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly badge?: string | null;
}

export interface NavigationSection {
  readonly id: string;
  readonly title: string;
  readonly items: readonly NavigationSubItem[];
}

export interface NavigationItem {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly hasSecondaryMenu: boolean;
  readonly sections: readonly NavigationSection[];
}

export interface CadastroColumn {
  readonly key: string;
  readonly label: string;
  readonly type: 'text' | 'badge' | 'code' | 'status' | string;
}

export interface CadastroMetric {
  readonly label: string;
  readonly value: string;
  readonly trend: string;
}

export interface CadastroModuleContent {
  readonly slug: string;
  readonly title: string;
  readonly subtitle: string;
  readonly category: string;
  readonly primaryActionLabel: string;
  readonly metrics: readonly CadastroMetric[];
  readonly columns: readonly CadastroColumn[];
  readonly records: readonly Record<string, string>[];
}

export interface ModuleWorkspaceResponse {
  readonly module: SecpModuleCard;
  readonly user: SecpUser;
  readonly activeOrgao: OrgaoScope;
  readonly menuItems: readonly NavigationItem[];
  readonly dashboard: CadastroModuleContent;
}

export interface SragCitation {
  readonly lawReference: string;
  readonly excerpt: string;
  readonly orgaoScope: string;
}

export interface SragQueryResponse {
  readonly question: string;
  readonly answer: string;
  readonly citations: readonly SragCitation[];
  readonly confidenceScore: number;
  readonly guardrailStatus: string;
}

export interface TimelinePosicao {
  readonly ordem: number;
  readonly tipo: string;
  readonly titulo: string;
  readonly horario?: string | null;
  readonly fonte?: string | null;
  readonly concluido: boolean;
}

export interface MarcacaoPonto {
  readonly id: string;
  readonly tipo: string;
  readonly fonte: string;
  readonly horarioLabel: string;
  readonly hashSha256: string;
}

export interface PontoDashboard {
  readonly usuarioId: string;
  readonly servidorNome: string;
  readonly unidadeLabel: string;
  readonly jornadaNome: string;
  readonly jornadaPrevistaFormatado: string;
  readonly trabalhadoHojeFormatado: string;
  readonly saldoBancoFormatado: string;
  readonly pendenciasCount: number;
  readonly proximaAcaoCodigo: string;
  readonly proximaAcaoLabel: string;
  readonly exigeBiometriaFacial: boolean;
  readonly frequenciaMesPercentual: number;
  readonly diasRegularesMes: number;
  readonly diasUteisMes: number;
  readonly timelineDia: readonly TimelinePosicao[];
  readonly marcacoesHoje: readonly MarcacaoPonto[];
}

export interface EspelhoDia {
  readonly data: string;
  readonly diaSemana: string;
  readonly jornadaPrevista: string;
  readonly marcacoes: readonly string[];
  readonly trabalhado: string;
  readonly credito: string;
  readonly debito: string;
  readonly situacao: string;
  readonly observacao?: string | null;
}

export interface MovimentoBanco {
  readonly id: string;
  readonly data: string;
  readonly tipo: string;
  readonly minutosFormatado: string;
  readonly status: string;
  readonly descricao: string;
  readonly expiraEm?: string | null;
}

export interface BancoHorasResumo {
  readonly saldoAtualFormatado: string;
  readonly creditosMesFormatado: string;
  readonly limiteMensalFormatado: string;
  readonly percentualLimiteUsado: number;
  readonly debitosMesFormatado: string;
  readonly creditosAVencerFormatado: string;
  readonly horasAcimaLimiteFormatado: string;
  readonly movimentos: readonly MovimentoBanco[];
}

export interface HomologacaoItem {
  readonly id: string;
  readonly usuarioId: string;
  readonly servidorNome: string;
  readonly matricula: string;
  readonly unidade: string;
  readonly competencia: string;
  readonly status: string;
  readonly trabalhadoFormatado: string;
  readonly creditoFormatado: string;
  readonly debitoFormatado: string;
  readonly faltas: number;
  readonly pendenciasResumo?: string | null;
  readonly homologadoPor?: string | null;
}

export interface CrudFieldSchema {
  readonly key: string;
  readonly label: string;
  readonly fieldType: string;
  readonly required: boolean;
  readonly options: readonly string[];
}

export interface CrudListResponse {
  readonly resource: string;
  readonly title: string;
  readonly subtitle: string;
  readonly primaryActionLabel: string;
  readonly fields: readonly CrudFieldSchema[];
  readonly columns: readonly CadastroColumn[];
  readonly records: readonly Record<string, string>[];
  readonly total: number;
}

export interface RbacPerfil {
  readonly id: string;
  readonly codigo: string;
  readonly nome: string;
  readonly descricao: string;
  readonly sistema: boolean;
  readonly ativo: boolean;
  readonly administrativo: boolean;
  readonly globalScope: boolean;
  readonly orgaoId?: string | null;
  readonly permissoesCodigos: readonly string[];
}

export interface RbacPermissao {
  readonly id: string;
  readonly codigo: string;
  readonly recurso: string;
  readonly acao: string;
  readonly escopo: string;
  readonly descricao: string;
}

export interface RbacOrgaoOverride {
  readonly perfilId: string;
  readonly permissaoCodigo: string;
  readonly orgaoId: string;
  readonly permitida: boolean;
}

export interface RbacUsuarioPerfil {
  readonly id: string;
  readonly usuarioId: string;
  readonly usuarioNome: string;
  readonly perfilId: string;
  readonly perfilCodigo: string;
  readonly perfilNome: string;
  readonly orgaoId?: string | null;
  readonly ativo: boolean;
}

export interface RbacLiberacaoRotina {
  readonly id: string;
  readonly tipo: string;
  readonly chave: string;
  readonly descricao: string;
  readonly liberada: boolean;
}

export interface RbacMatrixResponse {
  readonly perfis: readonly RbacPerfil[];
  readonly permissoes: readonly RbacPermissao[];
  readonly orgaoOverrides: readonly RbacOrgaoOverride[];
  readonly usuariosPerfis: readonly RbacUsuarioPerfil[];
  readonly rotinas: readonly RbacLiberacaoRotina[];
}
