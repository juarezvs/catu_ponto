import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { SearchableSelectComponent } from '../../shared/components/searchable-select.component';
import { PasswordInputComponent } from '../../shared/components/password-input.component';
import { OrganogramaViewComponent } from './organograma-view.component';

interface CadastroFieldOption {
  value: string;
  label: string;
}

interface CadastroFieldSchema {
  name: string;
  label: string;
  inputType: 'text' | 'password' | 'number' | 'boolean' | 'date' | 'textarea' | 'enum' | 'fk' | 'dynamic_select' | 'cascade_municipio' | 'text_array';
  required: boolean;
  dbType: string;
  default: unknown;
  readOnly: boolean;
  options: CadastroFieldOption[];
}

interface CadastroSchema {
  slug: string;
  tableName: string;
  titulo: string;
  grupo: string;
  descricao: string;
  pkCol: string;
  pkType: 'uuid' | 'int' | 'str';
  columns: string[];
  fields: CadastroFieldSchema[];
}

interface CadastroListResponse {
  items: Record<string, any>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  fkLabels: Record<string, Record<string, string>>;
  displayOverrides?: Record<string, Record<string, string>>;
}

interface GridFilterItem {
  id: string;
  column: string;
  operator: 'contains' | 'equals' | 'starts_with';
  value: string;
}

