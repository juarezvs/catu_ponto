import { InjectionToken, Signal } from '@angular/core';
import {
  BancoHorasResumo,
  CadastroModuleContent,
  CrudListResponse,
  EspelhoDia,
  HomologacaoItem,
  MarcacaoPonto,
  NavigationItem,
  NavigationSubItem,
  OrgaoScope,
  PontoDashboard,
  RbacMatrixResponse,
  SecpModuleCard,
  SecpUser,
  SecpViewMode,
  SragQueryResponse,
} from '../../../domain/models/navigation.model';

/**
 * Inbound Port (Driving Port) para o Shell Layout do SECP interagir com os Casos de Uso.
 */
export interface WorkspaceNavigationUseCasePort {
  readonly viewMode: Signal<SecpViewMode>;
  readonly allProfiles: Signal<readonly SecpUser[]>;
  readonly currentUser: Signal<SecpUser | null>;
  readonly availableOrgaos: Signal<readonly OrgaoScope[]>;
  readonly activeOrgao: Signal<OrgaoScope | null>;
  readonly hubModules: Signal<readonly SecpModuleCard[]>;
  readonly activeModule: Signal<SecpModuleCard | null>;
  readonly menuItems: Signal<readonly NavigationItem[]>;
  readonly activePrimaryItem: Signal<NavigationItem | null>;
  readonly activeSubItem: Signal<NavigationSubItem | null>;
  readonly currentModuleContent: Signal<CadastroModuleContent | null>;
  readonly isPrimarySidebarExpanded: Signal<boolean>;
  readonly isSecondarySidebarVisible: Signal<boolean>;
  readonly isSecondarySidebarPinned: Signal<boolean>;
  readonly isSragCopilotOpen: Signal<boolean>;
  readonly sragLastResponse: Signal<SragQueryResponse | null>;
  readonly pontoDashboard: Signal<PontoDashboard | null>;
  readonly espelhoPonto: Signal<readonly EspelhoDia[]>;
  readonly bancoHoras: Signal<BancoHorasResumo | null>;
  readonly homologacaoQueue: Signal<readonly HomologacaoItem[]>;
  readonly ultimoComprovantePonto: Signal<MarcacaoPonto | null>;
  readonly activeCrudData: Signal<CrudListResponse | null>;
  readonly rbacMatrix: Signal<RbacMatrixResponse | null>;
  readonly requirePasswordChange: Signal<boolean>;
  readonly authError: Signal<string | null>;
  readonly isLoading: Signal<boolean>;

  initializePlatform(defaultUserId?: string): void;
  authenticateSso(userId: string, orgaoId?: string, password?: string): void;
  completePasswordChange(newPassword: string): void;
  logoutSso(): void;
  openHubLauncher(): void;
  enterModule(moduleSlug: string): void;
  goToModuleMainScreen(): void;
  switchUserProfile(userId: string): void;
  switchOrgaoContext(orgaoId: string): void;
  togglePrimarySidebar(): void;
  selectPrimaryItem(item: NavigationItem): void;
  selectSubItem(subItem: NavigationSubItem): void;
  closeSecondarySidebar(): void;
  togglePinSecondarySidebar(): void;
  toggleSragCopilot(): void;
  askSragCopilot(question: string): void;
  registrarPonto(fonte: string, observacao?: string): void;
  homologarServidor(homologacaoId: string): void;
  saveCrudRecord(resource: string, payload: Record<string, string>, itemId?: string): void;
  deleteCrudRecord(resource: string, itemId: string): void;
  createRbacPerfil(payload: { codigo: string; nome: string; descricao: string; administrativo: boolean; globalScope: boolean }): void;
  deleteRbacPerfil(perfilId: string): void;
  toggleRbacPerfilPermissao(perfilId: string, permissaoCodigo: string): void;
  setRbacOrgaoOverride(perfilId: string, orgaoId: string, permissaoCodigo: string, permitida: boolean | null): void;
  assignRbacUsuarioPerfil(usuarioId: string, perfilId: string, orgaoId?: string): void;
  removeRbacUsuarioPerfil(vinculoId: string): void;
  toggleRbacRotina(rotinaId: string): void;
}

export const WORKSPACE_NAVIGATION_USE_CASE =
  new InjectionToken<WorkspaceNavigationUseCasePort>(
    'WORKSPACE_NAVIGATION_USE_CASE'
  );
