import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import {
  ApuracaoDiaria,
  MarcacaoBruta,
  OrigemMarcacaoIcone,
  StatusApuracaoDia,
} from '../../../core/models/ponto.models';
import { formatarMinutos } from '../../../core/services/secp-ponto-state.service';

@Component({
  selector: 'app-espelho-grade-diaria',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs overflow-hidden">
      <!-- Barra de Filtros -->
      <div class="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2.5">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center gap-1.5 text-xs font-bold text-[#334155] mr-1">
            <svg class="h-3.5 w-3.5 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filtros
          </span>

          @for (f of filtros; track f.valor) {
            <button
              type="button"
              (click)="filtroAtivo.set(f.valor)"
              class="px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors"
              [ngClass]="
                filtroAtivo() === f.valor
                  ? 'bg-[#002f6c] text-white shadow-2xs'
                  : 'bg-white text-[#475569] border border-[#e2e8f0] hover:bg-slate-100'
              "
            >
              {{ f.label }}
            </button>
          }
        </div>

        <span class="text-[11px] font-semibold text-[#64748b]">
          1–{{ diasFiltrados().length }} de {{ totalDias() }}
        </span>
      </div>

      <!-- Tabela Diária com Cabeçalhos Agrupados -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <!-- Linha 1: Grupos -->
            <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
              <th rowspan="2" class="py-2.5 px-3 text-center w-12">SIT.</th>
              <th
                rowspan="2"
                (click)="alternarOrdenacao('data')"
                class="py-2.5 px-3 cursor-pointer select-none hover:text-[#002f6c] whitespace-nowrap"
              >
                DATA <span class="text-[9px]">{{ sortBy() === 'data' ? (sortDir() === 'asc' ? '▲' : '▼') : '⇅' }}</span>
              </th>
              <th rowspan="2" class="py-2.5 px-3 min-w-[200px]">
                <div class="flex items-center justify-between gap-3">
                  <span>MARCAÇÕES DO DIA</span>
                  <label class="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold normal-case text-[11px] text-[#475569]">
                    <input
                      type="checkbox"
                      [checked]="exibirOrigem()"
                      (change)="exibirOrigem.set(!exibirOrigem())"
                      class="sr-only"
                    />
                    <span
                      class="relative inline-flex h-4 w-7 items-center rounded-full transition-colors"
                      [ngClass]="exibirOrigem() ? 'bg-[#002f6c]' : 'bg-slate-300'"
                    >
                      <span
                        class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform"
                        [ngClass]="exibirOrigem() ? 'translate-x-3.5' : 'translate-x-0.5'"
                      ></span>
                    </span>
                    <span>Exibir origem</span>
                  </label>
                </div>
              </th>
              <th colspan="3" class="py-1.5 px-2 text-center border-x border-[#e2e8f0]">
                <span class="inline-block rounded-full bg-[#e2e8f0]/70 px-3 py-0.5 text-[#334155]">
                  RELÓGIO DE JORNADA
                </span>
              </th>
              <th colspan="3" class="py-1.5 px-2 text-center border-r border-[#e2e8f0]">
                <span class="inline-block rounded-full bg-emerald-100/80 px-3 py-0.5 text-emerald-800">
                  RESULTADOS RECONHECIDOS
                </span>
              </th>
              <th colspan="2" class="py-1.5 px-2 text-center border-r border-[#e2e8f0]">
                <span class="inline-block rounded-full bg-amber-100/80 px-3 py-0.5 text-amber-800">
                  EXCEDENTES
                </span>
              </th>
              <th
                rowspan="2"
                (click)="alternarOrdenacao('situacao')"
                class="py-2.5 px-3 cursor-pointer select-none hover:text-[#002f6c]"
              >
                OCORRÊNCIAS
              </th>
              <th rowspan="2" class="py-2.5 px-2 w-10 sticky right-0 bg-[#f8fafc] border-l border-[#e2e8f0] text-center">AÇÕES</th>
            </tr>

            <!-- Linha 2: Subcolunas -->
            <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              <th
                (click)="alternarOrdenacao('prevista')"
                class="py-2 px-2.5 text-center border-l border-[#e2e8f0] cursor-pointer hover:text-[#002f6c]"
              >
                EXIGÍVEL
              </th>
              <th class="py-2 px-2.5 text-center">INTERVALO</th>
              <th
                (click)="alternarOrdenacao('trabalhado')"
                class="py-2 px-2.5 text-center border-r border-[#e2e8f0] cursor-pointer hover:text-[#002f6c]"
              >
                COMPUTÁVEL
              </th>
              <th class="py-2 px-2.5 text-center text-emerald-700">CRÉDITO</th>
              <th class="py-2 px-2.5 text-center text-rose-700">DÉBITO</th>
              <th
                (click)="alternarOrdenacao('saldo')"
                class="py-2 px-2.5 text-center border-r border-[#e2e8f0] cursor-pointer hover:text-[#002f6c]"
              >
                SALDO
              </th>
              <th class="py-2 px-2.5 text-center">AUTORIZADO</th>
              <th class="py-2 px-2.5 text-center border-r border-[#e2e8f0]">PENDENTE</th>
            </tr>
          </thead>

          <tbody class="divide-y divide-[#f1f5f9] text-xs text-[#334155]">
            @for (dia of diasFiltrados(); track dia.id) {
              @let saldoDia = dia.creditoMinutos - dia.debitoMinutos;
              <tr
                (click)="diaSelecionado.emit(dia)"
                class="hover:bg-[#f0f7ff]/70 cursor-pointer transition-colors"
                [ngClass]="{
                  'bg-[#e6f0ff]': selectedDiaId === dia.id,
                  'ring-2 ring-inset ring-amber-400 bg-amber-50/50': isDiaDestacado(dia)
                }"
              >
                <!-- SIT. -->
                <td class="py-2.5 px-3 text-center">
                  @if (dia.conferenciaStatus === 'AGUARDANDO') {
                    <span
                      class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500 text-amber-600 text-[10px] font-bold"
                      [title]="dia.statusLabel + ' — ' + dia.memoriaCalculo.regraPortaria"
                    >
                      ◷
                      <span class="sr-only">Aguardando: {{ dia.statusLabel }}</span>
                    </span>
                  } @else if (dia.status === 'REGULAR' || dia.status === 'CREDITO' || dia.status === 'ABONADA_FERIAS_RECESSO') {
                    <span
                      class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500 text-emerald-600 text-[10px] font-bold"
                      [title]="dia.statusLabel + ' — ' + dia.memoriaCalculo.regraPortaria"
                    >
                      ✓
                      <span class="sr-only">Regular: {{ dia.statusLabel }}</span>
                    </span>
                  } @else if (dia.status === 'INCOMPLETA') {
                    <span
                      class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500 text-amber-600 text-[10px] font-bold"
                      [title]="dia.statusLabel + ' — ' + dia.memoriaCalculo.regraPortaria"
                    >
                      !
                      <span class="sr-only">Inconsistente: {{ dia.statusLabel }}</span>
                    </span>
                  } @else {
                    <span
                      class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-500 text-rose-600 text-[10px] font-bold"
                      [title]="dia.statusLabel + ' — ' + dia.memoriaCalculo.regraPortaria"
                    >
                      ✕
                      <span class="sr-only">Débito/Alerta: {{ dia.statusLabel }}</span>
                    </span>
                  }
                </td>

                <!-- DATA -->
                <td class="py-2.5 px-3 whitespace-nowrap font-medium text-[#0f172a]">
                  <span>{{ dia.dataFormatada | slice:0:5 }}</span>
                  <span class="text-[#64748b]"> - {{ dia.diaSemana | slice:0:3 }}</span>
                </td>

                <!-- MARCAÇÕES DO DIA -->
                <td class="py-2.5 px-3">
                  @if (dia.marcacoes.length === 0) {
                    <span class="text-[#94a3b8]">-</span>
                  } @else {
                    <div class="flex flex-wrap items-center gap-1">
                      @for (m of dia.marcacoes.slice(0, 8); track m.id; let last = $last) {
                        <span
                          (mouseenter)="abrirHint($event, m)"
                          (mouseleave)="fecharHint()"
                          (focus)="abrirHint($event, m)"
                          (blur)="fecharHint()"
                          tabindex="0"
                          class="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#0f172a] transition-colors"
                          [ngClass]="exibirOrigem() ? 'hover:bg-blue-50 hover:border-blue-300 cursor-help' : ''"
                        >
                          {{ m.horario | slice:0:5 }}{{ m.ajustada ? '*' : '' }}
                          @if (exibirOrigem()) {
                            @let icone = resolverIconeOrigem(m);
                            <span
                              class="inline-flex items-center justify-center rounded p-0.5"
                              [title]="labelOrigem(m)"
                              [attr.aria-label]="labelOrigem(m)"
                              [ngClass]="{
                                'bg-blue-100 text-[#002f6c]': icone === 'relogio',
                                'bg-emerald-100 text-[#007a33]': icone === 'facial',
                                'bg-amber-100 text-amber-800': icone === 'computador',
                                'bg-violet-100 text-violet-800': icone === 'celular',
                                'bg-rose-100 text-rose-700': icone === 'ajuste',
                                'bg-indigo-100 text-indigo-800': icone === 'afd'
                              }"
                            >
                              @switch (icone) {
                                @case ('facial') {
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                }
                                @case ('computador') {
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                }
                                @case ('celular') {
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                  </svg>
                                }
                                @case ('ajuste') {
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                }
                                @case ('afd') {
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                  </svg>
                                }
                                @default {
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                }
                              }
                            </span>
                          }
                        </span>
                      }
                      @if (dia.marcacoes.length > 8) {
                        <span
                          class="inline-flex items-center rounded-md bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700"
                          [title]="'Mais ' + (dia.marcacoes.length - 8) + ' marcações no dia'"
                        >
                          +{{ dia.marcacoes.length - 8 }}
                        </span>
                      }
                    </div>
                  }
                </td>

                <!-- RELÓGIO DE JORNADA -->
                <td class="py-2.5 px-2.5 text-center font-mono border-l border-[#f1f5f9]">
                  {{ formatColon(dia.cargaPrevistaMinutos) }}
                </td>
                <td class="py-2.5 px-2.5 text-center font-mono text-[#94a3b8]">
                  {{ formatColon(dia.intervaloMinutos ?? dia.memoriaCalculo.intervaloRealizadoMinutos ?? 0) }}
                </td>
                <td class="py-2.5 px-2.5 text-center font-mono font-semibold text-[#0f172a] border-r border-[#f1f5f9]">
                  {{ formatColon(dia.trabalhadoMinutos) }}
                </td>

                <!-- RESULTADOS RECONHECIDOS -->
                <td class="py-2.5 px-2.5 text-center font-mono font-semibold text-emerald-700">
                  {{ formatColon(dia.creditoMinutos) }}
                </td>
                <td class="py-2.5 px-2.5 text-center font-mono font-semibold text-rose-700">
                  {{ formatColon(dia.debitoMinutos) }}
                </td>
                <td
                  class="py-2.5 px-2.5 text-center font-mono font-semibold border-r border-[#f1f5f9]"
                  [ngClass]="saldoDia > 0 ? 'text-emerald-700' : saldoDia < 0 ? 'text-rose-700' : 'text-[#64748b]'"
                >
                  {{ formatColon(saldoDia, true) }}
                </td>

                <!-- EXCEDENTES -->
                <td class="py-2.5 px-2.5 text-center font-mono text-[#64748b]">
                  {{ formatColon(dia.excedenteAutorizadoMinutos ?? dia.creditoMinutos) }}
                </td>
                <td class="py-2.5 px-2.5 text-center font-mono text-amber-700 border-r border-[#f1f5f9]">
                  {{ formatColon(dia.excedentePendenteMinutos ?? 0) }}
                </td>

                <!-- OCORRÊNCIAS -->
                <td class="py-2.5 px-3">
                  @if (dia.eventoInstitucional) {
                    <span class="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0369a1]">
                      {{ dia.eventoInstitucional }}
                    </span>
                  } @else {
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                      [ngClass]="{
                        'bg-emerald-50 text-emerald-700 border border-emerald-200': dia.status === 'REGULAR' || dia.status === 'CREDITO',
                        'bg-rose-50 text-rose-700 border border-rose-200': dia.status === 'DEBITO',
                        'bg-amber-50 text-amber-700 border border-amber-200': dia.status === 'INCOMPLETA',
                        'bg-sky-50 text-sky-700 border border-sky-200': dia.status === 'ABONADA_FERIAS_RECESSO'
                      }"
                    >
                      {{ dia.statusLabel }}
                    </span>
                  }
                </td>

                <!-- AÇÃO -->
                <td class="py-2.5 px-2 text-center sticky right-0 bg-white border-l border-[#f1f5f9]">
                  <button
                    type="button"
                    (click)="$event.stopPropagation(); diaSelecionado.emit(dia)"
                    title="Abrir ações e análise da jornada"
                    aria-label="Abrir ações e análise da jornada"
                    class="rounded-lg p-1 text-[#64748b] hover:bg-slate-200/70 hover:text-[#002f6c]"
                  >
                    ⋮
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="13" class="py-10 text-center text-xs text-[#64748b]">
                  Nenhum registro diário encontrado para os filtros atuais.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    <!-- Hint flutuante de Origem da Marcação (exibido somente quando 'Exibir origem' está marcado) -->
    @if (exibirOrigem() && hintMarcacao(); as hm) {
      @let hintIcone = resolverIconeOrigem(hm);
      <div
        class="fixed z-50 pointer-events-none w-[315px] rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_14px_34px_-8px_rgba(15,23,42,0.22)]"
        [style.left.px]="hintPos().x"
        [style.top.px]="hintPos().y"
      >
        <div class="flex items-start gap-3">
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            [ngClass]="{
              'bg-blue-50 text-blue-600': hintIcone === 'relogio',
              'bg-emerald-50 text-emerald-600': hintIcone === 'facial',
              'bg-amber-50 text-amber-600': hintIcone === 'computador',
              'bg-violet-50 text-violet-600': hintIcone === 'celular',
              'bg-rose-50 text-rose-600': hintIcone === 'ajuste',
              'bg-indigo-50 text-indigo-600': hintIcone === 'afd'
            }"
          >
            @switch (hintIcone) {
              @case ('facial') {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              @case ('computador') {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              }
              @case ('celular') {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }
              @case ('ajuste') {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              }
              @case ('afd') {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              }
              @default {
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            }
          </div>
          <div class="min-w-0">
            <div class="text-xs font-medium text-slate-500">
              Marcação às {{ hm.horario | slice:0:5 }} · {{ labelOrigem(hm) }}
            </div>
            <div class="text-sm font-bold text-slate-900 leading-snug mt-0.5">
              {{ hm.equipamentoOuOrigem || hm.fonte }}
            </div>
          </div>
        </div>

        <div class="my-3 border-t border-slate-200/80"></div>

        <div class="space-y-2 text-xs">
          <div class="flex items-start gap-2.5">
            <div class="flex items-center gap-1.5 text-slate-500 w-24 shrink-0">
              <svg class="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Localização</span>
            </div>
            <div class="font-medium text-slate-900 leading-snug">
              {{ hm.localizacao || fallbackLocalizacao(hm) }}
            </div>
          </div>

          <div class="flex items-center gap-2.5">
            <div class="flex items-center gap-1.5 text-slate-500 w-24 shrink-0">
              <svg class="h-4 w-4 shrink-0 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span>Tipo</span>
            </div>
            <div class="font-medium text-slate-900">
              {{ formatarTipo(hm.tipoClassificado) }}
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class EspelhoGradeDiariaComponent {
  private readonly _dias = signal<readonly ApuracaoDiaria[]>([]);
  private readonly _search = signal<string>('');
  @Input() set dias(value: readonly ApuracaoDiaria[]) {
    this._dias.set(value ?? []);
  }
  @Input() set searchTerm(value: string) {
    this._search.set(value ?? '');
  }
  @Input() selectedDiaId: string | null = null;
  @Input() destaqueData: string | null = null;
  @Input() destaqueOcorrencia: string | null = null;
  @Output() diaSelecionado = new EventEmitter<ApuracaoDiaria>();

  readonly exibirOrigem = signal<boolean>(false);
  readonly hintMarcacao = signal<MarcacaoBruta | null>(null);
  readonly hintPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly filtroAtivo = signal<'TODOS' | StatusApuracaoDia>('TODOS');
  readonly sortBy = signal<'data' | 'prevista' | 'trabalhado' | 'saldo' | 'situacao' | ''>('');
  readonly sortDir = signal<'asc' | 'desc'>('asc');

  readonly filtros: readonly { valor: 'TODOS' | StatusApuracaoDia; label: string }[] = [
    { valor: 'TODOS', label: 'Todos os dias' },
    { valor: 'REGULAR', label: 'Regular' },
    { valor: 'CREDITO', label: 'Com Crédito' },
    { valor: 'DEBITO', label: 'Com Débito' },
    { valor: 'INCOMPLETA', label: 'Incompleta' },
    { valor: 'ABONADA_FERIAS_RECESSO', label: 'Abonada / Férias / Recesso' },
  ];

  readonly totalDias = computed(() => this._dias().length);

  readonly diasFiltrados = computed(() => {
    const f = this.filtroAtivo();
    const list = this._dias();
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const q = norm(this._search().trim());
    let filtered = f === 'TODOS' ? [...list] : list.filter((d) => d.status === f);
    if (q) {
      filtered = filtered.filter((d) =>
        norm(
          `${d.dataFormatada} ${d.diaSemana} ${d.statusLabel} ${d.eventoInstitucional ?? ''} ${d.marcacoes.map((m) => m.horario).join(' ')}`
        ).includes(q)
      );
    }
    const col = this.sortBy();
    if (!col) {
      return filtered;
    }
    const mult = this.sortDir() === 'asc' ? 1 : -1;
    return filtered.sort((a, b) => {
      if (col === 'data') return a.dataIso.localeCompare(b.dataIso) * mult;
      if (col === 'prevista') return (a.cargaPrevistaMinutos - b.cargaPrevistaMinutos) * mult;
      if (col === 'trabalhado') return (a.trabalhadoMinutos - b.trabalhadoMinutos) * mult;
      if (col === 'saldo') {
        const sa = a.creditoMinutos - a.debitoMinutos;
        const sb = b.creditoMinutos - b.debitoMinutos;
        return (sa - sb) * mult;
      }
      return a.statusLabel.localeCompare(b.statusLabel) * mult;
    });
  });

  alternarOrdenacao(col: 'data' | 'prevista' | 'trabalhado' | 'saldo' | 'situacao'): void {
    if (this.sortBy() === col) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(col);
      this.sortDir.set('asc');
    }
  }

  formatMin(min: number, comSinal = false): string {
    return formatarMinutos(min, comSinal);
  }

  formatColon(min: number, comSinal = false): string {
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!comSinal || min === 0) return base;
    return min > 0 ? `+${base}` : `-${base}`;
  }

  isDiaDestacado(dia: ApuracaoDiaria): boolean {
    if (this.destaqueData && dia.dataIso === this.destaqueData) {
      return true;
    }
    if (
      this.destaqueOcorrencia &&
      `${dia.statusLabel} ${dia.eventoInstitucional ?? ''}`
        .toLowerCase()
        .includes(this.destaqueOcorrencia.toLowerCase())
    ) {
      return true;
    }
    return false;
  }

  abrirHint(event: Event, marcacao: MarcacaoBruta): void {
    if (!this.exibirOrigem()) {
      return;
    }
    const target = event.currentTarget as HTMLElement | null;
    if (target) {
      const rect = target.getBoundingClientRect();
      const cardWidth = 315;
      const x = Math.min(rect.left, window.innerWidth - cardWidth - 16);
      const y = rect.bottom + 8;
      this.hintPos.set({ x: Math.max(12, x), y });
    }
    this.hintMarcacao.set(marcacao);
  }

  fecharHint(): void {
    this.hintMarcacao.set(null);
  }

  resolverIconeOrigem(m: MarcacaoBruta): OrigemMarcacaoIcone {
    if (m.origemIcone) {
      return m.origemIcone;
    }
    const combined = `${m.fonte ?? ''} ${m.equipamentoOuOrigem ?? ''} ${m.tipoClassificado ?? ''}`.toUpperCase();
    if (m.tipoClassificado === 'MANUAL' || combined.includes('AJUSTE') || combined.includes('MANUAL') || combined.includes('ADMIN')) {
      return 'ajuste';
    }
    if (combined.includes('SMARTPHONE') || combined.includes('MOBILE') || combined.includes('CELULAR') || combined.includes('ANDROID') || combined.includes('IOS') || combined.includes('APP')) {
      return 'celular';
    }
    if (m.fonte === 'FACIAL' || combined.includes('FACIAL') || combined.includes('FACE') || combined.includes('TOTEM')) {
      return 'facial';
    }
    if (m.fonte === 'WEB' || combined.includes('WEB') || combined.includes('PORTAL')) {
      return 'computador';
    }
    if (m.fonte === 'AFD' || combined.includes('AFD')) {
      return 'afd';
    }
    return 'relogio';
  }

  labelOrigem(m: MarcacaoBruta): string {
    if (m.tipoEquipamentoNome) {
      return m.tipoEquipamentoNome;
    }
    const map: Record<OrigemMarcacaoIcone, string> = {
      facial: 'Biometria Facial',
      relogio: 'Relógio de Ponto (REP)',
      computador: 'Sistema Web',
      celular: 'Smartphone',
      ajuste: 'Ajuste Administrativo',
      afd: 'Importação AFD',
    };
    return map[this.resolverIconeOrigem(m)];
  }

  fallbackLocalizacao(m: MarcacaoBruta): string {
    if (m.fonte === 'FACIAL') return 'Biometria Facial Web';
    if (m.fonte === 'WEB') return 'Portal Web Institucional';
    return 'Unidade Judiciária';
  }

  formatarTipo(tipo: MarcacaoBruta['tipoClassificado']): string {
    const map: Record<MarcacaoBruta['tipoClassificado'], string> = {
      ENTRADA: 'Entrada',
      SAIDA_INTERVALO: 'Saída Intervalo',
      RETORNO_INTERVALO: 'Retorno Intervalo',
      SAIDA: 'Saída',
      MANUAL: 'Manual',
    };
    return map[tipo] ?? tipo;
  }
}