@Component({
  selector: 'app-cadastro-crud-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SearchableSelectComponent, PasswordInputComponent, OrganogramaViewComponent],
  template: `
    <div class="max-w-7xl mx-auto flex flex-col gap-4">
      <!-- BREADCRUMB & CABEÇALHO -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav aria-label="Breadcrumb" class="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-[#97999b]">
            <a routerLink="/home" class="hover:text-[#002f6c] hover:underline transition">Início</a>
            <span>›</span>
            <a routerLink="/secao/cadastros" class="hover:text-[#002f6c] hover:underline transition">Cadastro</a>
            @if (schema()) {
              <span>›</span>
              <a
                [routerLink]="['/secao', 'cadastros']"
                [queryParams]="{ grupo: schema()!.grupo }"
                class="hover:text-[#002f6c] hover:underline transition"
              >
                {{ schema()!.grupo }}
              </a>
              <span>›</span>
              <span class="text-[#002f6c]">{{ schema()!.titulo }}</span>
            }
          </nav>
          <div class="flex items-center gap-3 mt-1.5 flex-wrap">
            <h1 class="text-2xl font-bold text-[#002f6c] tracking-tight">
              {{ schema()?.titulo || 'Carregando cadastro...' }}
            </h1>
            @if (schema()) {
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#007a33] border border-emerald-200">
                {{ total() }} registros
              </span>
            }
          </div>
          @if (schema()) {
            <p class="text-xs text-slate-600 mt-1">{{ schema()!.descricao }}</p>
          }
        </div>
      </div>

      <!-- MENSAGEM DE FEEDBACK -->
      @if (feedbackMsg()) {
        <div
          class="rounded-xl px-4 py-2.5 text-xs font-semibold border flex items-center justify-between"
          [ngClass]="
            feedbackError()
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-[#007a33]'
          "
        >
          <span>{{ feedbackMsg() }}</span>
          <button type="button" (click)="feedbackMsg.set(null)" class="text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      }

      <!-- BARRA DE BUSCA -->
      <div class="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div class="flex items-center gap-2 flex-1">
          <input
            type="text"
            [(ngModel)]="searchTerm"
            (keyup.enter)="buscar()"
            placeholder="Pesquisar neste cadastro..."
            class="flex-1 h-9 px-3.5 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#002f6c]"
          />
          <button
            type="button"
            (click)="buscar()"
            class="h-9 px-4 rounded-xl bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-semibold transition"
          >
            Buscar
          </button>
          @if (searchTerm) {
            <button
              type="button"
              (click)="limparBusca()"
              class="h-9 px-3 rounded-xl border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition"
            >
              Limpar
            </button>
          }
        </div>
        <div class="flex items-center gap-3">
          <button
            type="button"
            (click)="abrirModalFiltro()"
            [disabled]="!schema()"
            class="h-9 px-3.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 hover:border-[#002f6c] text-xs font-semibold text-slate-700 flex items-center gap-1.5 transition"
            title="Filtrar por colunas da grid"
          >
            <svg class="w-4 h-4 text-[#002f6c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span>Filtros</span>
            @if (activeFilters().length > 0) {
              <span class="px-1.5 py-0.2 rounded-full bg-[#002f6c] text-white text-[10px] font-bold">
                {{ activeFilters().length }}
              </span>
            }
          </button>
          <div class="text-[11px] text-slate-500 font-medium">
            Página {{ page() }} de {{ totalPages() }}
          </div>
        </div>
      </div>

      <!-- CHIPS DE FILTROS ATIVOS (ENTRE A BUSCA E A GRID) -->
      @if (activeFilters().length > 0) {
        <div class="flex flex-wrap items-center gap-2 px-1">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#97999b]">
            Filtros ativos:
          </span>
          @for (flt of activeFilters(); track flt.id) {
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#002f6c]/10 border border-[#002f6c]/20 text-xs font-medium text-[#002f6c]">
              <span>
                <strong>{{ labelColuna(flt.column) }}</strong>
                {{ operatorLabel(flt.operator) }}
                "{{ flt.value }}"
              </span>
              <button
                type="button"
                (click)="removerFiltro(flt.id)"
                class="w-4 h-4 rounded-full hover:bg-[#002f6c] hover:text-white flex items-center justify-center text-[10px] font-bold transition"
                aria-label="Remover filtro"
                title="Excluir filtro"
              >
                ✕
              </button>
            </span>
          }
          @if (activeFilters().length > 1) {
            <button
              type="button"
              (click)="limparTodosFiltros()"
              class="text-[11px] font-semibold text-rose-600 hover:underline ml-1"
            >
              Limpar todos
            </button>
          }
        </div>
      }

      <!-- TABELA DE REGISTROS -->
      <div
        [ngClass]="
          fullscreen()
            ? 'fixed inset-3 z-40 flex flex-col bg-white rounded-2xl border border-slate-300 shadow-2xl overflow-hidden'
            : 'bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden'
        "
      >
        @if (loading()) {
          <div class="p-10 text-center text-xs text-slate-500">
            Consultando registros...
          </div>
        } @else if (items().length === 0) {
          <div class="p-10 text-center text-xs text-slate-500">
            Nenhum registro encontrado para os critérios atuais.
          </div>
        } @else if (schema()) {
          <!-- BARRA DE AÇÕES CONTEXTUAIS ESTILO AZURE PORTAL -->
          <div class="px-3 py-1.5 bg-white border-b border-[#edebe9] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex flex-wrap items-center gap-0.5">
              <button
                type="button"
                (click)="abrirModalNovo()"
                class="h-8 px-2.5 rounded hover:bg-[#f3f2f1] text-[#323130] flex items-center gap-1.5 transition"
              >
                <svg class="w-3.5 h-3.5 text-[#0078d4]" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                  <path d="M8 3v10M3 8h10"/>
                </svg>
                <span>Criar</span>
              </button>

              <button
                type="button"
                (click)="atualizarLista()"
                class="h-8 px-2.5 rounded hover:bg-[#f3f2f1] text-[#323130] flex items-center gap-1.5 transition"
              >
                <svg class="w-3.5 h-3.5 text-[#0078d4]" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M13.5 8a5.5 5.5 0 1 1-1.4-3.7M13.5 2.5v2.5H11"/>
                </svg>
                <span>Atualizar</span>
              </button>

              <button
                type="button"
                (click)="fullscreen.set(!fullscreen())"
                class="h-8 px-2.5 rounded hover:bg-[#f3f2f1] text-[#323130] flex items-center gap-1.5 transition"
              >
                <svg class="w-3.5 h-3.5 text-[#0078d4]" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>
                </svg>
                <span>{{ fullscreen() ? 'Sair tela inteira' : 'Tela inteira' }}</span>
              </button>

              <span class="h-5 w-px bg-[#edebe9] mx-1"></span>

              <button
                type="button"
                (click)="editarSelecionado()"
                [disabled]="selectedRows().length !== 1"
                class="h-8 px-2.5 rounded hover:bg-[#f3f2f1] disabled:hover:bg-transparent disabled:opacity-45 disabled:cursor-not-allowed text-[#323130] flex items-center gap-1.5 transition"
                title="Selecione exatamente 1 item para editar"
              >
                <svg class="w-3.5 h-3.5" [ngClass]="selectedRows().length === 1 ? 'text-[#0078d4]' : 'text-[#a19f9d]'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M11.5 2.5l2 2L5 13H3v-2l8.5-8.5z"/>
                </svg>
                <span>Editar</span>
              </button>

              <button
                type="button"
                (click)="clonarSelecionado()"
                [disabled]="selectedRows().length !== 1"
                class="h-8 px-2.5 rounded hover:bg-[#f3f2f1] disabled:hover:bg-transparent disabled:opacity-45 disabled:cursor-not-allowed text-[#323130] flex items-center gap-1.5 transition"
                title="Selecione exatamente 1 item para clonar"
              >
                <svg class="w-3.5 h-3.5" [ngClass]="selectedRows().length === 1 ? 'text-[#0078d4]' : 'text-[#a19f9d]'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <rect x="5" y="5" width="8.5" height="8.5" rx="1"/>
                  <path d="M11 5V3.5A1 1 0 0 0 10 2.5H3.5a1 1 0 0 0-1 1V10a1 1 0 0 0 1 1H5"/>
                </svg>
                <span>Clonar</span>
              </button>

              <div class="relative">
                <button
                  type="button"
                  (click)="exportMenuOpen.set(!exportMenuOpen())"
                  [disabled]="selectedRows().length === 0"
                  class="h-8 px-2.5 rounded hover:bg-[#f3f2f1] disabled:hover:bg-transparent disabled:opacity-45 disabled:cursor-not-allowed text-[#323130] flex items-center gap-1.5 transition"
                  title="Selecione 1 ou mais itens para exportar"
                >
                  <svg class="w-3.5 h-3.5" [ngClass]="selectedRows().length > 0 ? 'text-[#0078d4]' : 'text-[#a19f9d]'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 2.5v8M5 7.5l3 3 3-3M2.5 13.5h11"/>
                  </svg>
                  <span>Exportar</span>
                  <svg class="w-3 h-3 opacity-70" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                    <polyline points="4 6 8 10 12 6"/>
                  </svg>
                </button>

                @if (exportMenuOpen() && selectedRows().length > 0) {
                  <div class="fixed inset-0 z-30" (click)="exportMenuOpen.set(false)"></div>
                  <div class="absolute left-0 mt-1 z-40 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 text-xs">
                    <button
                      type="button"
                      (click)="exportarSelecionadosPdf()"
                      class="w-full px-3 py-2 text-left hover:bg-[#f3f2f1] flex items-center gap-2.5 text-[#323130] transition"
                    >
                      <span class="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">PDF</span>
                      <span>Exportar PDF</span>
                    </button>
                    <button
                      type="button"
                      (click)="exportarSelecionadosExcel()"
                      class="w-full px-3 py-2 text-left hover:bg-[#f3f2f1] flex items-center gap-2.5 text-[#323130] transition"
                    >
                      <span class="px-1.5 py-0.5 rounded bg-emerald-100 text-[#007a33] text-[10px] font-bold">XLSX</span>
                      <span>Exportar Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      (click)="exportarSelecionadosCsv()"
                      class="w-full px-3 py-2 text-left hover:bg-[#f3f2f1] flex items-center gap-2.5 text-[#323130] transition"
                    >
                      <span class="px-1.5 py-0.5 rounded bg-blue-100 text-[#002f6c] text-[10px] font-bold">CSV</span>
                      <span>Exportar CSV (.csv)</span>
                    </button>
                  </div>
                }
              </div>

              <button
                type="button"
                (click)="solicitarExclusaoEmLote()"
                [disabled]="selectedRows().length === 0"
                class="h-8 px-2.5 rounded hover:bg-rose-50 disabled:hover:bg-transparent disabled:opacity-45 disabled:cursor-not-allowed text-[#323130] flex items-center gap-1.5 transition"
                title="Selecione 1 ou mais itens para excluir"
              >
                <svg class="w-3.5 h-3.5" [ngClass]="selectedRows().length > 0 ? 'text-rose-600' : 'text-[#a19f9d]'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9"/>
                </svg>
                <span>Excluir</span>
              </button>
            </div>

            <div class="flex items-center gap-2">
              @if (selectedRows().length > 0 && viewMode() === 'grid') {
                <div class="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#eff6fc] border border-[#0078d4]/20 text-[11px] font-semibold text-[#005a9e]">
                  <span>{{ selectedRows().length }} selecionado(s)</span>
                  <button type="button" (click)="limparSelecao()" class="hover:underline text-[10px]">Desmarcar</button>
                </div>
              }

              @if (supportsOrganograma()) {
                <div class="inline-flex items-center rounded-lg border border-[#d2d0ce] bg-[#faf9f8] p-0.5" role="group" aria-label="Modo de visualização">
                  <button
                    type="button"
                    (click)="viewMode.set('grid'); fullscreen.set(false)"
                    [ngClass]="viewMode() === 'grid' ? 'bg-white text-[#005a9e] shadow-xs font-semibold' : 'text-[#605e5c] hover:text-[#323130]'"
                    class="h-7 px-2.5 rounded-md text-[11px] flex items-center gap-1.5 transition"
                    title="Visualizar em Grid"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="2" y="2.5" width="12" height="11" rx="1.2"/>
                      <path d="M2 6h12M6 6v7.5M10 6v7.5"/>
                    </svg>
                    <span>Grid</span>
                  </button>
                  <button
                    type="button"
                    (click)="viewMode.set('organograma'); fullscreen.set(true)"
                    [ngClass]="viewMode() === 'organograma' ? 'bg-white text-[#005a9e] shadow-xs font-semibold' : 'text-[#605e5c] hover:text-[#323130]'"
                    class="h-7 px-2.5 rounded-md text-[11px] flex items-center gap-1.5 transition"
                    title="Visualizar em Organograma (Tela cheia)"
                  >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <rect x="5.5" y="2" width="5" height="3" rx="0.6"/>
                      <rect x="1.5" y="10.5" width="4.5" height="3" rx="0.6"/>
                      <rect x="10" y="10.5" width="4.5" height="3" rx="0.6"/>
                      <path d="M8 5v2.8M3.8 10.5V7.8h8.4v2.7"/>
                    </svg>
                    <span>Organograma</span>
                  </button>
                </div>
              }
            </div>
          </div>

          @if (supportsOrganograma() && viewMode() === 'organograma') {
            <app-organograma-view
              class="flex-1 overflow-hidden"
              [externalSearch]="searchTerm"
              [externalFilters]="activeFilters()"
            />
          } @else {

          <!-- PAGINAÇÃO + ITENS POR PÁGINA (ACIMA DA GRID) -->
          <div class="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-slate-600">
                Exibindo {{ items().length }} de {{ total() }} registros
              </span>
              <div class="flex items-center gap-1.5">
                <span class="text-slate-500 text-[11px]">Itens/pág.:</span>
                <div class="w-24">
                  <app-searchable-select
                    size="sm"
                    [required]="true"
                    [ngModel]="pageSizeString()"
                    (ngModelChange)="mudarTamanhoPagina($event)"
                    [options]="pageSizeOptions"
                    searchPlaceholder="Qtd..."
                  />
                </div>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                (click)="mudarPagina(1)"
                [disabled]="page() <= 1"
                class="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold text-slate-700 transition"
              >
                « Primeira Página
              </button>
              <button
                type="button"
                (click)="mudarPagina(page() - 1)"
                [disabled]="page() <= 1"
                class="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold text-slate-700 transition"
              >
                ‹ Anterior
              </button>
              <span class="px-2 text-slate-600 font-medium">
                {{ page() }} / {{ totalPages() }}
              </span>
              <button
                type="button"
                (click)="mudarPagina(page() + 1)"
                [disabled]="page() >= totalPages()"
                class="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold text-slate-700 transition"
              >
                Próxima ›
              </button>
              <button
                type="button"
                (click)="mudarPagina(totalPages())"
                [disabled]="page() >= totalPages()"
                class="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 font-semibold text-slate-700 transition"
              >
                Última Página »
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th class="px-3 py-3 w-10 text-center">
                    <input
                      type="checkbox"
                      [checked]="todosSelecionados()"
                      [indeterminate]="algunsSelecionados()"
                      (change)="toggleSelecionarTodos()"
                      aria-label="Selecionar todos os registros da página"
                      class="w-4 h-4 rounded border-slate-300 text-[#0078d4] cursor-pointer"
                    />
                  </th>
                  @for (col of schema()!.columns; track col) {
                    <th
                      (click)="alternarOrdenacao(col)"
                      class="px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 hover:text-[#002f6c] transition"
                      [title]="'Ordenar por ' + labelColuna(col)"
                    >
                      <div class="inline-flex items-center gap-1.5">
                        <span>{{ labelColuna(col) }}</span>
                        @if (sortBy() === col) {
                          <span class="text-[#002f6c] text-[10px]">{{ sortDir() === 'asc' ? '▲' : '▼' }}</span>
                        } @else {
                          <span class="text-slate-300 text-[10px]">⇅</span>
                        }
                      </div>
                    </th>
                  }
                  <th class="px-4 py-3 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs">
                @for (row of items(); track row[schema()!.pkCol]) {
                  <tr
                    class="hover:bg-slate-50/80 transition"
                    [ngClass]="isSelecionado(row) ? 'bg-[#eff6fc]/70' : ''"
                  >
                    <td class="px-3 py-3 w-10 text-center">
                      <input
                        type="checkbox"
                        [checked]="isSelecionado(row)"
                        (change)="toggleSelecao(row)"
                        aria-label="Selecionar registro"
                        class="w-4 h-4 rounded border-slate-300 text-[#0078d4] cursor-pointer"
                      />
                    </td>
                    @for (col of schema()!.columns; track col) {
                      <td class="px-4 py-3 max-w-[260px] truncate" [title]="formatarValor(row, col)">
                        @if (typeofVal(row[col]) === 'boolean') {
                          <span
                            class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold"
                            [ngClass]="
                              row[col]
                                ? 'bg-emerald-50 text-[#007a33] border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            "
                          >
                            {{ row[col] ? 'Sim / Ativo' : 'Não / Inativo' }}
                          </span>
                        } @else {
                          <span class="text-slate-700">{{ formatarValor(row, col) }}</span>
                        }
                      </td>
                    }
                    <td class="px-4 py-3 text-right whitespace-nowrap">
                      <div class="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="abrirModalEditar(row)"
                          class="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-[#002f6c] hover:text-[#002f6c] text-[11px] font-semibold text-slate-700 transition"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          (click)="solicitarExclusao(row)"
                          class="px-2.5 py-1 rounded-lg border border-rose-200 hover:bg-rose-50 text-[11px] font-semibold text-rose-700 transition"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          }
        }
      </div>
    </div>

    <!-- MODAL DE CRIAÇÃO / EDIÇÃO -->
    @if (formModalOpen() && schema()) {
      <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
        <div
          [ngClass]="
            formModalExpanded()
              ? 'w-[95vw] max-w-[95vw] h-[92vh]'
              : 'w-full max-w-4xl max-h-[90vh]'
          "
          class="bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden transition-all duration-150"
        >
          <div class="px-6 py-4 bg-[#002f6c] text-white flex items-center justify-between gap-3 shrink-0">
            <div>
              <h2 class="text-sm font-bold">
                {{ editingId() ? 'Editar Registro' : 'Novo Registro' }} — {{ schema()!.titulo }}
              </h2>
              <p class="text-[11px] text-blue-200 mt-0.5">{{ schema()!.descricao }}</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                (click)="formModalExpanded.set(!formModalExpanded())"
                class="h-7 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold flex items-center gap-1 transition"
                [title]="formModalExpanded() ? 'Restaurar tamanho' : 'Expandir tela'"
              >
                <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>
                </svg>
                <span>{{ formModalExpanded() ? 'Restaurar' : 'Expandir' }}</span>
              </button>
              <button type="button" (click)="fecharFormModal()" class="text-white/80 hover:text-white text-sm px-1">✕</button>
            </div>
          </div>

          <form (submit)="salvarRegistro($event)" class="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 content-start">
            @for (field of schema()!.fields; track field.name) {
              <div [ngClass]="isWideField(field) ? 'md:col-span-2' : ''">
                @if (field.inputType === 'boolean') {
                  <label class="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      class="w-4 h-4 rounded border-slate-300 text-[#002f6c]"
                    />
                    <span class="text-xs font-semibold text-slate-700">{{ field.label }}</span>
                  </label>
                } @else {
                  <label class="block text-xs font-semibold text-slate-700 mb-1">
                    {{ field.label }}
                    @if (field.required) {
                      <span class="text-rose-600">*</span>
                    }
                  </label>

                  @if (field.inputType === 'enum' || field.inputType === 'fk' || field.inputType === 'dynamic_select') {
                    <app-searchable-select
                      [(ngModel)]="formData[field.name]"
                      (ngModelChange)="onFieldValueChange(field.name, $event)"
                      [name]="field.name"
                      [required]="field.required"
                      [options]="field.options"
                      placeholder="-- Selecione --"
                      searchPlaceholder="Pesquisar opção..."
                    />
                  } @else if (field.inputType === 'cascade_municipio') {
                    <app-searchable-select
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      [required]="field.required"
                      [options]="municipioOptions()"
                      [placeholder]="formData['uf'] ? '-- Selecione o Município --' : '-- Selecione a UF primeiro --'"
                      searchPlaceholder="Pesquisar município..."
                    />
                  } @else if (field.inputType === 'textarea') {
                    <textarea
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      [required]="field.required"
                      rows="3"
                      class="w-full p-3 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#002f6c]"
                    ></textarea>
                  } @else if (field.inputType === 'number') {
                    <input
                      type="number"
                      step="any"
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      [required]="field.required"
                      class="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#002f6c]"
                    />
                  } @else if (field.inputType === 'date') {
                    <input
                      type="date"
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      [required]="field.required"
                      class="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#002f6c]"
                    />
                  } @else if (field.inputType === 'password') {
                    <app-password-input
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      [required]="field.required"
                      placeholder="••••••••"
                      autocomplete="new-password"
                    />
                  } @else {
                    <input
                      type="text"
                      [(ngModel)]="formData[field.name]"
                      [name]="field.name"
                      [required]="field.required"
                      class="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#002f6c]"
                    />
                  }
                }
              </div>
            }

            @if (formError()) {
              <div class="sm:col-span-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-semibold">
                {{ formError() }}
              </div>
            }

            <div class="sm:col-span-2 pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="fecharFormModal()"
                class="h-9 px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="submit"
                [disabled]="saving()"
                class="h-9 px-5 rounded-xl bg-[#007a33] hover:bg-[#006229] disabled:opacity-50 text-white text-xs font-bold shadow-sm"
              >
                {{ saving() ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }

    <!-- MODAL DE FILTROS POR COLUNA -->
    @if (filterModalOpen() && schema()) {
      <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-xl flex flex-col overflow-visible">
          <div class="px-5 py-4 bg-[#002f6c] text-white rounded-t-2xl flex items-center justify-between">
            <div>
              <h2 class="text-sm font-bold">Filtrar por Colunas — {{ schema()!.titulo }}</h2>
              <p class="text-[11px] text-blue-200">Adicione um ou mais filtros combinados sobre as colunas da grid</p>
            </div>
            <button type="button" (click)="filterModalOpen.set(false)" class="text-white/80 hover:text-white text-sm">✕</button>
          </div>

          <div class="p-5 flex flex-col gap-4">
            <form (submit)="adicionarFiltro($event)" class="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div class="sm:col-span-5">
                <label class="block text-xs font-semibold text-slate-700 mb-1">Coluna</label>
                <app-searchable-select
                  [(ngModel)]="newFilterColumn"
                  name="filterCol"
                  [required]="true"
                  [options]="filterColumnOptions()"
                  searchPlaceholder="Pesquisar coluna..."
                />
              </div>

              <div class="sm:col-span-3">
                <label class="block text-xs font-semibold text-slate-700 mb-1">Regra</label>
                <app-searchable-select
                  [(ngModel)]="newFilterOperator"
                  name="filterOp"
                  [required]="true"
                  [options]="filterOperatorOptions"
                  searchPlaceholder="Pesquisar regra..."
                />
              </div>

              <div class="sm:col-span-4">
                <label class="block text-xs font-semibold text-slate-700 mb-1">Valor</label>
                <input
                  type="text"
                  [(ngModel)]="newFilterValue"
                  name="filterVal"
                  required
                  placeholder="Digite o valor..."
                  class="w-full h-9 px-3 rounded-xl border border-slate-300 text-xs outline-none focus:border-[#002f6c]"
                />
              </div>

              <div class="sm:col-span-12 flex justify-end">
                <button
                  type="submit"
                  class="h-9 px-4 rounded-xl bg-[#007a33] hover:bg-[#006229] text-white text-xs font-bold shadow-sm transition"
                >
                  + Adicionar Filtro
                </button>
              </div>
            </form>

            @if (activeFilters().length > 0) {
              <div class="pt-3 border-t border-slate-200">
                <span class="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Filtros aplicados ({{ activeFilters().length }})
                </span>
                <div class="flex flex-wrap gap-2">
                  @for (flt of activeFilters(); track flt.id) {
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#002f6c]/10 border border-[#002f6c]/20 text-xs font-medium text-[#002f6c]">
                      <span>
                        <strong>{{ labelColuna(flt.column) }}</strong>
                        {{ operatorLabel(flt.operator) }}
                        "{{ flt.value }}"
                      </span>
                      <button
                        type="button"
                        (click)="removerFiltro(flt.id)"
                        class="w-4 h-4 rounded-full hover:bg-[#002f6c] hover:text-white flex items-center justify-center text-[10px] font-bold transition"
                        aria-label="Excluir filtro"
                      >
                        ✕
                      </button>
                    </span>
                  }
                </div>
              </div>
            }

            <div class="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
              @if (activeFilters().length > 0) {
                <button
                  type="button"
                  (click)="limparTodosFiltros()"
                  class="h-9 px-4 rounded-xl border border-rose-200 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                >
                  Limpar Filtros
                </button>
              }
              <button
                type="button"
                (click)="filterModalOpen.set(false)"
                class="h-9 px-5 rounded-xl bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-bold"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (OBRIGATÓRIO) -->
    @if (deleteTargets().length > 0) {
      <div class="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold">
              !
            </div>
            <div>
              <h3 class="text-base font-bold text-slate-900">Confirmar Exclusão</h3>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">
                Tem certeza que deseja excluir permanentemente
                <strong>{{ deleteTargets().length }} registro(s)</strong> de
                <strong>{{ schema()?.titulo }}</strong>? Esta ação não poderá ser desfeita.
              </p>
              <div class="mt-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 max-h-28 overflow-y-auto flex flex-col gap-1">
                @for (t of deleteTargets(); track t[schema()!.pkCol]) {
                  <div class="truncate" [title]="resumoExclusao(t)">• {{ resumoExclusao(t) }}</div>
                }
              </div>
            </div>
          </div>

          <div class="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="deleteTargets.set([])"
              class="h-9 px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmarExclusao()"
              [disabled]="deleting()"
              class="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm"
            >
              {{ deleting() ? 'Excluindo...' : 'Confirmar Exclusão' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CadastroCrudPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  private readonly apiBase = 'http://localhost:8000/api/v1/secp/cadastros';

  readonly slug = signal<string>('orgaos');
  readonly schema = signal<CadastroSchema | null>(null);
  readonly items = signal<Record<string, any>[]>([]);
  readonly fkLabels = signal<Record<string, Record<string, string>>>({});
  readonly displayOverrides = signal<Record<string, Record<string, string>>>({});
  readonly total = signal<number>(0);
  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(20);
  readonly totalPages = signal<number>(1);
  readonly loading = signal<boolean>(false);
  readonly fullscreen = signal<boolean>(false);
  readonly exportMenuOpen = signal<boolean>(false);
  readonly viewMode = signal<'grid' | 'organograma'>('grid');
  readonly supportsOrganograma = computed(
    () => this.slug() === 'orgaos' || this.slug() === 'unidades-organizacionais'
  );
  readonly sortBy = signal<string>('');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly pageSizeOptions: CadastroFieldOption[] = [
    { value: '5', label: '5' },
    { value: '10', label: '10' },
    { value: '15', label: '15' },
    { value: '20', label: '20' },
    { value: '50', label: '50' },
    { value: '100', label: '100' },
  ];
  readonly pageSizeString = computed(() => String(this.pageSize()));

  readonly selectedIds = signal<Set<string>>(new Set());
  readonly selectedRows = computed(() => {
    const pkCol = this.schema()?.pkCol;
    if (!pkCol) return [];
    const ids = this.selectedIds();
    return this.items().filter((r) => ids.has(String(r[pkCol])));
  });
  readonly todosSelecionados = computed(() => {
    const list = this.items();
    return list.length > 0 && this.selectedRows().length === list.length;
  });
  readonly algunsSelecionados = computed(() => {
    const count = this.selectedRows().length;
    return count > 0 && count < this.items().length;
  });

  readonly formModalOpen = signal<boolean>(false);
  readonly formModalExpanded = signal<boolean>(false);
  readonly editingId = signal<string | null>(null);
  readonly saving = signal<boolean>(false);
  readonly formError = signal<string | null>(null);

  readonly deleteTargets = signal<Record<string, any>[]>([]);
  readonly deleting = signal<boolean>(false);

  readonly feedbackMsg = signal<string | null>(null);
  readonly feedbackError = signal<boolean>(false);
  readonly municipioOptions = signal<CadastroFieldOption[]>([]);

  readonly filterModalOpen = signal<boolean>(false);
  readonly activeFilters = signal<GridFilterItem[]>([]);
  readonly filterOperatorOptions: CadastroFieldOption[] = [
    { value: 'contains', label: 'Contém' },
    { value: 'equals', label: 'Igual a' },
    { value: 'starts_with', label: 'Começa com' },
  ];
  newFilterColumn = '';
  newFilterOperator: 'contains' | 'equals' | 'starts_with' = 'contains';
  newFilterValue = '';

  searchTerm = '';
  formData: Record<string, any> = {};

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const s = params.get('slug') || 'orgaos';
      this.slug.set(s);
      this.searchTerm = '';
      this.activeFilters.set([]);
      this.sortBy.set('');
      this.sortDir.set('asc');
      this.selectedIds.set(new Set());
      this.fullscreen.set(false);
      this.viewMode.set('grid');
      this.page.set(1);
      this.feedbackMsg.set(null);
      this.carregarSchemaELista();
    });
  }

  private carregarSchemaELista(): void {
    this.loading.set(true);
    this.http.get<CadastroSchema>(`${this.apiBase}/${this.slug()}/schema`).subscribe({
      next: (sc) => {
        this.schema.set(sc);
        this.carregarLista();
      },
      error: (err) => {
        this.loading.set(false);
        this.mostrarFeedback(err?.error?.detail || 'Erro ao carregar schema do cadastro.', true);
      },
    });
  }

  private carregarLista(): void {
    this.loading.set(true);
    this.selectedIds.set(new Set());
    const params = new URLSearchParams({
      page: String(this.page()),
      page_size: String(this.pageSize()),
      search: this.searchTerm.trim(),
    });
    if (this.activeFilters().length > 0) {
      params.set('filters', JSON.stringify(this.activeFilters()));
    }
    if (this.sortBy()) {
      params.set('sort_by', this.sortBy());
      params.set('sort_dir', this.sortDir());
    }
    this.http.get<CadastroListResponse>(`${this.apiBase}/${this.slug()}?${params.toString()}`).subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.total.set(res.total);
        this.totalPages.set(res.totalPages);
        this.fkLabels.set(res.fkLabels || {});
        this.displayOverrides.set(res.displayOverrides || {});
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.mostrarFeedback(err?.error?.detail || 'Erro ao consultar registros.', true);
      },
    });
  }

  buscar(): void {
    this.page.set(1);
    this.carregarLista();
  }

  limparBusca(): void {
    this.searchTerm = '';
    this.page.set(1);
    this.carregarLista();
  }

  filterColumnOptions(): CadastroFieldOption[] {
    const cols = this.schema()?.columns ?? [];
    return cols.map((c) => ({ value: c, label: this.labelColuna(c) }));
  }

  operatorLabel(op: GridFilterItem['operator']): string {
    if (op === 'equals') return '=';
    if (op === 'starts_with') return 'começa com';
    return 'contém';
  }

  abrirModalFiltro(): void {
    const cols = this.schema()?.columns ?? [];
    if (!this.newFilterColumn && cols.length > 0) {
      this.newFilterColumn = cols[0];
    }
    this.newFilterValue = '';
    this.filterModalOpen.set(true);
  }

  adicionarFiltro(event: Event): void {
    event.preventDefault();
    const val = this.newFilterValue.trim();
    if (!this.newFilterColumn || !val) return;
    const item: GridFilterItem = {
      id: `flt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      column: this.newFilterColumn,
      operator: this.newFilterOperator,
      value: val,
    };
    this.activeFilters.update((list) => [...list, item]);
    this.newFilterValue = '';
    this.page.set(1);
    this.carregarLista();
  }

  removerFiltro(id: string): void {
    this.activeFilters.update((list) => list.filter((f) => f.id !== id));
    this.page.set(1);
    this.carregarLista();
  }

  limparTodosFiltros(): void {
    this.activeFilters.set([]);
    this.page.set(1);
    this.carregarLista();
  }

  alternarOrdenacao(col: string): void {
    if (this.sortBy() === col) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(col);
      this.sortDir.set('asc');
    }
    this.page.set(1);
    this.carregarLista();
  }

  mudarPagina(nova: number): void {
    if (nova < 1 || nova > this.totalPages()) return;
    this.page.set(nova);
    this.carregarLista();
  }

  labelColuna(col: string): string {
    const f = this.schema()?.fields.find((x) => x.name === col);
    return f ? f.label : col;
  }

  typeofVal(v: unknown): string {
    return typeof v;
  }

  formatarValor(row: Record<string, any>, col: string): string {
    const pkCol = this.schema()?.pkCol;
    if (pkCol) {
      const ov = this.displayOverrides()[String(row[pkCol])]?.[col];
      if (ov !== undefined && ov !== '') {
        return ov;
      }
    }
    const val = row[col];
    if (val === null || val === undefined || val === '') return '--';
    const fkMap = this.fkLabels()[col];
    if (fkMap && fkMap[String(val)]) {
      return fkMap[String(val)];
    }
    if (Array.isArray(val)) {
      return val.join(', ');
    }
    const str = String(val);
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (isoDateMatch) {
      return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
    }
    const isoDtMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}:\d{2}:\d{2})/.exec(str);
    if (isoDtMatch) {
      return `${isoDtMatch[3]}/${isoDtMatch[2]}/${isoDtMatch[1]} ${isoDtMatch[4]}`;
    }
    return str;
  }

  abrirModalNovo(): void {
    const sc = this.schema();
    if (!sc) return;
    const data: Record<string, any> = {};
    for (const f of sc.fields) {
      if (f.default !== null && f.default !== undefined) {
        data[f.name] = f.default;
      } else if (f.inputType === 'boolean') {
        data[f.name] = false;
      } else {
        data[f.name] = '';
      }
    }
    this.formData = data;
    this.municipioOptions.set([]);
    if (data['uf']) {
      this.carregarMunicipiosPorUf(String(data['uf']));
    }
    this.editingId.set(null);
    this.formError.set(null);
    this.formModalOpen.set(true);
  }

  abrirModalEditar(row: Record<string, any>): void {
    const sc = this.schema();
    if (!sc) return;
    const data: Record<string, any> = {};
    for (const f of sc.fields) {
      let val = row[f.name];
      if (f.inputType === 'text_array' && Array.isArray(val)) {
        val = val.join(', ');
      } else if (f.inputType === 'date' && typeof val === 'string') {
        val = val.slice(0, 10);
      } else if (f.name === 'uf' && typeof val === 'string') {
        val = val.trim();
      }
      data[f.name] = val ?? (f.inputType === 'boolean' ? false : '');
    }
    this.formData = data;
    this.municipioOptions.set([]);
    if (data['uf']) {
      this.carregarMunicipiosPorUf(String(data['uf']));
    }
    this.editingId.set(String(row[sc.pkCol]));
    this.formError.set(null);
    this.formModalOpen.set(true);
  }

  fecharFormModal(): void {
    this.formModalOpen.set(false);
    this.formModalExpanded.set(false);
    this.formError.set(null);
  }

  isWideField(field: CadastroFieldSchema): boolean {
    if (
      field.inputType === 'textarea' ||
      field.inputType === 'text_array' ||
      field.inputType === 'fk'
    ) {
      return true;
    }
    const wideNames = new Set([
      'nome',
      'nome_funcional',
      'descricao',
      'titulo',
      'motivo',
      'base_url',
      'observacao',
      'email',
      'ato_autorizativo',
      'numero_portaria',
      'localizacao',
      'valor',
    ]);
    return wideNames.has(field.name);
  }

  onFieldValueChange(fieldName: string, value: string): void {
    if (fieldName === 'uf') {
      this.formData['municipio'] = '';
      this.carregarMunicipiosPorUf(value);
    }
  }

  private carregarMunicipiosPorUf(uf: string): void {
    const cleanUf = (uf || '').trim();
    if (!cleanUf) {
      this.municipioOptions.set([]);
      return;
    }
    this.http
      .get<CadastroFieldOption[]>(`${this.apiBase}/aux/municipios?uf=${encodeURIComponent(cleanUf)}`)
      .subscribe({
        next: (rows) => this.municipioOptions.set(rows || []),
        error: () => this.municipioOptions.set([]),
      });
  }

  salvarRegistro(event: Event): void {
    event.preventDefault();
    this.saving.set(true);
    this.formError.set(null);

    const id = this.editingId();
    const req = id
      ? this.http.put(`${this.apiBase}/${this.slug()}/${encodeURIComponent(id)}`, this.formData)
      : this.http.post(`${this.apiBase}/${this.slug()}`, this.formData);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.formModalOpen.set(false);
        this.mostrarFeedback(
          id ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.',
          false
        );
        this.carregarLista();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err?.error?.detail || 'Erro ao salvar registro.');
      },
    });
  }

  atualizarLista(): void {
    this.carregarLista();
  }

  mudarTamanhoPagina(val: string): void {
    const parsed = Number(val);
    if (!parsed || parsed === this.pageSize()) return;
    this.pageSize.set(parsed);
    this.page.set(1);
    this.carregarLista();
  }

  isSelecionado(row: Record<string, any>): boolean {
    const pkCol = this.schema()?.pkCol;
    if (!pkCol) return false;
    return this.selectedIds().has(String(row[pkCol]));
  }

  toggleSelecao(row: Record<string, any>): void {
    const pkCol = this.schema()?.pkCol;
    if (!pkCol) return;
    const id = String(row[pkCol]);
    this.selectedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSelecionarTodos(): void {
    const pkCol = this.schema()?.pkCol;
    if (!pkCol) return;
    if (this.todosSelecionados()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.items().map((r) => String(r[pkCol]))));
    }
  }

  limparSelecao(): void {
    this.selectedIds.set(new Set());
  }

  editarSelecionado(): void {
    const rows = this.selectedRows();
    if (rows.length === 1) {
      this.abrirModalEditar(rows[0]);
    }
  }

  clonarSelecionado(): void {
    const rows = this.selectedRows();
    if (rows.length !== 1) return;
    this.abrirModalEditar(rows[0]);
    this.editingId.set(null);
  }

  exportarSelecionadosCsv(): void {
    this.exportMenuOpen.set(false);
    const rows = this.selectedRows();
    const sc = this.schema();
    if (!sc || rows.length === 0) return;
    const header = sc.columns.map((c) => `"${this.labelColuna(c).replace(/"/g, '""')}"`).join(';');
    const lines = rows.map((r) =>
      sc.columns.map((c) => `"${this.formatarValor(r, c).replace(/"/g, '""')}"`).join(';')
    );
    const csv = [header, ...lines].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sc.slug}-selecionados.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportarSelecionadosExcel(): void {
    this.exportMenuOpen.set(false);
    const rows = this.selectedRows();
    const sc = this.schema();
    if (!sc || rows.length === 0) return;

    try {
      const headers = sc.columns.map((c) => this.labelColuna(c));
      const dataRows = rows.map((r) => sc.columns.map((c) => this.formatarValor(r, c)));
      const sheetData = [
        [`SECP • ${sc.titulo}`],
        [`Exportado em ${new Date().toLocaleString('pt-BR')} • ${rows.length} registro(s)`],
        [],
        headers,
        ...dataRows,
      ];

      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      ws['!cols'] = sc.columns.map((_, idx) => {
        const maxLen = Math.max(
          headers[idx].length,
          ...dataRows.map((dr) => String(dr[idx] ?? '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 4, 14), 60) };
      });

      const sheetName = sc.titulo.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Dados';
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbOut], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sc.slug}-selecionados.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      this.mostrarFeedback(err?.message || 'Erro ao gerar arquivo Excel (.xlsx).', true);
    }
  }

  exportarSelecionadosPdf(): void {
    this.exportMenuOpen.set(false);
    const rows = this.selectedRows();
    const sc = this.schema();
    if (!sc || rows.length === 0) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // Cabeçalho institucional
    doc.setFillColor(0, 47, 108);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(`SECP • ${sc.titulo}`, 14, 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(
      `Tabela: ${sc.tableName}  •  Emitido em ${new Date().toLocaleString('pt-BR')}  •  ${rows.length} registro(s)`,
      14,
      16.5
    );

    const head = [sc.columns.map((c) => this.labelColuna(c))];
    const body = rows.map((r) => sc.columns.map((c) => this.formatarValor(r, c)));

    autoTable(doc, {
      head,
      body,
      startY: 27,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        textColor: [30, 41, 59],
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [0, 47, 108],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });

    doc.save(`${sc.slug}-selecionados.pdf`);
  }

  private escapeHtml(val: string): string {
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  resumoExclusao(row: Record<string, any>): string {
    const sc = this.schema();
    if (!sc) return '';
    const nonPkCols = sc.columns.filter((c) => c !== sc.pkCol);
    const codeCandidates = [
      'sigla',
      'codigo',
      'matricula',
      'codigo_externo_sarh',
      'numero_portaria',
      'rotulo',
      'ano',
      'data_referencia',
      'valor',
    ];
    const descCandidates = [
      'nome',
      'nome_funcional',
      'descricao',
      'titulo',
      'motivo',
      'valor',
    ];

    const codeCol = codeCandidates.find((c) => nonPkCols.includes(c)) ?? nonPkCols[0];
    const descCol =
      descCandidates.find((c) => nonPkCols.includes(c) && c !== codeCol) ??
      nonPkCols.find((c) => c !== codeCol);

    const parts: string[] = [];
    if (codeCol) {
      const v = this.formatarValor(row, codeCol);
      if (v && v !== '--') parts.push(v);
    }
    if (descCol) {
      const v = this.formatarValor(row, descCol);
      if (v && v !== '--' && !parts.includes(v)) parts.push(v);
    }
    return parts.join(' — ') || 'Registro selecionado';
  }

  solicitarExclusao(row: Record<string, any>): void {
    this.deleteTargets.set([row]);
  }

  solicitarExclusaoEmLote(): void {
    const rows = this.selectedRows();
    if (rows.length > 0) {
      this.deleteTargets.set(rows);
    }
  }

  confirmarExclusao(): void {
    const targets = this.deleteTargets();
    const sc = this.schema();
    if (!targets.length || !sc) return;
    this.deleting.set(true);

    const calls = targets.map((t) =>
      this.http
        .delete(`${this.apiBase}/${this.slug()}/${encodeURIComponent(String(t[sc.pkCol]))}`)
        .pipe(
          catchError((err) =>
            of({ __error: err?.error?.detail || 'Não foi possível excluir o registro.' })
          )
        )
    );

    forkJoin(calls).subscribe((results: any[]) => {
      const erros = results.filter((r) => r && r.__error);
      const okCount = results.length - erros.length;
      this.deleting.set(false);
      this.deleteTargets.set([]);
      this.selectedIds.set(new Set());
      if (erros.length > 0 && okCount === 0) {
        this.mostrarFeedback(erros[0].__error, true);
      } else if (erros.length > 0) {
        this.mostrarFeedback(
          `${okCount} registro(s) excluído(s); ${erros.length} não pôde(m) ser excluído(s) por vínculo.`,
          true
        );
        this.carregarLista();
      } else {
        this.mostrarFeedback(`${okCount} registro(s) excluído(s) com sucesso.`, false);
        this.carregarLista();
      }
    });
  }

  private mostrarFeedback(msg: string, isError: boolean): void {
    this.feedbackMsg.set(msg);
    this.feedbackError.set(isError);
  }
}
