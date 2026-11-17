import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  OrgaoScope,
  RbacMatrixResponse,
  RbacPerfil,
  RbacUsuarioPerfil,
  SecpUser,
} from '../../../../../domain/models/navigation.model';
import { SearchableSelectComponent } from '../../../../../shared/components/searchable-select.component';

@Component({
  selector: 'app-identidade-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  template: `
    <div class="max-w-6xl mx-auto px-8 py-7 flex flex-col gap-6">
      @if (matrix) {
        <!-- Cabeçalho do SECP Identidade (#4F46E5) -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-indigo-700">
              SECP Identidade • Motor Central RBAC (Consumido por todos os módulos)
            </span>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
              Governança de Perfis, Permissões e Rotinas
            </h1>
            <p class="text-xs text-slate-600 mt-1">
              Baseado nos schemas <code>perfis</code>, <code>permissoes</code>, <code>perfis_permissoes</code>,
              <code>perfis_permissoes_orgaos</code>, <code>usuarios_perfis</code> e <code>rotinas_liberacoes</code>.
            </p>
          </div>

          <button
            type="button"
            (click)="newPerfilModalOpen = true"
            class="h-9 px-4 rounded-lg bg-[#4F46E5] hover:bg-indigo-700 text-white text-xs font-bold shadow-sm shrink-0"
          >
            + Novo Perfil RBAC
          </button>
        </div>

        <!-- KPIs do Motor RBAC -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Perfis Cadastrados</span>
            <strong class="block text-2xl font-bold text-indigo-700 mt-1">{{ matrix.perfis.length }}</strong>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Permissões Granulares</span>
            <strong class="block text-2xl font-bold text-slate-900 mt-1">{{ matrix.permissoes.length }}</strong>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Overrides por Órgão</span>
            <strong class="block text-2xl font-bold text-amber-600 mt-1">{{ matrix.orgaoOverrides.length }}</strong>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Rotinas Liberadas</span>
            <strong class="block text-2xl font-bold text-emerald-600 mt-1">
              {{ liberadasCount }}/{{ matrix.rotinas.length }}
            </strong>
          </div>
        </div>

        <!-- Navegação por Abas do SECP Identidade -->
        <div class="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            (click)="activeTab = 'matriz'"
            class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
            [ngClass]="activeTab === 'matriz' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
          >
            1. Perfis &amp; Matriz de Permissões
          </button>
          <button
            type="button"
            (click)="activeTab = 'overrides'"
            class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
            [ngClass]="activeTab === 'overrides' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
          >
            2. Overrides por Órgão (Seccional)
          </button>
          <button
            type="button"
            (click)="activeTab = 'vinculos'"
            class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
            [ngClass]="activeTab === 'vinculos' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
          >
            3. Usuários × Perfis
          </button>
          <button
            type="button"
            (click)="activeTab = 'rotinas'"
            class="px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
            [ngClass]="activeTab === 'rotinas' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'"
          >
            4. Liberação de Rotinas
          </button>
        </div>

        <!-- ABA 1: PERFIS & MATRIZ DE PERMISSÕES -->
        @if (activeTab === 'matriz') {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <!-- Lista de Perfis -->
            <div class="lg:col-span-4 flex flex-col gap-2.5">
              @for (perfil of matrix.perfis; track perfil.id) {
                <div
                  (click)="selectedPerfilId = perfil.id"
                  class="bg-white rounded-xl border p-4 cursor-pointer transition-all"
                  [ngClass]="
                    effectiveSelectedPerfil?.id === perfil.id
                      ? 'border-indigo-600 ring-2 ring-indigo-100'
                      : 'border-slate-200 hover:border-slate-300'
                  "
                >
                  <div class="flex items-center justify-between">
                    <span class="font-mono text-xs font-bold text-indigo-700">{{ perfil.codigo }}</span>
                    @if (!perfil.sistema) {
                      <button
                        type="button"
                        (click)="requestDeletePerfil($event, perfil)"
                        class="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        Excluir
                      </button>
                    } @else {
                      <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">
                        Sistema
                      </span>
                    }
                  </div>
                  <strong class="block text-sm text-slate-900 mt-1">{{ perfil.nome }}</strong>
                  <p class="text-xs text-slate-500 mt-0.5">{{ perfil.descricao }}</p>
                </div>
              }
            </div>

            <!-- Matriz de Permissões do Perfil Selecionado -->
            @if (effectiveSelectedPerfil; as perfil) {
              <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h3 class="text-sm font-bold text-slate-900">
                      Permissões de {{ perfil.nome }} ({{ perfil.codigo }})
                    </h3>
                    <p class="text-[11px] text-slate-500">
                      Marcar ou desmarcar atualiza o cache Redis e reflete imediatamente no Hub e Menus de todos os módulos.
                    </p>
                  </div>
                </div>

                <div class="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                  @for (perm of matrix.permissoes; track perm.id) {
                    <label class="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer">
                      <div>
                        <div class="flex items-center gap-2">
                          <code class="text-xs font-mono font-semibold text-slate-800">{{ perm.codigo }}</code>
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-semibold">
                            {{ perm.escopo }}
                          </span>
                        </div>
                        <span class="text-xs text-slate-500">{{ perm.descricao }}</span>
                      </div>
                      <input
                        type="checkbox"
                        [disabled]="perfil.permissoesCodigos.includes('*')"
                        [checked]="perfil.permissoesCodigos.includes('*') || perfil.permissoesCodigos.includes(perm.codigo)"
                        (change)="togglePermissao.emit({ perfilId: perfil.id, permissaoCodigo: perm.codigo })"
                        class="w-4 h-4 accent-indigo-600 cursor-pointer"
                      />
                    </label>
                  }
                </div>
              </div>
            }
          </div>
        }

        <!-- ABA 2: OVERRIDES SECCIONAIS POR ÓRGÃO (PerfilPermissaoOrgao) -->
        @if (activeTab === 'overrides' && effectiveSelectedPerfil; as perfil) {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 class="text-sm font-bold text-slate-900">
                  Overrides por Órgão — Perfil {{ perfil.codigo }}
                </h3>
                <p class="text-xs text-slate-500">
                  Sobrescreva permissões apenas para um Órgão específico (<code>perfis_permissoes_orgaos</code>).
                </p>
              </div>
              <div class="flex items-center gap-2 text-xs">
                <span class="font-semibold text-slate-600">Órgão Alvo:</span>
                <div class="w-56">
                  <app-searchable-select
                    [(ngModel)]="selectedOrgaoId"
                    [required]="true"
                    size="sm"
                    [options]="orgaoOptions"
                    searchPlaceholder="Pesquisar órgão..."
                  />
                </div>
              </div>
            </div>

            <div class="divide-y divide-slate-100 max-h-[440px] overflow-y-auto">
              @for (perm of matrix.permissoes; track perm.id) {
                <div class="flex items-center justify-between px-5 py-3">
                  <div>
                    <code class="text-xs font-mono font-semibold text-slate-800">{{ perm.codigo }}</code>
                    <span class="block text-xs text-slate-500">{{ perm.descricao }}</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    @let ov = getOverrideState(perfil.id, selectedOrgaoId, perm.codigo);
                    <button
                      type="button"
                      (click)="setOverride.emit({ perfilId: perfil.id, orgaoId: selectedOrgaoId, permissaoCodigo: perm.codigo, permitida: null })"
                      class="px-2.5 py-1 rounded text-[11px] font-semibold border"
                      [ngClass]="ov === null ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200'"
                    >
                      Herdado
                    </button>
                    <button
                      type="button"
                      (click)="setOverride.emit({ perfilId: perfil.id, orgaoId: selectedOrgaoId, permissaoCodigo: perm.codigo, permitida: true })"
                      class="px-2.5 py-1 rounded text-[11px] font-semibold border"
                      [ngClass]="ov === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-emerald-700 border-emerald-200'"
                    >
                      Permitir
                    </button>
                    <button
                      type="button"
                      (click)="setOverride.emit({ perfilId: perfil.id, orgaoId: selectedOrgaoId, permissaoCodigo: perm.codigo, permitida: false })"
                      class="px-2.5 py-1 rounded text-[11px] font-semibold border"
                      [ngClass]="ov === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-rose-700 border-rose-200'"
                    >
                      Negar
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
        }

        <!-- ABA 3: VÍNCULOS USUÁRIO × PERFIL (UsuarioPerfil) -->
        @if (activeTab === 'vinculos') {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2.5">
              <div class="w-56">
                <app-searchable-select
                  [(ngModel)]="assignUserId"
                  [required]="true"
                  size="sm"
                  [options]="userOptions"
                  searchPlaceholder="Pesquisar usuário..."
                />
              </div>
              <div class="w-56">
                <app-searchable-select
                  [(ngModel)]="assignPerfilId"
                  [required]="true"
                  size="sm"
                  [options]="perfilOptions"
                  searchPlaceholder="Pesquisar perfil..."
                />
              </div>
              <div class="w-56">
                <app-searchable-select
                  [(ngModel)]="assignOrgaoId"
                  [options]="orgaoOptions"
                  placeholder="Escopo Global (Todos Órgãos)"
                  searchPlaceholder="Pesquisar órgão..."
                  size="sm"
                />
              </div>
              <button
                type="button"
                (click)="onAssignUsuarioPerfil()"
                class="h-8 px-3.5 rounded-lg bg-[#4F46E5] text-white text-xs font-bold"
              >
                + Vincular Perfil
              </button>
            </div>

            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th class="py-3 px-4">Usuário</th>
                  <th class="py-3 px-4">Perfil RBAC</th>
                  <th class="py-3 px-4">Escopo Órgão</th>
                  <th class="py-3 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                @for (v of matrix.usuariosPerfis; track v.id) {
                  <tr>
                    <td class="py-3 px-4 font-semibold text-slate-900">{{ v.usuarioNome }} ({{ v.usuarioId }})</td>
                    <td class="py-3 px-4">
                      <span class="font-mono font-bold text-indigo-700">{{ v.perfilCodigo }}</span>
                      <span class="text-slate-500 ml-1">• {{ v.perfilNome }}</span>
                    </td>
                    <td class="py-3 px-4 font-mono">{{ v.orgaoId ? v.orgaoId.toUpperCase() : 'GLOBAL' }}</td>
                    <td class="py-3 px-4 text-right">
                      <button
                        type="button"
                        (click)="requestDeleteVinculo(v)"
                        class="text-xs font-semibold text-rose-600 hover:underline"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }

        <!-- ABA 4: LIBERAÇÃO DE ROTINAS (LiberacaoRotina) -->
        @if (activeTab === 'rotinas') {
          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            @for (rotina of matrix.rotinas; track rotina.id) {
              <div class="px-5 py-4 flex items-center justify-between">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {{ rotina.tipo }}
                    </span>
                    <code class="text-xs font-mono font-bold text-slate-900">{{ rotina.chave }}</code>
                  </div>
                  <p class="text-xs text-slate-500 mt-1">{{ rotina.descricao }}</p>
                </div>

                <button
                  type="button"
                  (click)="toggleRotina.emit(rotina.id)"
                  class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors"
                  [ngClass]="rotina.liberada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'"
                >
                  {{ rotina.liberada ? '● Liberada' : '○ Bloqueada Globalmente' }}
                </button>
              </div>
            }
          </div>
        }
      }

      <!-- Modal Criar Novo Perfil -->
      @if (newPerfilModalOpen) {
        <div class="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900">Novo Perfil RBAC</h3>
              <button type="button" (click)="newPerfilModalOpen = false" class="text-slate-400 hover:text-slate-700">✕</button>
            </div>
            <form (submit)="onSubmitNewPerfil($event)" class="p-6 flex flex-col gap-3.5 text-xs">
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Código do Perfil</label>
                <input type="text" [(ngModel)]="newPerfilCodigo" name="codigo" required placeholder="EX: AUDITOR_FOLHA" class="w-full h-9 px-3 rounded-lg border border-slate-300" />
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Nome do Perfil</label>
                <input type="text" [(ngModel)]="newPerfilNome" name="nome" required placeholder="Auditor de Folha" class="w-full h-9 px-3 rounded-lg border border-slate-300" />
              </div>
              <div>
                <label class="font-semibold text-slate-700 block mb-1">Descrição</label>
                <input type="text" [(ngModel)]="newPerfilDesc" name="descricao" placeholder="Escopo de auditoria..." class="w-full h-9 px-3 rounded-lg border border-slate-300" />
              </div>
              <div class="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button type="button" (click)="newPerfilModalOpen = false" class="h-9 px-4 rounded-lg border border-slate-300 font-semibold">Cancelar</button>
                <button type="submit" class="h-9 px-4 rounded-lg bg-[#4F46E5] text-white font-bold">Criar Perfil</button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal de Confirmação de Exclusão (Obrigatório para todas as exclusões) -->
      @if (deleteConfirmTarget) {
        <div class="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div class="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <h3 class="text-sm font-bold text-rose-900">Confirmar Exclusão RBAC</h3>
              <button type="button" (click)="deleteConfirmTarget = null" class="text-rose-400 hover:text-rose-700">✕</button>
            </div>
            <div class="p-6 text-xs text-slate-600">
              <p>Tem certeza que deseja excluir o item abaixo?</p>
              <div class="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 font-semibold text-slate-900">
                {{ deleteConfirmTarget.label }}
              </div>
            </div>
            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" (click)="deleteConfirmTarget = null" class="h-9 px-4 rounded-lg border border-slate-300 bg-white text-xs font-semibold">Cancelar</button>
              <button type="button" (click)="confirmDelete()" class="h-9 px-4 rounded-lg bg-rose-600 text-white text-xs font-bold">Confirmar Exclusão</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class IdentidadeWorkspaceComponent {
  @Input() matrix: RbacMatrixResponse | null = null;
  @Input() availableOrgaos: readonly OrgaoScope[] = [];
  @Input() allUsers: readonly SecpUser[] = [];

  @Output() createPerfil = new EventEmitter<{ codigo: string; nome: string; descricao: string; administrativo: boolean; globalScope: boolean }>();
  @Output() deletePerfil = new EventEmitter<string>();
  @Output() togglePermissao = new EventEmitter<{ perfilId: string; permissaoCodigo: string }>();
  @Output() setOverride = new EventEmitter<{ perfilId: string; orgaoId: string; permissaoCodigo: string; permitida: boolean | null }>();
  @Output() assignUsuarioPerfil = new EventEmitter<{ usuarioId: string; perfilId: string; orgaoId?: string }>();
  @Output() removeUsuarioPerfil = new EventEmitter<string>();
  @Output() toggleRotina = new EventEmitter<string>();

  activeTab: 'matriz' | 'overrides' | 'vinculos' | 'rotinas' = 'matriz';
  selectedPerfilId: string | null = null;
  selectedOrgaoId = 'semad';

  newPerfilModalOpen = false;
  newPerfilCodigo = '';
  newPerfilNome = '';
  newPerfilDesc = '';

  assignUserId = 'servidor';
  assignPerfilId = 'perf-rh';
  assignOrgaoId = 'semad';

  deleteConfirmTarget: { kind: 'perfil' | 'vinculo'; id: string; label: string } | null = null;

  get orgaoOptions() {
    return this.availableOrgaos.map((o) => ({ value: o.id, label: `${o.sigla} • ${o.nome}` }));
  }

  get userOptions() {
    return this.allUsers.map((u) => ({ value: u.id, label: `${u.name} (${u.id})` }));
  }

  get perfilOptions() {
    return (this.matrix?.perfis ?? []).map((p) => ({ value: p.id, label: `${p.codigo} • ${p.nome}` }));
  }

  get effectiveSelectedPerfil(): RbacPerfil | null {
    if (!this.matrix || this.matrix.perfis.length === 0) {
      return null;
    }
    return (
      this.matrix.perfis.find((p) => p.id === this.selectedPerfilId) ??
      this.matrix.perfis[1] ??
      this.matrix.perfis[0]
    );
  }

  get liberadasCount(): number {
    return this.matrix ? this.matrix.rotinas.filter((r) => r.liberada).length : 0;
  }

  getOverrideState(perfilId: string, orgaoId: string, permissaoCodigo: string): boolean | null {
    const found = this.matrix?.orgaoOverrides.find(
      (ov) =>
        ov.perfilId === perfilId &&
        ov.orgaoId === orgaoId &&
        ov.permissaoCodigo === permissaoCodigo
    );
    return found ? found.permitida : null;
  }

  onSubmitNewPerfil(event: Event): void {
    event.preventDefault();
    if (!this.newPerfilCodigo.trim() || !this.newPerfilNome.trim()) {
      return;
    }
    this.createPerfil.emit({
      codigo: this.newPerfilCodigo,
      nome: this.newPerfilNome,
      descricao: this.newPerfilDesc,
      administrativo: false,
      globalScope: true,
    });
    this.newPerfilCodigo = '';
    this.newPerfilNome = '';
    this.newPerfilDesc = '';
    this.newPerfilModalOpen = false;
  }

  onAssignUsuarioPerfil(): void {
    this.assignUsuarioPerfil.emit({
      usuarioId: this.assignUserId,
      perfilId: this.assignPerfilId,
      orgaoId: this.assignOrgaoId || undefined,
    });
  }

  requestDeletePerfil(event: Event, perfil: RbacPerfil): void {
    event.stopPropagation();
    this.deleteConfirmTarget = {
      kind: 'perfil',
      id: perfil.id,
      label: `Perfil ${perfil.codigo} • ${perfil.nome}`,
    };
  }

  requestDeleteVinculo(v: RbacUsuarioPerfil): void {
    this.deleteConfirmTarget = {
      kind: 'vinculo',
      id: v.id,
      label: `${v.usuarioNome} -> ${v.perfilCodigo}`,
    };
  }

  confirmDelete(): void {
    if (!this.deleteConfirmTarget) {
      return;
    }
    if (this.deleteConfirmTarget.kind === 'perfil') {
      this.deletePerfil.emit(this.deleteConfirmTarget.id);
    } else {
      this.removeUsuarioPerfil.emit(this.deleteConfirmTarget.id);
    }
    this.deleteConfirmTarget = null;
  }
}
