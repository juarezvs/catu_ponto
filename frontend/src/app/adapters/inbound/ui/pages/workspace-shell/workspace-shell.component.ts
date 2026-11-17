import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WORKSPACE_NAVIGATION_USE_CASE } from '../../../../../application/ports/inbound/workspace-navigation.port';
import { ModuleCanvasComponent } from '../../components/module-canvas/module-canvas.component';
import { PrimarySidebarComponent } from '../../components/primary-sidebar/primary-sidebar.component';
import { SecondarySidebarComponent } from '../../components/secondary-sidebar/secondary-sidebar.component';
import { TopHeaderComponent } from '../../components/top-header/top-header.component';
import { PasswordInputComponent } from '../../../../../shared/components/password-input.component';

@Component({
  selector: 'app-workspace-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TopHeaderComponent,
    PrimarySidebarComponent,
    SecondarySidebarComponent,
    ModuleCanvasComponent,
    PasswordInputComponent,
  ],
  template: `
    <div class="w-screen h-screen flex flex-col overflow-hidden bg-slate-50">
      <!-- 1. TELA DE LOGIN ÚNICA (SSO) -->
      @if (nav.viewMode() === 'login-sso') {
        <div class="flex-1 bg-gradient-to-br from-[#0b1b36] via-[#11264b] to-slate-900 flex items-center justify-center p-6">
          <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-8">
            <div class="flex items-center gap-3 mb-6">
              <div class="w-10 h-10 rounded-xl bg-[#0b1b36] flex items-center justify-center">
                <span class="w-3.5 h-3.5 rounded-full bg-white"></span>
              </div>
              <div>
                <h1 class="text-lg font-bold text-slate-900">SECP • Autenticação Única (SSO)</h1>
                <p class="text-xs text-slate-500">Sistema de Controle e Processos • Padrão CatuPonto</p>
              </div>
            </div>

            @if (nav.requirePasswordChange()) {
              <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-xs text-amber-900">
                <strong>Primeiro Acesso • Troca Obrigatória de Senha (SECP.MASTER)</strong>
                <p class="mt-1">Defina uma nova senha institucional (mín. 8 caracteres) para liberar o painel.</p>
              </div>
              <form (submit)="onSubmitPasswordChange($event)" class="flex flex-col gap-3">
                <app-password-input
                  [(ngModel)]="newPasswordInput"
                  name="newPassword"
                  [required]="true"
                  autocomplete="new-password"
                  placeholder="Nova senha institucional"
                  inputClass="h-10 px-3 rounded-lg border border-slate-300 text-xs"
                />
                @if (nav.authError()) {
                  <span class="text-xs text-rose-600 font-semibold">{{ nav.authError() }}</span>
                }
                <button type="submit" class="h-10 rounded-lg bg-[#4F46E5] text-white text-xs font-bold">
                  Confirmar Nova Senha e Entrar
                </button>
              </form>
            } @else {
              <form (submit)="onSubmitMasterLogin($event)" class="flex flex-col gap-3 mb-5 pb-5 border-b border-slate-100">
                <div>
                  <label class="text-[11px] font-semibold text-slate-600 block mb-1">Matrícula / Login</label>
                  <input
                    type="text"
                    [(ngModel)]="loginUserInput"
                    name="loginUser"
                    class="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label class="text-[11px] font-semibold text-slate-600 block mb-1">Senha</label>
                  <app-password-input
                    [(ngModel)]="loginPasswordInput"
                    name="loginPassword"
                    inputClass="h-9 px-3 rounded-lg border border-slate-300 text-xs"
                  />
                </div>
                @if (nav.authError()) {
                  <span class="text-xs text-rose-600 font-semibold">{{ nav.authError() }}</span>
                }
                <button type="submit" class="h-9 rounded-lg bg-[#0b1b36] hover:bg-slate-800 text-white text-xs font-bold">
                  Autenticar no SECP
                </button>
              </form>

              <p class="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Ou selecione uma atuação sintética de homologação:
              </p>

              <div class="flex flex-col gap-2">
                @for (profile of nav.allProfiles(); track profile.id) {
                  <button
                    type="button"
                    (click)="nav.authenticateSso(profile.id)"
                    class="w-full p-3 rounded-xl border border-slate-200 hover:border-indigo-600 hover:bg-indigo-50/40 text-left transition-all flex items-center justify-between group"
                  >
                    <div class="flex items-center gap-3">
                      <span class="w-8 h-8 rounded-full bg-[#0b1b36] text-white text-xs font-bold flex items-center justify-center">
                        {{ profile.avatarInitials }}
                      </span>
                      <div>
                        <div class="text-xs font-bold text-slate-900 group-hover:text-indigo-700">
                          {{ profile.name }}
                        </div>
                        <div class="text-[11px] text-slate-500">
                          Papel: <span class="font-mono font-semibold text-slate-700">{{ profile.roleCode }}</span>
                        </div>
                      </div>
                    </div>
                    <span class="text-xs font-semibold text-indigo-600">Entrar &rarr;</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>
      } @else {
        <!-- HEADER GLOBAL DE PONTA A PONTA (h-16) -->
        <app-top-header
          [viewMode]="nav.viewMode()"
          [profiles]="nav.allProfiles()"
          [currentUser]="nav.currentUser()"
          [availableOrgaos]="nav.availableOrgaos()"
          [activeOrgao]="nav.activeOrgao()"
          [activeModule]="nav.activeModule()"
          (profileSelected)="nav.switchUserProfile($event)"
          (orgaoSelected)="nav.switchOrgaoContext($event)"
          (toggleSidebar)="nav.togglePrimarySidebar()"
          (goToModuleHome)="nav.goToModuleMainScreen()"
          (openHub)="nav.openHubLauncher()"
          (toggleCopilot)="nav.toggleSragCopilot()"
          (logout)="nav.logoutSso()"
        />

        <!-- 2. HUB CENTRAL DE MÓDULOS (LAUNCHER EM CARDS COLORIDOS) -->
        @if (nav.viewMode() === 'hub-launcher') {
          <div class="flex-1 overflow-y-auto bg-slate-50 px-6 py-10">
            <div class="max-w-6xl mx-auto">
              <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <span class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full mb-2">
                    Hub Central de Módulos • SSO Autenticado
                  </span>
                  <h1 class="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                    Bem-vindo(a), {{ nav.currentUser()?.name }}
                  </h1>
                  <p class="text-sm text-slate-600 mt-1">
                    Exibindo os <strong>{{ nav.hubModules().length }} módulo(s)</strong> liberados para o papel
                    <span class="font-mono font-semibold text-slate-800">{{ nav.currentUser()?.roleCode }}</span>
                    no contexto <strong>{{ nav.activeOrgao()?.nome }} ({{ nav.activeOrgao()?.unidadeAtiva }})</strong>.
                  </p>
                </div>
              </div>

              <!-- Grade de Cards Interativos dos 6 Módulos do SECP -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                @for (mod of nav.hubModules(); track mod.slug) {
                  <div
                    (click)="nav.enterModule(mod.slug)"
                    class="group bg-white rounded-2xl border border-slate-200/90 hover:shadow-xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col justify-between"
                    [style.borderTopWidth]="'5px'"
                    [style.borderTopColor]="mod.themeColorHex"
                  >
                    <div class="p-6">
                      <div class="flex items-center justify-between mb-4">
                        <div
                          class="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
                          [style.backgroundColor]="mod.themeColorHex"
                        >
                          @switch (mod.icon) {
                            @case ('shield') {
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                              </svg>
                            }
                            @case ('clock') {
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="9"></circle>
                                <polyline points="12 7 12 12 15.5 14"></polyline>
                              </svg>
                            }
                            @case ('banknotes') {
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                                <circle cx="12" cy="12" r="3"></circle>
                              </svg>
                            }
                            @case ('sun') {
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="4"></circle>
                                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"></path>
                              </svg>
                            }
                            @case ('document') {
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                              </svg>
                            }
                            @default {
                              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                              </svg>
                            }
                          }
                        </div>

                        <span
                          class="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          [style.backgroundColor]="mod.themeColorHex + '18'"
                          [style.color]="mod.themeColorHex"
                        >
                          {{ mod.badgeText }}
                        </span>
                      </div>

                      <h2 class="text-lg font-bold text-slate-900 group-hover:underline">
                        {{ mod.name }}
                      </h2>
                      <p class="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                        {{ mod.shortName }} • Cor {{ mod.themeColorHex }}
                      </p>
                      <p class="text-xs text-slate-600 leading-relaxed">
                        {{ mod.description }}
                      </p>
                    </div>

                    <div class="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span class="text-xs font-medium text-slate-600">{{ mod.statsLabel }}</span>
                      <span
                        class="text-xs font-bold flex items-center gap-1"
                        [style.color]="mod.themeColorHex"
                      >
                        Acessar &rarr;
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>
          </div>
        }

        <!-- 3. SHELL LAYOUT DO MÓDULO ATIVO (SIDEBAR PRIMÁRIA w-64/w-20 + SIDEBAR SECUNDÁRIA w-60 + VIEWPORT) -->
        @if (nav.viewMode() === 'module-workspace') {
          <div class="flex-1 flex flex-row w-full h-[calc(100vh-4rem)] overflow-hidden">
            <app-primary-sidebar
              [items]="nav.menuItems()"
              [activeItemId]="nav.activePrimaryItem()?.id ?? null"
              [expanded]="nav.isPrimarySidebarExpanded()"
              [themeColorHex]="nav.activeModule()?.themeColorHex || '#0891B2'"
              (itemSelected)="nav.selectPrimaryItem($event)"
              (toggleExpand)="nav.togglePrimarySidebar()"
            />

            @if (nav.isSecondarySidebarVisible()) {
              <app-secondary-sidebar
                [primaryItem]="nav.activePrimaryItem()"
                [activeSubItemId]="nav.activeSubItem()?.id ?? null"
                [themeColorHex]="nav.activeModule()?.themeColorHex || '#0891B2'"
                [pinned]="nav.isSecondarySidebarPinned()"
                (subItemSelected)="nav.selectSubItem($event)"
                (closeSidebar)="nav.closeSecondarySidebar()"
                (togglePin)="nav.togglePinSecondarySidebar()"
              />
            }

            <app-module-canvas
              [content]="nav.currentModuleContent()"
              [currentUser]="nav.currentUser()"
              [activeOrgao]="nav.activeOrgao()"
              [activeModule]="nav.activeModule()"
              [activeSubSlug]="nav.activeSubItem()?.id ?? nav.activePrimaryItem()?.id ?? 'dashboard'"
              [pontoDashboard]="nav.pontoDashboard()"
              [espelhoPonto]="nav.espelhoPonto()"
              [bancoHoras]="nav.bancoHoras()"
              [homologacaoQueue]="nav.homologacaoQueue()"
              [ultimoComprovantePonto]="nav.ultimoComprovantePonto()"
              [activeCrudData]="nav.activeCrudData()"
              [rbacMatrix]="nav.rbacMatrix()"
              [availableOrgaos]="nav.availableOrgaos()"
              [allUsers]="nav.allProfiles()"
              [copilotOpen]="nav.isSragCopilotOpen()"
              [sragResponse]="nav.sragLastResponse()"
              [loading]="nav.isLoading()"
              (toggleCopilot)="nav.toggleSragCopilot()"
              (questionSubmitted)="nav.askSragCopilot($event)"
              (registrarPonto)="nav.registrarPonto($event.fonte, $event.observacao)"
              (homologarServidor)="nav.homologarServidor($event)"
              (navegarSubitem)="onQuickNavigateSubitem($event)"
              (saveCrud)="nav.saveCrudRecord($event.resource, $event.payload, $event.itemId)"
              (deleteCrud)="nav.deleteCrudRecord($event.resource, $event.itemId)"
              (createRbacPerfil)="nav.createRbacPerfil($event)"
              (deleteRbacPerfil)="nav.deleteRbacPerfil($event)"
              (toggleRbacPermissao)="nav.toggleRbacPerfilPermissao($event.perfilId, $event.permissaoCodigo)"
              (setRbacOverride)="nav.setRbacOrgaoOverride($event.perfilId, $event.orgaoId, $event.permissaoCodigo, $event.permitida)"
              (assignRbacUsuarioPerfil)="nav.assignRbacUsuarioPerfil($event.usuarioId, $event.perfilId, $event.orgaoId)"
              (removeRbacUsuarioPerfil)="nav.removeRbacUsuarioPerfil($event)"
              (toggleRbacRotina)="nav.toggleRbacRotina($event)"
            />
          </div>
        }
      }
    </div>
  `,
})
export class WorkspaceShellComponent implements OnInit {
  readonly nav = inject(WORKSPACE_NAVIGATION_USE_CASE);

  loginUserInput = 'SECP.MASTER';
  loginPasswordInput = 'Reconstruir-SECP!2026';
  newPasswordInput = '';

  ngOnInit(): void {
    this.nav.initializePlatform('secp.master');
  }

  onSubmitMasterLogin(event: Event): void {
    event.preventDefault();
    this.nav.authenticateSso(this.loginUserInput, undefined, this.loginPasswordInput);
  }

  onSubmitPasswordChange(event: Event): void {
    event.preventDefault();
    this.nav.completePasswordChange(this.newPasswordInput);
  }

  onQuickNavigateSubitem(subSlug: string): void {
    for (const primary of this.nav.menuItems()) {
      for (const sec of primary.sections) {
        const found = sec.items.find((sub) => sub.id === subSlug);
        if (found) {
          this.nav.selectPrimaryItem(primary);
          this.nav.selectSubItem(found);
          return;
        }
      }
    }
  }
}
