import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BancoHorasResumo,
  CadastroColumn,
  CadastroModuleContent,
  CrudListResponse,
  EspelhoDia,
  HomologacaoItem,
  MarcacaoPonto,
  OrgaoScope,
  PontoDashboard,
  RbacMatrixResponse,
  SecpModuleCard,
  SecpUser,
  SragQueryResponse,
} from '../../../../../domain/models/navigation.model';
import { IdentidadeWorkspaceComponent } from '../identidade-workspace/identidade-workspace.component';
import { PontoWorkspaceComponent } from '../ponto-workspace/ponto-workspace.component';
import { SearchableSelectComponent } from '../../../../../shared/components/searchable-select.component';

@Component({
  selector: 'app-module-canvas',
  standalone: true,
  imports: [CommonModule, FormsModule, PontoWorkspaceComponent, IdentidadeWorkspaceComponent, SearchableSelectComponent],
  template: `
    <main class="flex-1 h-[calc(100vh-4rem)] overflow-y-auto bg-slate-50 relative">
      @if (isSpecializedIdentidadeView) {
        <app-identidade-workspace
          [matrix]="rbacMatrix"
          [availableOrgaos]="availableOrgaos"
          [allUsers]="allUsers"
          (createPerfil)="createRbacPerfil.emit($event)"
          (deletePerfil)="deleteRbacPerfil.emit($event)"
          (togglePermissao)="toggleRbacPermissao.emit($event)"
          (setOverride)="setRbacOverride.emit($event)"
          (assignUsuarioPerfil)="assignRbacUsuarioPerfil.emit($event)"
          (removeUsuarioPerfil)="removeRbacUsuarioPerfil.emit($event)"
          (toggleRotina)="toggleRbacRotina.emit($event)"
        />
      } @else if (isSpecializedPontoView) {
        <app-ponto-workspace
          [activeSubSlug]="activePontoSubSlug"
          [dashboard]="pontoDashboard"
          [espelho]="espelhoPonto"
          [bancoHoras]="bancoHoras"
          [homologacaoQueue]="homologacaoQueue"
          [ultimoComprovante]="ultimoComprovantePonto"
          (registrarPonto)="registrarPonto.emit($event)"
          (homologar)="homologarServidor.emit($event)"
          (navegarSubitem)="navegarSubitem.emit($event)"
        />
      } @else if (content) {
        <div class="max-w-6xl mx-auto px-8 py-7">
          <!-- Breadcrumb e Cabeçalho da Página -->
          <div class="flex items-center gap-2 text-xs text-slate-500 mb-2">
            <span>{{ content.category }}</span>
            <span>&gt;</span>
            <span class="font-semibold text-slate-700">{{ content.title }}</span>
          </div>

          <div class="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
            <div>
              <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
                {{ content.title }}
              </h1>
              <p class="text-sm text-slate-600 mt-1">
                {{ content.subtitle }}
              </p>
            </div>

            <div class="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                (click)="toggleCopilot.emit()"
                class="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Consultar Base Legal (SRAG)</span>
              </button>

              <button
                type="button"
                (click)="openCreateModal()"
                class="h-9 px-4 rounded-lg text-white text-xs font-semibold shadow-sm transition-opacity hover:opacity-90"
                [style.backgroundColor]="activeModule?.themeColorHex || '#0891B2'"
              >
                {{ activeCrudData ? activeCrudData.primaryActionLabel : content.primaryActionLabel }}
              </button>
            </div>
          </div>

          <!-- Callout de Contexto RBAC e Multi-Tenant -->
          <div
            class="rounded-xl border p-3.5 mb-6 flex items-start gap-3 text-xs leading-relaxed bg-white shadow-sm"
            [style.borderColor]="(activeModule?.themeColorHex || '#0891B2') + '45'"
          >
            <span
              class="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
              [style.backgroundColor]="activeModule?.themeColorHex || '#0891B2'"
            ></span>
            <div class="text-slate-700">
              Módulo ativo: <strong>{{ activeModule?.name }}</strong> •
              Papel RBAC: <strong>{{ currentUser?.roleCode }}</strong> ({{ currentUser?.roleName }}) •
              Contexto Organizacional: <strong>{{ activeOrgao?.sigla }} - {{ activeOrgao?.unidadeAtiva }}</strong>
              (Teto Mensal HE: <span class="font-semibold">{{ activeOrgao?.tetoHoraExtraMensal }}</span>).
            </div>
          </div>

          <!-- Cards de Indicadores (KPIs) -->
          @if (content.metrics.length > 0) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              @for (metric of content.metrics; track metric.label) {
                <div class="bg-white rounded-xl border border-slate-200/90 p-4 shadow-sm flex flex-col gap-1">
                  <span class="text-xs font-medium text-slate-500">{{ metric.label }}</span>
                  <strong class="text-2xl font-bold text-slate-900">{{ metric.value }}</strong>
                  <span
                    class="text-[11px] font-semibold"
                    [style.color]="activeModule?.themeColorHex || '#0891B2'"
                  >
                    {{ metric.trend }}
                  </span>
                </div>
              }
            </div>
          }

          <!-- Barra de Pesquisa e Tabela Responsiva -->
          <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="relative w-full sm:w-80">
                <input
                  type="text"
                  [(ngModel)]="searchTerm"
                  [placeholder]="'Filtrar registros em ' + content.title + '...'"
                  class="w-full h-9 pl-3 pr-3 rounded-lg border border-slate-300 text-xs text-slate-800 outline-none focus:border-slate-500"
                />
              </div>
              <span class="text-xs text-slate-500">
                {{ filteredRecords.length }} registro(s) listado(s)
              </span>
            </div>

            <div class="overflow-x-auto">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    @for (col of displayColumns; track col.key) {
                      <th class="py-3 px-4">{{ col.label }}</th>
                    }
                    @if (activeCrudData) {
                      <th class="py-3 px-4 text-right">Ações</th>
                    }
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 text-[13px] text-slate-700">
                  @for (row of filteredRecords; track $index) {
                    <tr class="hover:bg-slate-50/70 transition-colors">
                      @for (col of displayColumns; track col.key) {
                        <td class="py-3.5 px-4">
                          @switch (col.type) {
                            @case ('code') {
                              <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                                {{ row[col.key] }}
                              </span>
                            }
                            @case ('badge') {
                              <span class="inline-block text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                                {{ row[col.key] }}
                              </span>
                            }
                            @case ('status') {
                              <span
                                class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                                [ngClass]="
                                  row[col.key].includes('Pendente') || row[col.key].includes('Tolerância')
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                "
                              >
                                <span
                                  class="w-1.5 h-1.5 rounded-full"
                                  [ngClass]="
                                    row[col.key].includes('Pendente') || row[col.key].includes('Tolerância')
                                      ? 'bg-amber-600'
                                      : 'bg-emerald-600'
                                  "
                                ></span>
                                {{ row[col.key] }}
                              </span>
                            }
                            @default {
                              <span>{{ row[col.key] }}</span>
                            }
                          }
                        </td>
                      }
                      @if (activeCrudData && row['id']) {
                        <td class="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            (click)="openEditModal(row)"
                            class="text-xs font-semibold text-indigo-600 hover:underline mr-3"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            (click)="openDeleteConfirmModal(row)"
                            class="text-xs font-semibold text-rose-600 hover:underline"
                          >
                            Excluir
                          </button>
                        </td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      }

      <!-- Modal CRUD Dinâmico (Create / Update) -->
      @if (crudModalOpen && activeCrudData) {
        <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center p-4">
          <div class="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div class="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 class="text-sm font-bold text-slate-900">
                {{ editingRowId ? 'Editar Registro' : activeCrudData.primaryActionLabel }} • {{ activeCrudData.title }}
              </h3>
              <button
                type="button"
                (click)="crudModalOpen = false"
                class="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>

            <form (submit)="onSubmitCrudForm($event)" class="p-6 flex flex-col gap-4">
              @for (field of activeCrudData.fields; track field.key) {
                <div class="flex flex-col gap-1">
                  <label class="text-xs font-semibold text-slate-700">
                    {{ field.label }}
                  </label>
                  @if (field.fieldType === 'select' && field.options.length > 0) {
                    <app-searchable-select
                      [(ngModel)]="crudFormModel[field.key]"
                      [name]="field.key"
                      [required]="field.required"
                      [options]="toSelectOptions(field.options)"
                      searchPlaceholder="Pesquisar opção..."
                    />
                  } @else {
                    <input
                      type="text"
                      [(ngModel)]="crudFormModel[field.key]"
                      [name]="field.key"
                      [required]="field.required"
                      class="h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-900 outline-none focus:border-cyan-600"
                    />
                  }
                </div>
              }

              <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  (click)="crudModalOpen = false"
                  class="h-9 px-4 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  class="h-9 px-4 rounded-lg text-white text-xs font-bold"
                  [style.backgroundColor]="activeModule?.themeColorHex || '#0891B2'"
                >
                  {{ editingRowId ? 'Salvar Alterações' : 'Criar Registro' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Modal de Confirmação de Exclusão -->
      @if (deleteConfirmModalOpen && pendingDeleteRow && activeCrudData) {
        <div
          class="fixed inset-0 bg-slate-900/50 backdrop-blur-[1px] z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div class="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <span class="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm">
                  !
                </span>
                <h3 id="delete-modal-title" class="text-sm font-bold text-rose-900">
                  Confirmar Exclusão
                </h3>
              </div>
              <button
                type="button"
                (click)="cancelDeleteModal()"
                class="text-rose-400 hover:text-rose-700 text-sm"
              >
                ✕
              </button>
            </div>

            <div class="p-6 text-xs text-slate-600 leading-relaxed">
              <p>
                Tem certeza que deseja excluir este registro de
                <strong class="text-slate-900">{{ activeCrudData.title }}</strong>?
              </p>
              <div class="mt-3 p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-800 font-medium">
                {{ getDeleteSummaryLabel(pendingDeleteRow) }}
              </div>
              <p class="mt-3 text-[11px] text-rose-700">
                Esta ação removerá o registro da base de dados e invalidará o cache distribuído.
              </p>
            </div>

            <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="cancelDeleteModal()"
                class="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmDeleteRow()"
                class="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Painel Lateral do SECP Copiloto Normativo (SRAG - Structured RAG) -->
      @if (copilotOpen) {
        <div class="fixed right-4 bottom-4 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl border border-slate-200 shadow-2xl z-40 overflow-hidden flex flex-col">
          <div class="bg-[#0b1b36] text-white px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <div>
                <h3 class="text-xs font-bold">SECP Copiloto Normativo (SRAG)</h3>
                <p class="text-[10px] text-slate-300">
                  Busca Híbrida (pgvector + BM25) • Escopo: {{ activeOrgao?.sigla }}
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="toggleCopilot.emit()"
              class="text-slate-300 hover:text-white text-xs px-1.5 py-0.5"
            >
              ✕
            </button>
          </div>

          <div class="p-4 max-h-80 overflow-y-auto flex flex-col gap-3 bg-slate-50 text-xs">
            <div class="flex flex-wrap gap-1.5">
              <button
                type="button"
                (click)="askQuestion('Qual a regra de hora extra e validação do teto orçamentário?')"
                class="text-[11px] bg-white border border-slate-200 hover:border-indigo-400 px-2 py-1 rounded-md text-slate-700"
              >
                Teto de Hora Extra
              </button>
              <button
                type="button"
                (click)="askQuestion('Qual a tolerância no ponto eletrônico e regra da Portaria 671?')"
                class="text-[11px] bg-white border border-slate-200 hover:border-indigo-400 px-2 py-1 rounded-md text-slate-700"
              >
                Tolerância Ponto (CLT/671)
              </button>
              <button
                type="button"
                (click)="askQuestion('Como funciona o parcelamento de férias no Estatuto?')"
                class="text-[11px] bg-white border border-slate-200 hover:border-indigo-400 px-2 py-1 rounded-md text-slate-700"
              >
                Parcelamento de Férias
              </button>
            </div>

            @if (sragResponse) {
              <div class="bg-white rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    {{ sragResponse.guardrailStatus }}
                  </span>
                  <span class="text-[10px] text-slate-500">
                    Score: {{ (sragResponse.confidenceScore * 100).toFixed(0) }}%
                  </span>
                </div>
                <p class="text-slate-800 leading-relaxed">{{ sragResponse.answer }}</p>

                <div class="border-t border-slate-100 pt-2 flex flex-col gap-1.5">
                  <span class="text-[10px] font-semibold text-slate-500 uppercase">
                    Fontes Normativas Ancoradas:
                  </span>
                  @for (cit of sragResponse.citations; track cit.lawReference) {
                    <div class="bg-slate-50 rounded p-2 border border-slate-200/70">
                      <div class="font-semibold text-indigo-700 text-[11px]">
                        {{ cit.lawReference }}
                      </div>
                      <div class="text-[11px] text-slate-600 mt-0.5">
                        "{{ cit.excerpt }}"
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          </div>

          <form
            (submit)="onSubmitCopilot($event)"
            class="p-2.5 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              [(ngModel)]="copilotQuestion"
              name="copilotQuestion"
              placeholder="Pergunte sobre normas de ponto, férias, folha..."
              class="flex-1 h-8 px-2.5 rounded-lg border border-slate-300 text-xs outline-none"
            />
            <button
              type="submit"
              class="h-8 px-3 rounded-lg bg-[#0b1b36] text-white text-xs font-semibold"
            >
              Enviar
            </button>
          </form>
        </div>
      }
    </main>
  `,
})
export class ModuleCanvasComponent {
  toSelectOptions(opts: readonly string[]) {
    return opts.map((o) => ({ value: o, label: o }));
  }
  @Input() content: CadastroModuleContent | null = null;
  @Input() currentUser: SecpUser | null = null;
  @Input() activeOrgao: OrgaoScope | null = null;
  @Input() activeModule: SecpModuleCard | null = null;
  @Input() activeSubSlug: string | null = null;
  @Input() pontoDashboard: PontoDashboard | null = null;
  @Input() espelhoPonto: readonly EspelhoDia[] = [];
  @Input() bancoHoras: BancoHorasResumo | null = null;
  @Input() homologacaoQueue: readonly HomologacaoItem[] = [];
  @Input() ultimoComprovantePonto: MarcacaoPonto | null = null;
  @Input() activeCrudData: CrudListResponse | null = null;
  @Input() rbacMatrix: RbacMatrixResponse | null = null;
  @Input() availableOrgaos: readonly OrgaoScope[] = [];
  @Input() allUsers: readonly SecpUser[] = [];
  @Input() copilotOpen = false;
  @Input() sragResponse: SragQueryResponse | null = null;
  @Input() loading = false;

