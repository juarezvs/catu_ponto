import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  CartoPrimaryMenuItem,
  CodigoPerfilRbac,
} from '../../core/models/ponto.models';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import { SearchableSelectComponent } from '../../shared/components/searchable-select.component';
import { MenuItemIconComponent } from '../../shared/components/menu-item-icon.component';

@Component({
  selector: 'app-secp-shell',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, SearchableSelectComponent, MenuItemIconComponent],
  template: `
    <div class="h-screen w-screen flex flex-col overflow-hidden bg-slate-50 text-slate-800">
      <!-- CONTAINER DE NOTIFICAÇÕES TOAST -->
      <div
        class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4 sm:px-0"
        aria-live="polite"
      >
        @for (toast of state.toasts(); track toast.id) {
          <div
            class="pointer-events-auto rounded-xl border px-4 py-3 shadow-lg text-xs font-medium flex items-start justify-between gap-3 bg-white"
            [ngClass]="{
              'border-[#007a33] text-slate-900': toast.tipo === 'success',
              'border-[#002f6c] text-slate-900': toast.tipo === 'info',
              'border-amber-500 text-amber-950': toast.tipo === 'warning',
              'border-rose-600 text-rose-950': toast.tipo === 'error'
            }"
          >
            <div class="flex items-start gap-2">
              <span
                class="w-2 h-2 rounded-full mt-1 shrink-0"
                [ngClass]="{
                  'bg-[#007a33]': toast.tipo === 'success',
                  'bg-[#002f6c]': toast.tipo === 'info',
                  'bg-amber-500': toast.tipo === 'warning',
                  'bg-rose-600': toast.tipo === 'error'
                }"
              ></span>
              <span>{{ toast.texto }}</span>
            </div>
            <button
              type="button"
              (click)="state.removerToast(toast.id)"
              class="text-slate-400 hover:text-slate-700"
              aria-label="Fechar aviso"
            >
              ✕
            </button>
          </div>
        }
      </div>

      <!-- CABEÇALHO SUPERIOR INSTITUCIONAL PONTA A PONTA (#002f6c) -->
      <header class="sticky top-0 z-40 bg-[#002f6c] text-white shadow-md border-b border-blue-950 shrink-0">
        <div class="flex items-center justify-between px-3 sm:px-5 h-14 gap-2">
          <!-- Esquerda: Toggle Sidebar + Marca SECP -->
          <div class="flex items-center gap-3 min-w-0">
            <button
              type="button"
              (click)="state.toggleSidebar()"
              aria-label="Alternar menu lateral"
              class="p-1.5 rounded-lg text-blue-100 hover:text-white hover:bg-white/10 transition"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>

            <a routerLink="/home" class="flex items-center gap-2.5 cursor-pointer min-w-0">
              <div class="w-8 h-8 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              </div>
              <div class="leading-tight truncate">
                <div class="flex items-center gap-2">
                  <span class="font-bold tracking-tight text-sm">SECP</span>
                  <span class="text-[9px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-white/15 text-blue-100 border border-white/20">
                    GOVPLATFORM
                  </span>
                </div>
                <p class="text-[10px] text-blue-200 truncate hidden sm:block">
                  Sistema Eletrônico de Controle de Ponto
                </p>
              </div>
            </a>

            <div class="hidden xl:flex items-center gap-2 ml-2 px-2.5 py-1 rounded-full bg-[#00224f] border border-blue-700/60 text-[11px] font-medium text-blue-100">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>SECP Ponto</span>
            </div>
          </div>

          <!-- Direita: Órgão/Unidade, Papel RBAC, Acessibilidade, Notificações, Perfil e Sair -->
          <div class="flex items-center gap-2">
            <div class="hidden md:flex items-center gap-1.5 bg-[#00224f] border border-blue-700/70 rounded-lg px-2 py-0.5 text-xs min-w-[230px]">
              <span class="text-blue-300 hidden xl:inline text-[11px] shrink-0">Órgão/Unidade:</span>
              <app-searchable-select
                class="flex-1"
                theme="dark"
                size="sm"
                [required]="true"
                [ngModel]="state.activeOrgaoId()"
                (ngModelChange)="state.setOrgao($event)"
                [options]="orgaoOptions()"
                searchPlaceholder="Pesquisar órgão..."
              />
            </div>

            <div class="flex items-center gap-1.5 bg-[#00224f] border border-blue-700/70 rounded-lg px-2 py-0.5 text-xs min-w-[180px]">
              <span class="text-blue-300 hidden sm:inline text-[11px] shrink-0">Papel RBAC:</span>
              <app-searchable-select
                class="flex-1"
                theme="dark"
                size="sm"
                [required]="true"
                [ngModel]="state.activePerfilCodigo()"
                (ngModelChange)="onPerfilValueChange($event)"
                [options]="perfilOptions()"
                searchPlaceholder="Pesquisar perfil..."
              />
            </div>

            <div class="hidden sm:flex items-center gap-1 bg-white/10 rounded-lg p-0.5">
              <button
                type="button"
                (click)="state.toggleFontSize()"
                [ngClass]="state.fontLarge() ? 'bg-white/25' : ''"
                class="px-2 py-1 rounded text-[11px] font-bold hover:bg-white/20 transition"
                title="Alternar tamanho de fonte"
                aria-label="Alternar tamanho de fonte"
              >
                A+
              </button>
              <button
                type="button"
                (click)="state.toggleHighContrast()"
                [ngClass]="state.highContrast() ? 'bg-white/25' : ''"
                class="px-2 py-1 rounded text-[11px] font-bold hover:bg-white/20 transition"
                title="Alternar modo alto contraste"
                aria-label="Alternar alto contraste"
              >
                ◐
              </button>
            </div>

            <!-- Notificações -->
            <div class="relative">
              <button
                type="button"
                (click)="toggleNotificacoes()"
                class="relative p-1.5 rounded-lg hover:bg-white/10 transition"
                aria-label="Notificações institucionais"
              >
                <svg class="w-4 h-4 text-blue-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                @if (state.notificacoesNaoLidasCount() > 0) {
                  <span class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#007a33] text-[9px] font-bold flex items-center justify-center border border-[#002f6c]">
                    {{ state.notificacoesNaoLidasCount() }}
                  </span>
                }
              </button>

              @if (notificacoesAbertas()) {
                <div class="absolute right-0 mt-2 w-80 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                  <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span class="text-xs font-bold text-[#002f6c]">Avisos e Prazos</span>
                    <button
                      type="button"
                      (click)="state.marcarNotificacoesComoLidas()"
                      class="text-[11px] font-semibold text-[#007a33] hover:underline"
                    >
                      Marcar lidas
                    </button>
                  </div>
                  <div class="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                    @for (not of state.notificacoes(); track not.id) {
                      <div class="p-3 text-xs" [ngClass]="!not.lida ? 'bg-blue-50/40' : ''">
                        <strong class="block text-slate-900">{{ not.titulo }}</strong>
                        <p class="text-slate-600 mt-0.5">{{ not.mensagem }}</p>
                        <span class="text-[10px] text-[#97999b] mt-1 block">{{ not.dataHora }}</span>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Perfil + Sair -->
            <div class="flex items-center gap-2 pl-2 border-l border-white/15">
              <div class="w-7 h-7 rounded-full bg-[#007a33] text-white text-[11px] font-bold flex items-center justify-center border border-white/30">
                JV
              </div>
              <div class="hidden lg:block leading-tight">
                <span class="text-[11px] font-semibold block">{{ state.servidorNome() }}</span>
                <span class="text-[10px] text-blue-200">{{ state.servidorMatricula() }}</span>
              </div>
              <button
                type="button"
                (click)="sair()"
                class="ml-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-semibold transition"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <!-- CORPO: DUPLA SIDEBAR ESTILO CARTO WORKSPACE + CONTEÚDO -->
      <div class="flex-1 flex overflow-hidden">
        <!-- 1ª BARRA LATERAL (ESTILO AZURE PORTAL COM ÍCONES COLORIDOS) -->
        <aside
          class="bg-white border-r border-[#edebe9] flex flex-col justify-between transition-all duration-200 ease-in-out shrink-0 select-none"
          [ngClass]="state.sidebarExpanded() ? 'w-60' : 'w-14'"
          aria-label="Menu lateral primário"
        >
          <nav class="py-2 px-1.5 flex flex-col gap-[2px] overflow-y-auto">
            @for (item of state.cartoMenusVisiveis(); track item.id) {
              <button
                type="button"
                (click)="onSelectPrimary(item)"
                [title]="!state.sidebarExpanded() ? item.label : ''"
                class="w-full flex items-center gap-3 px-3 py-[7px] rounded-md text-[13px] leading-[1.35] transition-colors text-left"
                [ngClass]="
                  state.activePrimaryMenuId() === item.id
                    ? 'bg-[#eff6fc] text-[#005a9e] font-semibold border-l-[3px] border-[#0078d4] pl-[9px]'
                    : 'text-[#323130] hover:bg-[#f3f2f1] font-normal'
                "
              >
                <span class="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                  @switch (item.icon) {
                    @case ('home') {
                      <!-- Azure Todos os Recursos / Início (Verde) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <rect x="1.5" y="1.5" width="4" height="4" rx="0.6" fill="#7FBA00"/>
                        <rect x="7" y="1.5" width="4" height="4" rx="0.6" fill="#5E9C31"/>
                        <rect x="12.5" y="1.5" width="4" height="4" rx="0.6" fill="#7FBA00"/>
                        <rect x="1.5" y="7" width="4" height="4" rx="0.6" fill="#5E9C31"/>
                        <rect x="7" y="7" width="4" height="4" rx="0.6" fill="#8CBF26"/>
                        <rect x="12.5" y="7" width="4" height="4" rx="0.6" fill="#5E9C31"/>
                        <rect x="1.5" y="12.5" width="4" height="4" rx="0.6" fill="#7FBA00"/>
                        <rect x="7" y="12.5" width="4" height="4" rx="0.6" fill="#5E9C31"/>
                        <rect x="12.5" y="12.5" width="4" height="4" rx="0.6" fill="#7FBA00"/>
                      </svg>
                    }
                    @case ('clock') {
                      <!-- Azure Ponto / Monitorar (Azul + Ciano) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="7.5" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.4"/>
                        <path d="M9 4.5V9L12.2 11.2" stroke="#0078D4" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="9" cy="9" r="1.2" fill="#00BCF2"/>
                      </svg>
                    }
                    @case ('workflows') {
                      <!-- Azure Funções / Solicitações (Âmbar + Azul) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <path d="M4.5 5.5L1.5 9L4.5 12.5" stroke="#00A4EF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M13.5 5.5L16.5 9L13.5 12.5" stroke="#00A4EF" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9.8 3.2L6.2 9.4H9.1L8.1 14.8L12 8.4H9L9.8 3.2Z" fill="#FFB900" stroke="#F7630C" stroke-width="0.6" stroke-linejoin="round"/>
                      </svg>
                    }
                    @case ('users') {
                      <!-- Azure Homologação / Suporte & Equipe (Ciano + Azul) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <circle cx="7.2" cy="5.5" r="2.8" fill="#50E6FF" stroke="#0078D4" stroke-width="1"/>
                        <path d="M2.2 15.2C2.2 12.3 4.4 10.2 7.2 10.2C10 10.2 12.2 12.3 12.2 15.2" fill="#0078D4"/>
                        <circle cx="13" cy="6.6" r="2.1" fill="#9CEBFF" stroke="#0078D4" stroke-width="0.9"/>
                        <path d="M12.5 10.6C14.5 10.9 16 12.6 16 15.2H12.5" fill="#00A4EF"/>
                      </svg>
                    }
                    @case ('folder') {
                      <!-- Azure Cadastro / Grupos de Recursos & SQL (Cubo Ciano) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <path d="M4.2 3.2H2.5V14.8H4.2" stroke="#767676" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M13.8 3.2H15.5V14.8H13.8" stroke="#767676" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 4.2L13 6.5V11.3L9 13.6L5 11.3V6.5L9 4.2Z" fill="#50E6FF"/>
                        <path d="M9 4.2L13 6.5L9 8.8L5 6.5L9 4.2Z" fill="#9CEBFF"/>
                        <path d="M9 8.8L13 6.5V11.3L9 13.6V8.8Z" fill="#00A4EF"/>
                      </svg>
                    }
                    @case ('shield') {
                      <!-- Azure Vida Funcional / Defender (Escudo Verde) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <path d="M9 1.8L15.2 4.3V8.8C15.2 12.5 12.6 15.4 9 16.5C5.4 15.4 2.8 12.5 2.8 8.8V4.3L9 1.8Z" fill="#6BB700"/>
                        <path d="M9 1.8V16.5C5.4 15.4 2.8 12.5 2.8 8.8V4.3L9 1.8Z" fill="#82D115"/>
                        <path d="M6.3 9.2L8.1 11L11.8 7.2" stroke="#FFFFFF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    }
                    @default {
                      <!-- Azure Configurações / Cosmos & Advisor (Azul + Ciano) -->
                      <svg class="w-[18px] h-[18px]" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="6.8" fill="#E6F4FF" stroke="#0078D4" stroke-width="1.3"/>
                        <circle cx="9" cy="9" r="2.6" fill="#0078D4"/>
                        <path d="M9 1.5V3.5M9 14.5V16.5M1.5 9H3.5M14.5 9H16.5" stroke="#00A4EF" stroke-width="1.5" stroke-linecap="round"/>
                      </svg>
                    }
                  }
                </span>

                @if (state.sidebarExpanded()) {
                  <span class="flex-1 text-left break-words">{{ item.label }}</span>
                  @if (item.sections.length > 0) {
                    <span class="text-[11px] text-[#605e5c]">›</span>
                  }
                }
              </button>
            }
          </nav>

          <div class="p-2 border-t border-[#edebe9]">
            <button
              type="button"
              (click)="state.toggleSidebar()"
              class="w-full h-8 rounded-md bg-[#f3f2f1] hover:bg-[#edebe9] text-[#323130] text-xs font-medium flex items-center justify-center gap-2 transition"
            >
              <span>{{ state.sidebarExpanded() ? '« Recolher menu' : '»' }}</span>
            </button>
          </div>
        </aside>

        <!-- 2ª BARRA LATERAL CONTEXTUAL (ESTILO AZURE COM ÍCONES COLORIDOS) -->
        @if (state.secondarySidebarOpen() && state.activePrimaryMenu(); as primary) {
          @if (primary.sections.length > 0) {
            <aside
              class="w-64 bg-white border-r border-[#edebe9] flex flex-col justify-between shrink-0 select-none overflow-y-auto"
              aria-label="Submenu contextual"
            >
              <div class="py-2.5 px-2 flex flex-col gap-4">
                <div class="flex items-center justify-between px-2.5 pb-2 border-b border-[#edebe9]">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-[#005a9e]">
                    {{ primary.label }}
                  </span>
                  <button
                    type="button"
                    (click)="state.closeSecondarySidebar()"
                    class="text-[#605e5c] hover:text-[#201f1e] text-xs"
                    title="Recolher submenu"
                  >
                    ✕
                  </button>
                </div>

                <!-- CAMPO DE BUSCA NO TOPO DO SUBMENU -->
                <div class="relative px-1">
                  <svg class="w-3.5 h-3.5 text-[#605e5c] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="7" cy="7" r="4.8"/>
                    <path d="M10.5 10.5L13.8 13.8" stroke-linecap="round"/>
                  </svg>
                  <input
                    type="text"
                    [ngModel]="submenuSearch()"
                    (ngModelChange)="submenuSearch.set($event)"
                    placeholder="Localizar opção..."
                    aria-label="Localizar opção no submenu"
                    class="w-full h-8 pl-8 pr-7 rounded-md border border-[#d2d0ce] bg-[#faf9f8] focus:bg-white text-xs text-[#323130] outline-none focus:border-[#0078d4] transition"
                  />
                  @if (submenuSearch()) {
                    <button
                      type="button"
                      (click)="submenuSearch.set('')"
                      class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-[#605e5c] hover:text-[#201f1e]"
                      aria-label="Limpar busca"
                    >
                      ✕
                    </button>
                  }
                </div>

                @for (sec of filteredSecondarySections(); track sec.title) {
                  <div class="flex flex-col gap-[2px]">
                    <span class="px-3 text-[10px] font-bold uppercase tracking-wider text-[#605e5c] mb-1">
                      {{ sec.title }}
                    </span>
                    @for (sub of sec.items; track sub.id) {
                      <a
                        [routerLink]="sub.route"
                        routerLinkActive="bg-[#eff6fc] text-[#005a9e] font-semibold"
                        class="flex items-center justify-between gap-3 px-3 py-[7px] rounded-md text-[13px] leading-[1.35] text-[#323130] hover:bg-[#f3f2f1] transition"
                        [title]="sub.description"
                      >
                        <div class="flex items-center gap-3 min-w-0">
                          <app-menu-item-icon [itemId]="sub.id" sizeClass="w-4 h-4" />
                          <span class="truncate">{{ sub.label }}</span>
                        </div>
                        @if (sub.badge) {
                          <span class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[#edebe9] text-[#323130] shrink-0">
                            {{ sub.badge }}
                          </span>
                        }
                      </a>
                    }
                  </div>
                } @empty {
                  <div class="px-3 py-4 text-center text-xs text-[#605e5c]">
                    Nenhuma opção encontrada.
                  </div>
                }
              </div>
            </aside>
          }
        }

        <!-- VIEWPORT PRINCIPAL -->
        <main class="flex-1 overflow-y-auto bg-slate-50 px-4 sm:px-6 pt-3 pb-6">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  readonly state = inject(SecpPontoStateService);
  private readonly router = inject(Router);
  readonly notificacoesAbertas = signal<boolean>(false);
  readonly submenuSearch = signal<string>('');

  readonly filteredSecondarySections = computed(() => {
    const primary = this.state.activePrimaryMenu();
    if (!primary) return [];
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const q = norm(this.submenuSearch().trim());
    if (!q) return primary.sections;

    return primary.sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter(
          (sub) =>
            norm(sub.label).includes(q) ||
            norm(sub.description).includes(q) ||
            norm(sec.title).includes(q)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  });

  readonly orgaoOptions = computed(() =>
    this.state.orgaosDisponiveis.map((o) => ({
      value: o.id,
      label: `${o.unidadeLabel} (${o.fusoHorario})`,
    }))
  );

  readonly perfilOptions = computed(() =>
    this.state.perfisRbac.map((p) => ({
      value: p.codigo,
      label: `${p.codigo} • ${p.nome}`,
    }))
  );

  onPerfilValueChange(val: string): void {
    if (val) {
      this.state.setPerfilRbac(val as CodigoPerfilRbac);
    }
  }

  onSelectPrimary(item: CartoPrimaryMenuItem): void {
    this.submenuSearch.set('');
    this.state.selectPrimaryMenu(item);
    if (item.route) {
      this.router.navigateByUrl(item.route);
    } else if (item.sections[0]?.items[0]?.route) {
      this.router.navigateByUrl(item.sections[0].items[0].route);
    }
  }

  onOrgaoChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value) {
      this.state.setOrgao(value);
    }
  }

  onPerfilChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as CodigoPerfilRbac;
    if (value) {
      this.state.setPerfilRbac(value);
    }
  }

  toggleNotificacoes(): void {
    this.notificacoesAbertas.update((v) => !v);
  }

  sair(): void {
    this.state.logout();
    this.router.navigateByUrl('/login');
  }
}
