import { computed, inject, Injectable, signal } from '@angular/core';
import { WorkspaceNavigationUseCasePort } from '../ports/inbound/workspace-navigation.port';
import { NAVIGATION_GATEWAY_PORT } from '../ports/outbound/navigation-gateway.port';
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
} from '../../domain/models/navigation.model';

@Injectable()
export class WorkspaceNavigationUseCase implements WorkspaceNavigationUseCasePort {
  private readonly gateway = inject(NAVIGATION_GATEWAY_PORT);

  private readonly _viewMode = signal<SecpViewMode>('hub-launcher');
  private readonly _allProfiles = signal<readonly SecpUser[]>([]);
  private readonly _currentUser = signal<SecpUser | null>(null);
  private readonly _availableOrgaos = signal<readonly OrgaoScope[]>([]);
  private readonly _activeOrgao = signal<OrgaoScope | null>(null);
  private readonly _hubModules = signal<readonly SecpModuleCard[]>([]);
  private readonly _activeModule = signal<SecpModuleCard | null>(null);
  private readonly _menuItems = signal<readonly NavigationItem[]>([]);
  private readonly _activePrimaryItem = signal<NavigationItem | null>(null);
  private readonly _activeSubItem = signal<NavigationSubItem | null>(null);
  private readonly _currentModuleContent = signal<CadastroModuleContent | null>(null);
  private readonly _isPrimarySidebarExpanded = signal<boolean>(true);
  private readonly _isSecondaryForceClosed = signal<boolean>(false);
  private readonly _isSecondarySidebarPinned = signal<boolean>(true);
  private readonly _isSragCopilotOpen = signal<boolean>(false);
  private readonly _sragLastResponse = signal<SragQueryResponse | null>(null);
  private readonly _pontoDashboard = signal<PontoDashboard | null>(null);
  private readonly _espelhoPonto = signal<readonly EspelhoDia[]>([]);
  private readonly _bancoHoras = signal<BancoHorasResumo | null>(null);
  private readonly _homologacaoQueue = signal<readonly HomologacaoItem[]>([]);
  private readonly _ultimoComprovantePonto = signal<MarcacaoPonto | null>(null);
  private readonly _activeCrudData = signal<CrudListResponse | null>(null);
  private readonly _rbacMatrix = signal<RbacMatrixResponse | null>(null);
  private readonly _requirePasswordChange = signal<boolean>(false);
  private readonly _authError = signal<string | null>(null);
  private readonly _isLoading = signal<boolean>(false);

  readonly viewMode = this._viewMode.asReadonly();
  readonly allProfiles = this._allProfiles.asReadonly();
  readonly currentUser = this._currentUser.asReadonly();
  readonly availableOrgaos = this._availableOrgaos.asReadonly();
  readonly activeOrgao = this._activeOrgao.asReadonly();
  readonly hubModules = this._hubModules.asReadonly();
  readonly activeModule = this._activeModule.asReadonly();
  readonly menuItems = this._menuItems.asReadonly();
  readonly activePrimaryItem = this._activePrimaryItem.asReadonly();
  readonly activeSubItem = this._activeSubItem.asReadonly();
  readonly currentModuleContent = this._currentModuleContent.asReadonly();
  readonly isPrimarySidebarExpanded = this._isPrimarySidebarExpanded.asReadonly();
  readonly isSecondarySidebarPinned = this._isSecondarySidebarPinned.asReadonly();
  readonly isSragCopilotOpen = this._isSragCopilotOpen.asReadonly();
  readonly sragLastResponse = this._sragLastResponse.asReadonly();
  readonly pontoDashboard = this._pontoDashboard.asReadonly();
  readonly espelhoPonto = this._espelhoPonto.asReadonly();
  readonly bancoHoras = this._bancoHoras.asReadonly();
  readonly homologacaoQueue = this._homologacaoQueue.asReadonly();
  readonly ultimoComprovantePonto = this._ultimoComprovantePonto.asReadonly();
  readonly activeCrudData = this._activeCrudData.asReadonly();
  readonly rbacMatrix = this._rbacMatrix.asReadonly();
  readonly requirePasswordChange = this._requirePasswordChange.asReadonly();
  readonly authError = this._authError.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  readonly isSecondarySidebarVisible = computed(() => {
    if (this._isSecondaryForceClosed()) {
      return false;
    }
    const primary = this._activePrimaryItem();
    return Boolean(primary && primary.hasSecondaryMenu && primary.sections.length > 0);
  });