  @Output() toggleCopilot = new EventEmitter<void>();
  @Output() questionSubmitted = new EventEmitter<string>();
  @Output() registrarPonto = new EventEmitter<{ fonte: string; observacao?: string }>();
  @Output() homologarServidor = new EventEmitter<string>();
  @Output() navegarSubitem = new EventEmitter<string>();
  @Output() saveCrud = new EventEmitter<{ resource: string; payload: Record<string, string>; itemId?: string }>();
  @Output() deleteCrud = new EventEmitter<{ resource: string; itemId: string }>();
  @Output() createRbacPerfil = new EventEmitter<{ codigo: string; nome: string; descricao: string; administrativo: boolean; globalScope: boolean }>();
  @Output() deleteRbacPerfil = new EventEmitter<string>();
  @Output() toggleRbacPermissao = new EventEmitter<{ perfilId: string; permissaoCodigo: string }>();
  @Output() setRbacOverride = new EventEmitter<{ perfilId: string; orgaoId: string; permissaoCodigo: string; permitida: boolean | null }>();
  @Output() assignRbacUsuarioPerfil = new EventEmitter<{ usuarioId: string; perfilId: string; orgaoId?: string }>();
  @Output() removeRbacUsuarioPerfil = new EventEmitter<string>();
  @Output() toggleRbacRotina = new EventEmitter<string>();

