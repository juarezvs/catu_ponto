import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  ApuracaoDiaria,
  HistoricoAjusteItem,
  OcorrenciaEspelhoItem,
  TotalTipoHoraItem,
} from '../../core/models/ponto.models';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import {
  CompetenciaPickerComponent,
  CompetenciaSelecionada,
} from '../../shared/components/competencia-picker.component';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../shared/components/searchable-select.component';
import { EspelhoAbaHistoricoComponent } from './components/espelho-aba-historico.component';
import { EspelhoAbaOcorrenciasComponent } from './components/espelho-aba-ocorrencias.component';
import { EspelhoAbaSemanaComponent } from './components/espelho-aba-semana.component';
import { EspelhoAbaTotaisComponent } from './components/espelho-aba-totais.component';
import { EspelhoDetalheDrawerComponent } from './components/espelho-detalhe-drawer.component';
import { EspelhoGradeDiariaComponent } from './components/espelho-grade-diaria.component';

type EspelhoTab = 'DIAS' | 'SEMANA' | 'TOTAIS' | 'OCORRENCIAS' | 'HISTORICO';

const TAB_TO_SLUG: Record<EspelhoTab, string> = {
  DIAS: 'dias',
  SEMANA: 'semana',
  TOTAIS: 'totais',
  OCORRENCIAS: 'ocorrencias',
  HISTORICO: 'historico',
};

const SLUG_TO_TAB: Record<string, EspelhoTab> = {
  dias: 'DIAS',
  semana: 'SEMANA',
  totais: 'TOTAIS',
  ocorrencias: 'OCORRENCIAS',
  historico: 'HISTORICO',
};