  initializePlatform(defaultUserId: string = 'secp.master'): void {
    this._isLoading.set(true);
    this.gateway.loginSso(defaultUserId).subscribe({
      next: (session) => {
        this._allProfiles.set(session.allProfiles);
        this._currentUser.set(session.user);
        this._availableOrgaos.set(session.availableOrgaos);
        this._activeOrgao.set(session.activeOrgao);
        this.loadHubModules(session.user.id, session.activeOrgao.id);
      },
      error: () => this._isLoading.set(false),
    });
  }

  authenticateSso(userId: string, orgaoId?: string, password?: string): void {
    this._isLoading.set(true);
    this._authError.set(null);
    this.gateway.loginSso(userId, orgaoId, password).subscribe({
      next: (session) => {
        this._allProfiles.set(session.allProfiles);
        this._currentUser.set(session.user);
        this._availableOrgaos.set(session.availableOrgaos);
        this._activeOrgao.set(session.activeOrgao);
        this._requirePasswordChange.set(Boolean(session.requirePasswordChange));
        if (!session.requirePasswordChange) {
          this._viewMode.set('hub-launcher');
          this.loadHubModules(session.user.id, session.activeOrgao.id);
        } else {
          this._isLoading.set(false);
        }
      },
      error: (err) => {
        this._authError.set(err?.error?.detail || 'Falha na autenticação SSO.');
        this._isLoading.set(false);
      },
    });
  }

  completePasswordChange(newPassword: string): void {
    const userId = this._currentUser()?.id ?? 'secp.master';
    this._authError.set(null);
    this.gateway.changeInitialPassword(userId, newPassword).subscribe({
      next: () => {
        this._requirePasswordChange.set(false);
        this._viewMode.set('hub-launcher');
        this.loadHubModules(userId, this._activeOrgao()?.id);
      },
      error: (err) => {
        this._authError.set(err?.error?.detail || 'Senha inválida (mínimo 8 caracteres).');
      },
    });
  }

  logoutSso(): void {
    this._activeModule.set(null);
    this._viewMode.set('login-sso');
  }

  openHubLauncher(): void {
    this._viewMode.set('hub-launcher');
    const userId = this._currentUser()?.id ?? 'admin';
    const orgaoId = this._activeOrgao()?.id;
    this.loadHubModules(userId, orgaoId);
  }

  enterModule(moduleSlug: string): void {
    const userId = this._currentUser()?.id ?? 'admin';
    const orgaoId = this._activeOrgao()?.id;
    this._isLoading.set(true);
    this.gateway.getModuleWorkspace(userId, moduleSlug, orgaoId).subscribe({
      next: (ws) => {
        this._activeModule.set(ws.module);
        this._currentUser.set(ws.user);
        this._activeOrgao.set(ws.activeOrgao);
        this._menuItems.set(ws.menuItems);
        this._viewMode.set('module-workspace');

        // No SECP Ponto ou SECP Identidade, abre na Tela Principal (Dashboard); nos demais, abre Cadastros se disponível
        const initialItem =
          moduleSlug === 'secp-ponto' || moduleSlug === 'secp-identidade'
            ? ws.menuItems.find((i) => i.id === 'dashboard') ?? ws.menuItems[0] ?? null
            : ws.menuItems.find((i) => i.id === 'cadastros') ?? ws.menuItems[0] ?? null;

        if (initialItem) {
          this.selectPrimaryItem(initialItem);
        } else {
          this._currentModuleContent.set(ws.dashboard);
          this._isLoading.set(false);
        }
      },
      error: () => {
        // Caso o novo perfil não tenha permissão ao módulo atual, redireciona ao Hub
        this.openHubLauncher();
      },
    });
  }

  goToModuleMainScreen(): void {
    const dashboardItem = this._menuItems().find((i) => i.id === 'dashboard');
    if (dashboardItem) {
      this._activePrimaryItem.set(dashboardItem);
    }
    this._activeSubItem.set(null);
    if (!this._isSecondarySidebarPinned()) {
      this._isSecondaryForceClosed.set(true);
    }
    const moduleSlug = this._activeModule()?.slug ?? 'secp-ponto';
    this.fetchSubitemResource(moduleSlug, 'dashboard');
  }