  searchTerm = '';
  copilotQuestion = '';
  crudModalOpen = false;
  editingRowId: string | null = null;
  crudFormModel: Record<string, string> = {};
  deleteConfirmModalOpen = false;
  pendingDeleteRow: Record<string, string> | null = null;

  get displayColumns(): readonly CadastroColumn[] {
    return this.activeCrudData ? this.activeCrudData.columns : (this.content?.columns ?? []);
  }

  get activePontoSubSlug(): string {
    return this.activeSubSlug || 'dashboard';
  }

  get isSpecializedIdentidadeView(): boolean {
    if (this.activeModule?.slug !== 'secp-identidade') {
      return false;
    }
    const slug = this.activePontoSubSlug;
    return ['dashboard', 'usuarios-rbac', 'papeis-permissoes', 'permissoes'].includes(slug);
  }

  get isSpecializedPontoView(): boolean {
    if (this.activeModule?.slug !== 'secp-ponto') {
      return false;
    }
    const slug = this.activePontoSubSlug;
    return ['dashboard', 'espelho', 'banco-horas', 'homologacao'].includes(slug);
  }

  get filteredRecords(): readonly Record<string, string>[] {
    const source = this.activeCrudData ? this.activeCrudData.records : (this.content?.records ?? []);
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return source;
    }
    return source.filter((record) =>
      Object.values(record).some((val) => String(val).toLowerCase().includes(query))
    );
  }

  openCreateModal(): void {
    if (!this.activeCrudData) {
      return;
    }
    this.editingRowId = null;
    const model: Record<string, string> = {};
    for (const f of this.activeCrudData.fields) {
      model[f.key] = f.options.length > 0 ? f.options[0] : '';
    }
    this.crudFormModel = model;
    this.crudModalOpen = true;
  }

  openEditModal(row: Record<string, string>): void {
    if (!this.activeCrudData) {
      return;
    }
    this.editingRowId = row['id'] ?? null;
    const model: Record<string, string> = {};
    for (const f of this.activeCrudData.fields) {
      model[f.key] = row[f.key] ?? '';
    }
    this.crudFormModel = model;
    this.crudModalOpen = true;
  }

  onSubmitCrudForm(event: Event): void {
    event.preventDefault();
    if (!this.activeCrudData) {
      return;
    }
    this.saveCrud.emit({
      resource: this.activeCrudData.resource,
      payload: { ...this.crudFormModel },
      itemId: this.editingRowId ?? undefined,
    });
    this.crudModalOpen = false;
  }

  openDeleteConfirmModal(row: Record<string, string>): void {
    this.pendingDeleteRow = row;
    this.deleteConfirmModalOpen = true;
  }

  cancelDeleteModal(): void {
    this.deleteConfirmModalOpen = false;
    this.pendingDeleteRow = null;
  }

  confirmDeleteRow(): void {
    if (!this.activeCrudData || !this.pendingDeleteRow?.['id']) {
      this.cancelDeleteModal();
      return;
    }
    this.deleteCrud.emit({
      resource: this.activeCrudData.resource,
      itemId: this.pendingDeleteRow['id'],
    });
    this.cancelDeleteModal();
  }

  getDeleteSummaryLabel(row: Record<string, string>): string {
    const keys = Object.keys(row).filter((k) => k !== 'id');
    return keys
      .slice(0, 2)
      .map((k) => row[k])
      .filter(Boolean)
      .join(' • ');
  }

  askQuestion(q: string): void {
    this.questionSubmitted.emit(q);
  }

  onSubmitCopilot(event: Event): void {
    event.preventDefault();
    const q = this.copilotQuestion.trim();
    if (q) {
      this.questionSubmitted.emit(q);
      this.copilotQuestion = '';
    }
  }
}