@Component({
  selector: 'app-espelho-ponto',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CompetenciaPickerComponent,
    SearchableSelectComponent,
    EspelhoGradeDiariaComponent,
    EspelhoAbaSemanaComponent,
    EspelhoAbaTotaisComponent,
    EspelhoAbaOcorrenciasComponent,
    EspelhoAbaHistoricoComponent,
    EspelhoDetalheDrawerComponent,
  ],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Cabeçalho Principal -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4fb] border border-[#d6e4f5] text-[#003b80]">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-extrabold tracking-tight text-[#0f172a]">Espelho de ponto</h1>
            <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[11px] font-medium text-[#64748b]">
              <a routerLink="/home" class="hover:text-[#002f6c] transition">Início</a>
              <span>›</span>
              <span class="text-[#334155]">Espelho de ponto</span>
            </nav>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          @if (permiteConsultarTerceiros()) {
            <div class="w-64">
              <app-searchable-select
                [options]="pessoasOptions()"
                [ngModel]="pessoaSelecionada()"
                (ngModelChange)="onPessoaChange($event)"
                placeholder="Selecionar pessoa..."
                searchPlaceholder="Matrícula ou nome..."
                size="sm"
              />
            </div>
          }

          <button
            type="button"
            (click)="favoritado.set(!favoritado())"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3.5 text-xs font-semibold text-[#334155] shadow-2xs transition hover:border-[#002f6c]/40 hover:text-[#002f6c]"
          >
            <span>{{ favoritado() ? '★' : '☆' }}</span>
            <span>{{ favoritado() ? 'Favoritado' : 'Favoritar' }}</span>
          </button>
        </div>
      </div>

      <!-- Barra de Ações e Seletor de Competência -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
            <span class="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-emerald-600 text-[9px]">✓</span>
            <span>Atualizado em {{ state.espelhoAtual().ultimoRecalculo }}</span>
          </span>

          <button
            type="button"
            (click)="recalcularCompetencia()"
            [disabled]="state.execucaoEmAndamento() || state.espelhoBloqueadoParaEdicao()"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#003b80] hover:bg-[#002a5c] disabled:opacity-45 px-3.5 text-xs font-bold text-white shadow-xs transition"
            title="Sincronizar SARH e recalcular espelho da competência"
          >
            <span>↻</span>
            <span>{{ state.execucaoEmAndamento() ? 'Processando...' : 'Recalc.' }}</span>
          </button>

          <button
            type="button"
            (click)="exportarPdf()"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] px-3.5 text-xs font-semibold text-[#1e293b] shadow-2xs transition"
          >
            <svg class="h-4 w-4 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Exportar PDF</span>
          </button>
        </div>

        <app-competencia-picker
          [ano]="state.selectedCompetencia().ano"
          [mes]="state.selectedCompetencia().mes"
          (competenciaChange)="onCompetenciaChange($event)"
        />
      </div>

      <!-- Aviso de bloqueio pós-envio -->
      @if (state.espelhoBloqueadoParaEdicao()) {
        <div class="rounded-xl bg-blue-50 border border-[#002f6c]/25 px-4 py-2.5 text-xs text-[#002f6c] flex items-center justify-between">
          <span>
            <strong>Competência protegida ({{ statusCompetenciaAmigavel() }}):</strong>
            Recálculos e novas solicitações de ajuste estão bloqueados após envio para homologação.
          </span>
        </div>
      }

      <!-- 6 Cards Totalizadores -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- 1. Jornada prevista -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-start gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4fb] text-[#003b80] text-sm">📅</span>
          <div class="min-w-0">
            <span class="block text-[11px] font-medium text-[#64748b] truncate">Jornada prevista</span>
            <strong class="block text-xl font-extrabold text-[#0f172a] font-mono mt-0.5">
              {{ formatColon(state.espelhoAtual().totalPrevistoMinutos) }}
            </strong>
            <span class="block text-[10px] text-[#64748b] mt-0.5 truncate">
              {{ diasComJornadaCount() }} dias com jornada
            </span>
          </div>
        </div>

        <!-- 2. Tempo trabalhado -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-start gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 text-sm">◷</span>
          <div class="min-w-0 flex-1">
            <span class="block text-[11px] font-medium text-[#64748b] truncate">Tempo trabalhado</span>
            <strong class="block text-xl font-extrabold text-[#0f172a] font-mono mt-0.5">
              {{ formatColon(state.espelhoAtual().totalTrabalhadoMinutos) }}
            </strong>
            <div class="mt-1.5 flex items-center gap-1.5">
              <div class="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div class="h-full bg-emerald-600 rounded-full" [style.width.%]="percentualCumprido()"></div>
              </div>
              <span class="text-[10px] font-semibold text-[#64748b]">{{ percentualCumprido() }}%</span>
            </div>
          </div>
        </div>

        <!-- 3. Créditos reconhecidos -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-start gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 text-sm">▤</span>
          <div class="min-w-0">
            <span class="block text-[11px] font-medium text-[#64748b] truncate">Créditos reconhecidos</span>
            <strong class="block text-xl font-extrabold text-emerald-700 font-mono mt-0.5">
              {{ formatColon(state.espelhoAtual().totalCreditoMinutos) }}
            </strong>
            <span class="block text-[10px] text-[#64748b] mt-0.5">Saldo positivo apurado</span>
          </div>
        </div>

        <!-- 4. Débitos reconhecidos -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-start gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700 text-sm">▤</span>
          <div class="min-w-0">
            <span class="block text-[11px] font-medium text-[#64748b] truncate">Débitos reconhecidos</span>
            <strong class="block text-xl font-extrabold text-rose-700 font-mono mt-0.5">
              {{ formatColon(state.espelhoAtual().totalDebitoMinutos) }}
            </strong>
            <span class="block text-[10px] text-[#64748b] mt-0.5">Débito líquido</span>
          </div>
        </div>

        <!-- 5. Excedente elegível -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-start gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 text-sm">▥</span>
          <div class="min-w-0">
            <span class="block text-[11px] font-medium text-[#64748b] truncate">Excedente elegível</span>
            <strong class="block text-xl font-extrabold text-[#0f172a] font-mono mt-0.5">
              {{ formatColon(excedenteElegivelMinutos()) }}
            </strong>
            <span class="block text-[10px] text-[#64748b] mt-0.5 truncate">
              {{ formatColon(excedenteAutorizadoMinutos()) }} rec. • {{ formatColon(excedentePendenteMinutos()) }} pend.
            </span>
          </div>
        </div>

        <!-- 6. Saldo disponível -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-start gap-3">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eef4fb] text-[#003b80] text-sm">◧</span>
          <div class="min-w-0">
            <span class="block text-[11px] font-medium text-[#64748b] truncate">Saldo disponível</span>
            <strong class="block text-xl font-extrabold text-[#0f172a] font-mono mt-0.5">
              {{ formatColon(state.espelhoAtual().bancoComputavelMinutos, true) }}
            </strong>
            <span class="block text-[10px] text-[#64748b] mt-0.5">Competência atual</span>
          </div>
        </div>
      </div>

      <!-- Conteúdo Principal: Grade (9 cols) + Barra Lateral (3 cols) -->
      <div class="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        <!-- Coluna Esquerda: Tabs + Filtros + Grade -->
        <div class="xl:col-span-9 flex flex-col gap-3 min-w-0">
          <!-- Tabs de Visualização + Botão Filtros do Espelho -->
          <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#e2e8f0] bg-white p-1.5 shadow-2xs">
            <div class="flex flex-wrap items-center gap-1" role="tablist">
              @for (tab of viewTabs; track tab.id) {
                <button
                  type="button"
                  role="tab"
                  [attr.aria-selected]="abaAtiva() === tab.id"
                  (click)="selecionarAba(tab.id)"
                  class="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-[#003b80]/30"
                  [ngClass]="
                    abaAtiva() === tab.id
                      ? 'bg-[#eef4fb] text-[#003b80] shadow-2xs'
                      : 'text-[#64748b] hover:bg-slate-50 hover:text-[#0f172a]'
                  "
                >
                  <span>{{ tab.icone }}</span>
                  <span>{{ tab.label }}</span>
                </button>
              }
            </div>

            <div class="flex items-center gap-2 pr-1">
              @if (buscaAtiva()) {
                <span class="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-[#003b80]">
                  <span>Busca: "{{ buscaAtiva() }}"</span>
                  <button type="button" (click)="limparBuscaModal()" class="hover:text-rose-600 font-bold" aria-label="Remover busca">✕</button>
                </span>
              }
              <button
                type="button"
                (click)="abrirModalFiltros()"
                class="inline-flex h-8 items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 text-xs font-semibold text-slate-700 transition"
              >
                <span>⏷</span>
                <span>Filtros</span>
              </button>
            </div>
          </div>

          @if (abaAtiva() === 'DIAS') {
            <app-espelho-grade-diaria
              [dias]="state.espelhoAtual().dias"
              [searchTerm]="buscaAtiva()"
              [selectedDiaId]="diaSelecionado()?.id ?? null"
              [destaqueData]="destaqueData()"
              [destaqueOcorrencia]="destaqueOcorrencia()"
              (diaSelecionado)="diaSelecionado.set($event)"
            />
          } @else if (abaAtiva() === 'SEMANA') {
            <app-espelho-aba-semana
              [dias]="state.espelhoAtual().dias"
              [searchTerm]="buscaAtiva()"
              (diaSelecionado)="diaSelecionado.set($event)"
            />
          } @else if (abaAtiva() === 'TOTAIS') {
            <app-espelho-aba-totais
              [itens]="totaisPorTipoComputed()"
              [searchTerm]="buscaAtiva()"
              [previstoMinutos]="state.espelhoAtual().totalPrevistoMinutos"
              [quantidadeAjustes]="historicoAjustesComputed().length"
            />
          } @else if (abaAtiva() === 'OCORRENCIAS') {
            <app-espelho-aba-ocorrencias
              [itens]="ocorrenciasComputed()"
              [searchTerm]="buscaAtiva()"
              [diasSemOcorrencias]="diasSemOcorrenciaCount()"
              (solicitarAutorizacao)="abrirSolicitacaoPorOcorrencia($event)"
            />
          } @else {
            <app-espelho-aba-historico
              [itens]="historicoAjustesComputed()"
              [searchTerm]="buscaAtiva()"
              (novaSimilar)="abrirNovaSimilar($event)"
            />
          }
        </div>

        <!-- Coluna Direita: Painéis de Situação, Distribuição e Cumprimento -->
        <aside class="xl:col-span-3 flex flex-col gap-4">
          <!-- Card 1: Situação da competência -->
          <div class="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/70 to-white p-4 shadow-2xs">
            <div class="flex items-start gap-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white text-sm font-bold">
                ✓
              </span>
              <div>
                <span class="block text-[11px] font-semibold text-[#475569]">Situação da competência</span>
                <strong class="block text-base font-extrabold text-emerald-700 leading-tight mt-0.5">
                  {{ statusCompetenciaAmigavel() }}
                </strong>
                <span class="block text-[11px] text-[#64748b] mt-1">
                  Período: {{ periodoCompetenciaTexto() }}
                </span>
                <span class="block text-[11px] text-[#64748b]">
                  Unidade: {{ state.espelhoAtual().unidadeLabel || state.servidorLotacao() }}
                </span>
              </div>
            </div>

            @if (!state.espelhoBloqueadoParaEdicao()) {
              <button
                type="button"
                (click)="confirmarEnvioModal.set(true)"
                class="mt-4 w-full h-10 rounded-xl bg-[#003b80] hover:bg-[#002a5c] text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-2"
              >
                <span>✎</span>
                <span>Assinar e enviar para homologação</span>
              </button>
            }

            <p class="mt-3 text-[11px] leading-relaxed text-[#64748b]">
              Revise o espelho antes de enviar para homologação. Após o envio, ajustes que alterem a competência ficam restritos.
            </p>
          </div>

          <!-- Card 2: Distribuição da jornada -->
          <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
            <h3 class="text-sm font-bold text-[#0f172a]">Distribuição da jornada</h3>
            <p class="text-[11px] text-[#64748b] mt-0.5">Visualização rápida do saldo da competência.</p>

            <div class="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[#475569]">
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-[#003b80]"></span> Jornada cumprida</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-500"></span> Excedente bruto</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-300"></span> Faltantes</span>
            </div>

            <div class="mt-2.5 h-6 w-full rounded-full bg-[#e2e8f0] overflow-hidden flex text-[10px] font-bold text-white">
              <div
                class="h-full bg-[#003b80] flex items-center justify-center transition-all"
                [style.width.%]="segCumpridaPct()"
              >
                @if (segCumpridaPct() >= 15) {
                  <span>{{ percentualCumprido() }}%</span>
                }
              </div>
              @if (segExcedentePct() > 0) {
                <div class="h-full bg-amber-500 transition-all" [style.width.%]="segExcedentePct()"></div>
              }
            </div>

            <div class="mt-3 grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-2 gap-2.5 text-xs pt-2 border-t border-[#f1f5f9]">
              <div>
                <span class="block text-[10px] text-[#64748b]">Total previsto</span>
                <strong class="font-mono font-extrabold text-[#0f172a]">
                  {{ formatColon(state.espelhoAtual().totalPrevistoMinutos) }}
                </strong>
              </div>
              <div>
                <span class="block text-[10px] text-[#64748b]">Total trabalhado</span>
                <strong class="font-mono font-extrabold text-[#003b80]">
                  {{ formatColon(state.espelhoAtual().totalTrabalhadoMinutos) }}
                </strong>
              </div>
              <div>
                <span class="block text-[10px] text-[#64748b]">Excedente bruto</span>
                <strong class="font-mono font-extrabold text-amber-600">
                  {{ formatColon(excedenteElegivelMinutos()) }}
                </strong>
              </div>
              <div>
                <span class="block text-[10px] text-[#64748b]">Diferença</span>
                <strong
                  class="font-mono font-extrabold"
                  [ngClass]="diferencaMinutos() >= 0 ? 'text-emerald-700' : 'text-rose-700'"
                >
                  {{ formatColon(diferencaMinutos(), true) }}
                </strong>
              </div>
            </div>
          </div>

          <!-- Card 3: Cumprimento da jornada -->
          <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
            <h3 class="text-sm font-bold text-[#0f172a]">Cumprimento da jornada</h3>
            <p class="text-[11px] text-[#64748b] mt-0.5">Percentual quantitativo da carga exigível, não de conformidade.</p>

            <div class="mt-4 flex items-center gap-4">
              <div class="relative h-20 w-20 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 36 36" class="h-20 w-20 -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="3.5"></circle>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="#15803d"
                    stroke-width="3.5"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="donutCumprimentoDash()"
                  ></circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <strong class="text-sm font-extrabold text-[#0f172a] leading-none">{{ percentualCumprido() }}%</strong>
                  <span class="text-[8px] text-[#64748b] mt-0.5">da jornada</span>
                </div>
              </div>

              <div class="flex-1 space-y-1.5 text-xs">
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1.5 text-[#334155]">
                    <span class="h-2 w-2 rounded-full bg-emerald-600"></span> Tempo trabalhado
                  </span>
                  <strong class="font-mono text-[#0f172a]">{{ formatColon(state.espelhoAtual().totalTrabalhadoMinutos) }}</strong>
                </div>
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1.5 text-[#334155]">
                    <span class="h-2 w-2 rounded-full bg-amber-500"></span> Excedente bruto
                  </span>
                  <strong class="font-mono text-[#0f172a]">{{ formatColon(excedenteElegivelMinutos()) }}</strong>
                </div>
                <div class="flex items-center justify-between">
                  <span class="inline-flex items-center gap-1.5 text-[#334155]">
                    <span class="h-2 w-2 rounded-full bg-slate-400"></span> Faltantes
                  </span>
                  <strong class="font-mono text-[#0f172a]">{{ formatColon(faltantesMinutos()) }}</strong>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Drawer Lateral de Memória de Cálculo & Solicitação de Ajuste -->
    <app-espelho-detalhe-drawer
      [dia]="diaSelecionado()"
      [bloqueadoParaEdicao]="state.espelhoBloqueadoParaEdicao()"
      (fechar)="diaSelecionado.set(null)"
      (enviarSolicitacao)="state.registrarSolicitacaoAjuste($event)"
    />

    <!-- Modal Filtros do Espelho -->
    @if (modalFiltrosAberto()) {
      <div class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-5 py-3.5 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 class="text-sm font-bold">Filtros do espelho</h3>
            <button type="button" (click)="modalFiltrosAberto.set(false)" class="text-blue-200 hover:text-white">✕</button>
          </div>
          <div class="p-5 space-y-3 text-xs">
            <label class="block font-semibold text-slate-700">Pesquisa</label>
            <input
              type="text"
              [(ngModel)]="buscaModalInput"
              (keyup.enter)="aplicarFiltroModal()"
              [placeholder]="dicaPesquisaAba()"
              class="w-full h-9 px-3 rounded-xl border border-slate-300 outline-none focus:border-[#002f6c]"
            />
            <p class="text-[11px] text-slate-500">Ignora maiúsculas e acentos na aba atual.</p>
          </div>
          <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" (click)="limparBuscaModal()" class="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold">
              Limpar filtro
            </button>
            <button type="button" (click)="aplicarFiltroModal()" class="h-8 px-4 rounded-lg bg-[#003b80] text-white text-xs font-bold">
              Aplicar filtro
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal de Assinatura e Envio para Homologação -->
    @if (confirmarEnvioModal()) {
      <div class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-6 py-4 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 class="text-sm font-bold">Assinar e Enviar para Homologação</h3>
            <button type="button" (click)="confirmarEnvioModal.set(false)" class="text-blue-200 hover:text-white">✕</button>
          </div>
          <div class="p-6 text-xs text-slate-600 space-y-3">
            <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
              <div><strong>Órgão:</strong> {{ state.activeOrgao().sigla }}</div>
              <div><strong>Assinante:</strong> {{ state.servidorNome() }} ({{ state.servidorMatricula() }})</div>
              <div><strong>Competência:</strong> {{ state.espelhoAtual().competencia }}</div>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Cargo / Função</label>
              <select [(ngModel)]="cargoAssinatura" class="w-full h-9 px-3 rounded-xl border border-slate-300 bg-white">
                <option value="Servidor Efetivo">Servidor Efetivo</option>
                <option value="Função Comissionada (FC)">Função Comissionada (FC)</option>
                <option value="Cargo em Comissão (CJ)">Cargo em Comissão (CJ)</option>
              </select>
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Senha de assinatura</label>
              <input
                type="password"
                [(ngModel)]="senhaAssinatura"
                placeholder="Digite sua senha institucional"
                class="w-full h-9 px-3 rounded-xl border border-slate-300"
              />
            </div>
            @if (erroEnvioMsg()) {
              <p class="text-rose-700 font-semibold">{{ erroEnvioMsg() }}</p>
            }
            <p class="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Após o envio, não será possível recalcular ou enviar novas solicitações para esta competência sem devolução formal.
            </p>
          </div>
          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button type="button" (click)="confirmarEnvioModal.set(false)" class="h-9 px-4 rounded-xl border border-slate-300 bg-white text-xs font-semibold">
              Cancelar
            </button>
            <button type="button" (click)="confirmarEnvio()" class="h-9 px-4 rounded-xl bg-[#007a33] text-white text-xs font-bold">
              Confirmar Envio
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EspelhoPontoComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  readonly state = inject(SecpPontoStateService);

  readonly diaSelecionado = signal<ApuracaoDiaria | null>(null);
  readonly confirmarEnvioModal = signal<boolean>(false);
  readonly abaAtiva = signal<EspelhoTab>('DIAS');
  readonly favoritado = signal<boolean>(false);
  readonly modalFiltrosAberto = signal<boolean>(false);
  readonly buscaAtiva = signal<string>('');
  readonly destaqueData = signal<string | null>(null);
  readonly destaqueOcorrencia = signal<string | null>(null);
  readonly pessoasOptions = signal<SearchableSelectOption[]>([]);
  readonly pessoaSelecionada = signal<string>('');
  readonly erroEnvioMsg = signal<string | null>(null);

  buscaModalInput = '';
  cargoAssinatura = 'Servidor Efetivo';
  senhaAssinatura = '';

  readonly viewTabs: readonly { id: EspelhoTab; label: string; icone: string }[] = [
    { id: 'DIAS', label: 'Dias do mês', icone: '📅' },
    { id: 'SEMANA', label: 'Visualização por semana', icone: '▤' },
    { id: 'TOTAIS', label: 'Totais por tipo', icone: '≡' },
    { id: 'OCORRENCIAS', label: 'Visualização por ocorrências', icone: '⚑' },
    { id: 'HISTORICO', label: 'Histórico de ajustes', icone: '↺' },
  ];

  readonly permiteConsultarTerceiros = computed(() => {
    const cod = this.state.activePerfil().codigo;
    return cod === 'CHEFIA' || cod === 'SECAP' || cod === 'MASTER';
  });

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap;
    const abaParam = (qp.get('aba') || '').toLowerCase();
    if (abaParam && SLUG_TO_TAB[abaParam]) {
      this.abaAtiva.set(SLUG_TO_TAB[abaParam]);
    }

    this.destaqueData.set(qp.get('destaqueData'));
    this.destaqueOcorrencia.set(qp.get('destaqueOcorrencia'));

    const compParam = qp.get('competencia');
    const anoLegado = qp.get('anoReferencia');
    const mesLegado = qp.get('mesReferencia');
    if (compParam && /^\d{4}-\d{2}$/.test(compParam)) {
      const [yStr, mStr] = compParam.split('-');
      const y = Number(yStr);
      const m = Number(mStr);
      if (y >= 2020 && y <= 2035 && m >= 1 && m <= 12) {
        this.state.setCompetencia(y, m);
      }
    } else if (anoLegado && mesLegado) {
      const y = Number(anoLegado);
      const m = Number(mesLegado);
      if (y >= 2020 && y <= 2035 && m >= 1 && m <= 12) {
        this.state.setCompetencia(y, m);
      }
    }

    this.pessoaSelecionada.set(this.state.servidorMatricula());
    if (this.permiteConsultarTerceiros()) {
      this.carregarListaPessoas();
    }
    this.sincronizarUrl();
  }

  private carregarListaPessoas(): void {
    this.http
      .get<any[]>(`http://localhost:8000/api/v1/secp/ponto/real/servidores`, {
        params: { orgao: this.state.activeOrgao().sigla, limit: '100' },
      })
      .subscribe({
        next: (rows) => {
          this.pessoasOptions.set(
            (rows ?? []).map((r) => ({
              value: r.matricula,
              label: `${r.matricula} - ${r.nomeFuncional}`,
            }))
          );
        },
      });
  }

  onPessoaChange(matricula: string): void {
    if (!matricula || !this.permiteConsultarTerceiros()) return;
    this.pessoaSelecionada.set(matricula);
    this.sincronizarUrl();
  }

  selecionarAba(tab: EspelhoTab): void {
    this.abaAtiva.set(tab);
    this.sincronizarUrl();
  }

  onCompetenciaChange(sel: CompetenciaSelecionada): void {
    this.state.setCompetencia(sel.ano, sel.mes);
    this.sincronizarUrl();
  }

  private sincronizarUrl(): void {
    const { ano, mes } = this.state.selectedCompetencia();
    const comp = `${ano}-${String(mes).padStart(2, '0')}`;
    const servidorId = this.permiteConsultarTerceiros()
      ? this.pessoaSelecionada() || this.state.servidorMatricula()
      : this.state.servidorMatricula();

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        competencia: comp,
        servidorId,
        aba: TAB_TO_SLUG[this.abaAtiva()],
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  abrirModalFiltros(): void {
    this.buscaModalInput = this.buscaAtiva();
    this.modalFiltrosAberto.set(true);
  }

  aplicarFiltroModal(): void {
    this.buscaAtiva.set(this.buscaModalInput.trim());
    this.modalFiltrosAberto.set(false);
  }

  limparBuscaModal(): void {
    this.buscaModalInput = '';
    this.buscaAtiva.set('');
    this.modalFiltrosAberto.set(false);
  }

  dicaPesquisaAba(): string {
    const tab = this.abaAtiva();
    if (tab === 'DIAS' || tab === 'SEMANA') return 'Pesquisar por data, horário ou ocorrência...';
    if (tab === 'TOTAIS') return 'Pesquisar por categoria ou observação...';
    if (tab === 'OCORRENCIAS') return 'Pesquisar por tipo, data ou justificativa...';
    return 'Pesquisar por tipo de ajuste, status ou data...';
  }

  recalcularCompetencia(): void {
    this.state.sincronizarSarhERecalcular();
  }

  readonly diasComJornadaCount = computed(
    () =>
      this.state.espelhoAtual().diasComJornada ??
      this.state.espelhoAtual().dias.filter((d) => d.cargaPrevistaMinutos > 0).length
  );

  readonly excedenteAutorizadoMinutos = computed(
    () =>
      this.state.espelhoAtual().totalExcedenteAutorizadoMinutos ??
      this.state.espelhoAtual().totalCreditoMinutos
  );

  readonly excedentePendenteMinutos = computed(
    () => this.state.espelhoAtual().totalExcedentePendenteMinutos ?? 0
  );

  readonly excedenteElegivelMinutos = computed(
    () => this.excedenteAutorizadoMinutos() + this.excedentePendenteMinutos()
  );

  readonly percentualCumprido = computed(() => {
    const prev = this.state.espelhoAtual().totalPrevistoMinutos;
    const trab = this.state.espelhoAtual().totalTrabalhadoMinutos;
    if (prev <= 0) return 0;
    return Math.min(100, Math.round((trab / prev) * 100));
  });

  readonly segCumpridaPct = computed(() => {
    const prev = this.state.espelhoAtual().totalPrevistoMinutos;
    const trab = this.state.espelhoAtual().totalTrabalhadoMinutos;
    const exc = this.excedenteElegivelMinutos();
    const denom = Math.max(1, prev + exc);
    return Math.min(100, Math.round((Math.min(prev, trab) / denom) * 100));
  });

  readonly segExcedentePct = computed(() => {
    const prev = this.state.espelhoAtual().totalPrevistoMinutos;
    const exc = this.excedenteElegivelMinutos();
    const denom = Math.max(1, prev + exc);
    return Math.min(100 - this.segCumpridaPct(), Math.round((exc / denom) * 100));
  });

  readonly donutCumprimentoDash = computed(() => {
    const p = this.percentualCumprido();
    return `${p} ${100 - p}`;
  });

  readonly diferencaMinutos = computed(() => {
    const e = this.state.espelhoAtual();
    return e.totalTrabalhadoMinutos - e.totalPrevistoMinutos;
  });

  readonly faltantesMinutos = computed(() => {
    const diff =
      this.state.espelhoAtual().totalPrevistoMinutos -
      this.state.espelhoAtual().totalTrabalhadoMinutos;
    return Math.max(0, diff);
  });

  readonly statusCompetenciaAmigavel = computed(() => {
    if (this.state.espelhoAtual().statusCompetenciaLabel) {
      return this.state.espelhoAtual().statusCompetenciaLabel!;
    }
    const st = this.state.espelhoAtual().statusCompetencia;
    if (st === 'ABERTA') return 'Em andamento';
    if (st === 'ENVIADA_HOMOLOGACAO') return 'Enviado para homologação';
    if (st === 'HOMOLOGADA') return 'Homologado';
    return st;
  });

  readonly periodoCompetenciaTexto = computed(() => {
    const { ano, mes } = this.state.selectedCompetencia();
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const mStr = String(mes).padStart(2, '0');
    return `01/${mStr}/${ano} a ${String(ultimoDia).padStart(2, '0')}/${mStr}/${ano}`;
  });

  readonly totaisPorTipoComputed = computed<readonly TotalTipoHoraItem[]>(() => {
    const backend = this.state.espelhoAtual().totaisPorTipo;
    if (backend && backend.length > 0) return backend;

    const e = this.state.espelhoAtual();
    const prev = e.totalPrevistoMinutos;
    const pct = (m: number) => (prev > 0 ? Number(((Math.abs(m) / prev) * 100).toFixed(1)) : 0);
    return [
      { codigo: 'ATIVIDADES_EXTERNAS', label: 'Atividades externas', cor: '#0284c7', quantidadeRegistros: 0, totalMinutos: 0, participacaoPct: 0, saldoObservacao: 'Atividades externas' },
      { codigo: 'AUSENCIAS', label: 'Ausências', cor: '#dc2626', quantidadeRegistros: 0, totalMinutos: 0, participacaoPct: 0, saldoObservacao: 'Sem ausências' },
      { codigo: 'BANCO_HORAS', label: 'Banco de horas', cor: '#003b80', quantidadeRegistros: 0, totalMinutos: e.bancoComputavelMinutos, participacaoPct: pct(e.bancoComputavelMinutos), saldoObservacao: 'Saldo na competência' },
      { codigo: 'CREDITO', label: 'Crédito', cor: '#15803d', quantidadeRegistros: 0, totalMinutos: e.totalCreditoMinutos, participacaoPct: pct(e.totalCreditoMinutos), saldoObservacao: 'Crédito reconhecido' },
      { codigo: 'DEBITO', label: 'Débito', cor: '#e11d48', quantidadeRegistros: 0, totalMinutos: e.totalDebitoMinutos, participacaoPct: pct(e.totalDebitoMinutos), saldoObservacao: 'Débito apurado' },
      { codigo: 'EXTRAS_AUTORIZADAS', label: 'Horas extras autorizadas', cor: '#059669', quantidadeRegistros: 0, totalMinutos: this.excedenteAutorizadoMinutos(), participacaoPct: pct(this.excedenteAutorizadoMinutos()), saldoObservacao: 'Autorizadas' },
      { codigo: 'EXTRAS_NAO_AUTORIZADAS', label: 'Horas extras não autorizadas', cor: '#d97706', quantidadeRegistros: 0, totalMinutos: this.excedentePendenteMinutos(), participacaoPct: pct(this.excedentePendenteMinutos()), saldoObservacao: this.excedentePendenteMinutos() > 0 ? 'Aguardando autorização' : 'Sem pendências', aguardandoAutorizacao: this.excedentePendenteMinutos() > 0 },
      { codigo: 'JORNADA_REGULAR', label: 'Jornada regular', cor: '#1d4ed8', quantidadeRegistros: this.diasComJornadaCount(), totalMinutos: e.totalTrabalhadoMinutos, participacaoPct: pct(e.totalTrabalhadoMinutos), saldoObservacao: 'Tempo trabalhado contabilizado' },
      { codigo: 'VIAGENS', label: 'Viagens', cor: '#7c3aed', quantidadeRegistros: 0, totalMinutos: 0, participacaoPct: 0, saldoObservacao: 'Viagens a serviço' },
    ];
  });

  readonly ocorrenciasComputed = computed<readonly OcorrenciaEspelhoItem[]>(() => {
    const backend = this.state.espelhoAtual().ocorrencias;
    if (backend) return backend;
    return [];
  });

  readonly diasSemOcorrenciaCount = computed(() => {
    const total = this.state.espelhoAtual().dias.length;
    const diasComOc = new Set(this.ocorrenciasComputed().map((o) => o.dataIso)).size;
    return Math.max(0, total - diasComOc);
  });

  readonly historicoAjustesComputed = computed<readonly HistoricoAjusteItem[]>(() => {
    const backend = this.state.espelhoAtual().historicoAjustes;
    if (backend) return backend;
    return this.state.realSolicitacoes().map((s) => ({
      id: s.id,
      dataSolicitacao: s.criadoEm,
      periodo: s.dataReferencia,
      tipoAjuste: s.titulo,
      dataAfetada: s.dataReferencia,
      status: 'EM_ANALISE',
      statusLabel: s.status,
      justificativa: s.descricao,
    }));
  });

  abrirSolicitacaoPorOcorrencia(oc: OcorrenciaEspelhoItem): void {
    const dia = this.state.espelhoAtual().dias.find((d) => d.dataIso === oc.dataIso);
    if (dia) {
      this.diaSelecionado.set(dia);
    }
  }

  abrirNovaSimilar(item: HistoricoAjusteItem): void {
    const dia = this.state.espelhoAtual().dias.find((d) => d.dataFormatada === item.dataAfetada);
    if (dia) {
      this.diaSelecionado.set(dia);
    } else if (this.state.espelhoAtual().dias.length > 0) {
      this.diaSelecionado.set(this.state.espelhoAtual().dias[0]);
    }
  }

  formatColon(min: number, comSinal = false): string {
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!comSinal || min === 0) return base;
    return min > 0 ? `+${base}` : `-${base}`;
  }

  exportarPdf(): void {
    const espelho = this.state.espelhoAtual();
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFontSize(13);
    doc.setTextColor(0, 47, 108);
    doc.text('PODER JUDICIÁRIO • CONTROLE DE FREQUÊNCIA (SECP)', 14, 14);
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(
      `Competência: ${espelho.competencia} | Órgão: ${this.state.activeOrgao().sigla} | Unidade: ${espelho.unidadeLabel || this.state.servidorLotacao()}`,
      14,
      20
    );
    doc.text(
      `Servidor: ${this.state.servidorNome()} (${this.state.servidorMatricula()}) | Previsto: ${this.formatColon(espelho.totalPrevistoMinutos)} | Trabalhado: ${this.formatColon(espelho.totalTrabalhadoMinutos)}`,
      14,
      25
    );

    autoTable(doc, {
      startY: 30,
      head: [['Dia', '1ª Ent.', '1ª Saí.', '2ª Ent.', '2ª Saí.', 'H. Normais', 'H. Almoço', 'H. Trab.', 'Status']],
      body: espelho.dias.map((d) => {
        const diaLabel = `${d.dataFormatada.slice(0, 5)} ${d.diaSemana.slice(0, 3)}`;
        const ehEspecialSemBatida = d.marcacoes.length === 0 && Boolean(d.eventoInstitucional);
        if (ehEspecialSemBatida) {
          return [
            diaLabel,
            { content: d.eventoInstitucional!, colSpan: 4, styles: { halign: 'center', fontStyle: 'italic' } },
            this.formatColon(d.cargaPrevistaMinutos),
            this.formatColon(d.intervaloMinutos ?? 0),
            this.formatColon(d.trabalhadoMinutos),
            d.statusLabel,
          ];
        }
        return [
          diaLabel,
          d.marcacoes[0]?.horario?.slice(0, 5) ?? '-',
          d.marcacoes[1]?.horario?.slice(0, 5) ?? '-',
          d.marcacoes[2]?.horario?.slice(0, 5) ?? '-',
          d.marcacoes[3]?.horario?.slice(0, 5) ?? '-',
          this.formatColon(d.cargaPrevistaMinutos),
          this.formatColon(d.intervaloMinutos ?? d.memoriaCalculo.intervaloRealizadoMinutos ?? 0),
          this.formatColon(d.trabalhadoMinutos),
          d.eventoInstitucional || d.statusLabel,
        ];
      }),
      styles: { fontSize: 7.5, cellPadding: 1.5 },
      headStyles: { fillColor: [0, 47, 108] },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : 260;
    doc.setFontSize(8);
    doc.text('Visto do Servidor: ___________________________    Visto da Chefia: ___________________________', 14, Math.min(278, finalY));
    doc.save(`espelho-ponto-${espelho.competencia.replace('/', '-')}.pdf`);
  }

  confirmarEnvio(): void {
    if (!this.senhaAssinatura.trim()) {
      this.erroEnvioMsg.set('Informe sua senha institucional para assinar.');
      return;
    }
    this.erroEnvioMsg.set(null);
    this.confirmarEnvioModal.set(false);
    this.senhaAssinatura = '';
    this.state.enviarParaHomologacao();
  }
}
