import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OrgaoScope,
  SecpModuleCard,
  SecpUser,
  SecpViewMode,
} from '../../../../../domain/models/navigation.model';
import { SearchableSelectComponent } from '../../../../../shared/components/searchable-select.component';

@Component({
  selector: 'app-top-header',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  template: `
    <header class="w-full h-16 bg-[#0b1b36] text-white flex items-center justify-between px-4 border-b border-white/10 select-none z-30 shrink-0">
      <!-- Esquerda: Botão Colapso Sidebar + Logotipo SECP + Indicador do Módulo Ativo -->
      <div class="flex items-center gap-3">
        @if (viewMode === 'module-workspace') {
          <button
            type="button"
            (click)="toggleSidebar.emit()"
            class="w-9 h-9 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center transition-colors"
            title="Alternar menu lateral primário (w-64 / w-20)"
          >
            <svg class="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="12" x2="15" y2="12"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        }

        <div
          class="flex items-center gap-2.5 cursor-pointer group"
          (click)="openHub.emit()"
          title="Ir para o Hub Central de Módulos (SECP Launcher)"
        >
          <span class="w-8 h-8 rounded-lg bg-[#1c355e] flex items-center justify-center border border-white/15 group-hover:border-white/35 transition-colors">
            <span class="w-3 h-3 rounded-full bg-white"></span>
          </span>
          <div class="flex flex-col">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm tracking-tight">SECP</span>
              <span class="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/10 text-slate-300 font-semibold">
                GovPlatform
              </span>
            </div>
            <span class="text-[11px] text-slate-400 leading-none">
              Sistema de Controle e Processos
            </span>
          </div>
        </div>

        <!-- Indicador visual do Módulo Ativo com sua Cor Temática Exclusiva -->
        @if (activeModule && viewMode === 'module-workspace') {
          <div class="h-6 w-[1px] bg-white/15 mx-1"></div>
          <div
            class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border"
            [style.backgroundColor]="activeModule.themeColorHex + '28'"
            [style.borderColor]="activeModule.themeColorHex"
            [style.color]="'#ffffff'"
          >
            <span
              class="w-2.5 h-2.5 rounded-full"
              [style.backgroundColor]="activeModule.themeColorHex"
            ></span>
            <span>{{ activeModule.name }}</span>
          </div>
        }
      </div>

      <!-- Centro/Direita: Contexto Órgão/Unidade, Botões de Navegação, Copiloto SRAG, RBAC e Perfil -->
      <div class="flex items-center gap-2.5">
        <!-- Seletor de Órgão / Unidade (Contexto Multi-Tenant) -->
        <div class="hidden md:flex items-center gap-1.5 bg-white/5 border border-white/15 rounded-lg px-2 py-0.5 text-xs min-w-[210px]">
          <span class="text-slate-400 text-[11px] shrink-0">Órgão/Unidade:</span>
          <app-searchable-select
            class="flex-1"
            theme="dark"
            size="sm"
            [required]="true"
            [ngModel]="activeOrgao?.id || 'semad'"
            (ngModelChange)="orgaoSelected.emit($event)"
            [options]="orgaoOptions"
            searchPlaceholder="Pesquisar órgão..."
          />
        </div>

        <!-- Seletor de Papel RBAC para testar permissões em tempo real -->
        <div class="flex items-center gap-1.5 bg-indigo-500/15 border border-indigo-400/30 rounded-lg px-2 py-0.5 text-xs min-w-[180px]" title="Simulador RBAC em tempo real">
          <span class="text-indigo-200 text-[11px] shrink-0">Papel RBAC:</span>
          <app-searchable-select
            class="flex-1"
            theme="dark"
            size="sm"
            [required]="true"
            [ngModel]="currentUser?.id || 'admin'"
            (ngModelChange)="profileSelected.emit($event)"
            [options]="profileOptions"
            searchPlaceholder="Pesquisar perfil..."
          />
        </div>

        <!-- Botão de retorno rápido para a Tela Principal do Módulo -->
        @if (viewMode === 'module-workspace' && activeModule) {
          <button
            type="button"
            (click)="goToModuleHome.emit()"
            class="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-colors flex items-center gap-1.5"
            title="Voltar para o Dashboard principal do módulo atual"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 10.5L12 3l9 7.5"></path>
              <path d="M5 9.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"></path>
            </svg>
            <span>Tela Principal do Módulo</span>
          </button>

          <!-- Botão Trocar de Módulo / Hub -->
          <button
            type="button"
            (click)="openHub.emit()"
            class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all flex items-center gap-1.5 shadow-sm"
            [style.backgroundColor]="activeModule.themeColorHex"
            title="Retornar ao Hub Central de Módulos (Launcher)"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"></rect>
              <rect x="14" y="3" width="7" height="7" rx="1"></rect>
              <rect x="14" y="14" width="7" height="7" rx="1"></rect>
              <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            </svg>
            <span>Trocar de Módulo / Hub</span>
          </button>
        }

        <!-- Botão Copiloto Normativo SRAG -->
        <button
          type="button"
          (click)="toggleCopilot.emit()"
          class="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/30 transition-colors flex items-center gap-1.5"
          title="Abrir Copiloto Normativo SRAG (Structured RAG)"
        >
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Copiloto SRAG</span>
        </button>

        <!-- Avatar do Usuário e Logout SSO -->
        @if (currentUser) {
          <div class="flex items-center gap-2 pl-2 border-l border-white/10">
            <div
              class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 text-white text-xs font-bold flex items-center justify-center border border-white/30"
              [title]="currentUser.name + ' • ' + currentUser.roleName"
            >
              {{ currentUser.avatarInitials }}
            </div>
            <button
              type="button"
              (click)="logout.emit()"
              class="text-xs text-slate-300 hover:text-red-300 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              title="Encerrar sessão SSO"
            >
              Sair
            </button>
          </div>
        }
      </div>
    </header>
  `,
})
export class TopHeaderComponent {
  @Input() viewMode: SecpViewMode = 'hub-launcher';
  @Input() profiles: readonly SecpUser[] = [];
  @Input() currentUser: SecpUser | null = null;
  @Input() availableOrgaos: readonly OrgaoScope[] = [];
  @Input() activeOrgao: OrgaoScope | null = null;
  @Input() activeModule: SecpModuleCard | null = null;

  @Output() profileSelected = new EventEmitter<string>();
  @Output() orgaoSelected = new EventEmitter<string>();
  @Output() toggleSidebar = new EventEmitter<void>();
  @Output() goToModuleHome = new EventEmitter<void>();
  @Output() openHub = new EventEmitter<void>();
  @Output() toggleCopilot = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();

  get orgaoOptions() {
    return this.availableOrgaos.map((o) => ({
      value: o.id,
      label: `${o.sigla} • ${o.unidadeAtiva}`,
    }));
  }

  get profileOptions() {
    return this.profiles.map((p) => ({
      value: p.id,
      label: `${p.roleCode} (${p.name})`,
    }));
  }

  onProfileChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.profileSelected.emit(select.value);
    }
  }

  onOrgaoChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    if (select.value) {
      this.orgaoSelected.emit(select.value);
    }
  }
}