  switchUserProfile(userId: string): void {
    const orgaoId = this._activeOrgao()?.id;
    const currentView = this._viewMode();
    const currentModuleSlug = this._activeModule()?.slug;

    this.gateway.loginSso(userId, orgaoId).subscribe({
      next: (session) => {
        this._currentUser.set(session.user);
        this._activeOrgao.set(session.activeOrgao);
        this.loadHubModules(session.user.id, session.activeOrgao.id);

        if (currentView === 'module-workspace' && currentModuleSlug) {
          this.enterModule(currentModuleSlug);
        }
      },
    });
  }

  switchOrgaoContext(orgaoId: string): void {
    const found = this._availableOrgaos().find((o) => o.id === orgaoId);
    if (found) {
      this._activeOrgao.set(found);
      const userId = this._currentUser()?.id ?? 'admin';
      this.loadHubModules(userId, found.id);
    }
  }

  togglePrimarySidebar(): void {
    this._isPrimarySidebarExpanded.update((v) => !v);
  }

  selectPrimaryItem(item: NavigationItem): void {
    this._activePrimaryItem.set(item);

    if (item.hasSecondaryMenu && item.sections.length > 0) {
      this._isSecondaryForceClosed.set(false);
      const firstSub = item.sections[0]?.items[0] ?? null;
      if (firstSub) {
        this.selectSubItem(firstSub);
      }
    } else {
      this._activeSubItem.set(null);
      const moduleSlug = this._activeModule()?.slug ?? 'secp-ponto';
      this.fetchSubitemResource(moduleSlug, item.id);
    }
  }

  selectSubItem(subItem: NavigationSubItem): void {
    this._activeSubItem.set(subItem);
    const moduleSlug = this._activeModule()?.slug ?? 'secp-ponto';
    this.fetchSubitemResource(moduleSlug, subItem.id);
  }

  closeSecondarySidebar(): void {
    this._isSecondaryForceClosed.set(true);
  }

  togglePinSecondarySidebar(): void {
    this._isSecondarySidebarPinned.update((p) => !p);
  }

  toggleSragCopilot(): void {
    this._isSragCopilotOpen.update((open) => !open);
    if (this._isSragCopilotOpen() && !this._sragLastResponse()) {
      this.askSragCopilot(
        'Quais são os requisitos para aprovação de hora extra e validação do teto orçamentário do órgão?'
      );
    }
  }

  askSragCopilot(question: string): void {
    const userId = this._currentUser()?.id ?? 'admin';
    const orgaoId = this._activeOrgao()?.id ?? 'semad';
    const moduleSlug = this._activeModule()?.slug;
    this.gateway
      .querySragCopilot(userId, orgaoId, question, moduleSlug)
      .subscribe({
        next: (ans) => this._sragLastResponse.set(ans),
      });
  }

  private loadHubModules(userId: string, orgaoId?: string): void {
    this.gateway.getAuthorizedHubModules(userId, orgaoId).subscribe({
      next: (res) => {
        this._hubModules.set(res.modules);
        this._isLoading.set(false);
      },
      error: () => this._isLoading.set(false),
    });
  }

  private fetchSubitemResource(moduleSlug: string, subitemSlug: string): void {
    const userId = this._currentUser()?.id ?? 'admin';
    this._isLoading.set(true);

    if (moduleSlug === 'secp-identidade') {
      this.refreshRbacMatrix();
    }

    if (moduleSlug === 'secp-ponto') {
      if (subitemSlug === 'dashboard') {
        this.gateway.getPontoDashboard(userId).subscribe({
          next: (dash) => {
            this._pontoDashboard.set(dash);
            this._isLoading.set(false);
          },
          error: () => this._isLoading.set(false),
        });
      } else if (subitemSlug === 'espelho') {
        this.gateway.getEspelhoPonto(userId, 2026, 11).subscribe({
          next: (dias) => {
            this._espelhoPonto.set(dias);
            this._isLoading.set(false);
          },
          error: () => this._isLoading.set(false),
        });
      } else if (subitemSlug === 'banco-horas') {
        this.gateway.getBancoHoras(userId).subscribe({
          next: (bh) => {
            this._bancoHoras.set(bh);
            this._isLoading.set(false);
          },
          error: () => this._isLoading.set(false),
        });
      } else if (subitemSlug === 'homologacao') {
        this.gateway.listHomologacaoQueue(2026, 11).subscribe({
          next: (fila) => {
            this._homologacaoQueue.set(fila);
            this._isLoading.set(false);
          },
          error: () => this._isLoading.set(false),
        });
      }
    }

    this.gateway.getSubitemResource(userId, moduleSlug, subitemSlug).subscribe({
      next: (content) => {
        this._currentModuleContent.set(content);
        this._isLoading.set(false);
      },
      error: () => this._isLoading.set(false),
    });

    // Carrega schema e registros CRUD do recurso para habilitar Criar/Editar/Excluir
    if (subitemSlug !== 'dashboard') {
      this.gateway.listCrudResource(subitemSlug).subscribe({
        next: (crud) => this._activeCrudData.set(crud),
        error: () => this._activeCrudData.set(null),
      });
    } else {
      this._activeCrudData.set(null);
    }
  }

  saveCrudRecord(
    resource: string,
    payload: Record<string, string>,
    itemId?: string
  ): void {
    const obs$ = itemId
      ? this.gateway.updateCrudResource(resource, itemId, payload)
      : this.gateway.createCrudResource(resource, payload);

    obs$.subscribe({
      next: () => {
        this.gateway.listCrudResource(resource).subscribe({
          next: (crud) => this._activeCrudData.set(crud),
        });
      },
    });
  }

  deleteCrudRecord(resource: string, itemId: string): void {
    this.gateway.deleteCrudResource(resource, itemId).subscribe({
      next: () => {
        this.gateway.listCrudResource(resource).subscribe({
          next: (crud) => this._activeCrudData.set(crud),
        });
      },
    });
  }

  registrarPonto(fonte: string, observacao?: string): void {
    const userId = this._currentUser()?.id ?? 'admin';
    this._isLoading.set(true);
    this.gateway.registrarPonto(userId, fonte, observacao).subscribe({
      next: (comprovante) => {
        this._ultimoComprovantePonto.set(comprovante);
        this.gateway.getPontoDashboard(userId).subscribe({
          next: (dash) => {
            this._pontoDashboard.set(dash);
            this._isLoading.set(false);
          },
          error: () => this._isLoading.set(false),
        });
      },
      error: () => this._isLoading.set(false),
    });
  }

  homologarServidor(homologacaoId: string): void {
    const chefiaId = this._currentUser()?.id ?? 'admin';
    this.gateway.homologarServidor(homologacaoId, chefiaId).subscribe({
      next: () => {
        this.gateway.listHomologacaoQueue(2026, 11).subscribe({
          next: (fila) => this._homologacaoQueue.set(fila),
        });
      },
    });
  }

  private refreshRbacMatrix(): void {
    this.gateway.getRbacMatrix().subscribe({
      next: (matrix) => this._rbacMatrix.set(matrix),
    });
  }

  createRbacPerfil(payload: {
    codigo: string;
    nome: string;
    descricao: string;
    administrativo: boolean;
    globalScope: boolean;
  }): void {
    this.gateway.createRbacPerfil(payload).subscribe({
      next: () => this.refreshRbacMatrix(),
    });
  }

  deleteRbacPerfil(perfilId: string): void {
    this.gateway.deleteRbacPerfil(perfilId).subscribe({
      next: () => this.refreshRbacMatrix(),
    });
  }

  toggleRbacPerfilPermissao(perfilId: string, permissaoCodigo: string): void {
    this.gateway.toggleRbacPerfilPermissao(perfilId, permissaoCodigo).subscribe({
      next: () => this.refreshRbacMatrix(),
    });
  }

  setRbacOrgaoOverride(
    perfilId: string,
    orgaoId: string,
    permissaoCodigo: string,
    permitida: boolean | null
  ): void {
    this.gateway
      .setRbacOrgaoOverride(perfilId, orgaoId, permissaoCodigo, permitida)
      .subscribe({
        next: () => this.refreshRbacMatrix(),
      });
  }

  assignRbacUsuarioPerfil(
    usuarioId: string,
    perfilId: string,
    orgaoId?: string
  ): void {
    this.gateway.assignRbacUsuarioPerfil(usuarioId, perfilId, orgaoId).subscribe({
      next: () => this.refreshRbacMatrix(),
    });
  }

  removeRbacUsuarioPerfil(vinculoId: string): void {
    this.gateway.removeRbacUsuarioPerfil(vinculoId).subscribe({
      next: () => this.refreshRbacMatrix(),
    });
  }

  toggleRbacRotina(rotinaId: string): void {
    this.gateway.toggleRbacRotina(rotinaId).subscribe({
      next: () => this.refreshRbacMatrix(),
    });
  }
}
