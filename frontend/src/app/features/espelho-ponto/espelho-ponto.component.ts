import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApuracaoDiaria } from '../../core/models/ponto.models';
import {
  formatarMinutos,
  SecpPontoStateService,
} from '../../core/services/secp-ponto-state.service';
import { EspelhoDetalheDrawerComponent } from './components/espelho-detalhe-drawer.component';
import { EspelhoGradeDiariaComponent } from './components/espelho-grade-diaria.component';

@Component({
  selector: 'app-espelho-ponto',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    EspelhoGradeDiariaComponent,
    EspelhoDetalheDrawerComponent,
  ],
  template: `
    <div class="max-w-6xl mx-auto flex flex-col gap-6">
      <!-- Breadcrumb funcional -->
      <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[11px] font-semibold text-[#97999b] -mb-3">
        <a routerLink="/home" class="hover:text-[#002f6c] hover:underline transition">Início</a>
        <span>›</span>
        <a routerLink="/secao/meu-ponto" class="hover:text-[#002f6c] hover:underline transition">Meu Ponto</a>
        <span>›</span>
        <span class="text-[#002f6c]">Meu Espelho de Ponto</span>
      </nav>

      <!-- Cabeçalho da Competência -->
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold uppercase tracking-wider text-[#007a33]">
              Apuração &amp; Espelho de Ponto • {{ state.activeOrgao().unidadeLabel }}
            </span>
            <span
              class="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase"
              [ngClass]="{
                'bg-blue-100 text-[#002f6c]': state.espelhoAtual().statusCompetencia === 'ABERTA',
                'bg-amber-100 text-amber-800': state.espelhoAtual().statusCompetencia === 'SINCRONIZANDO' || state.espelhoAtual().statusCompetencia === 'RECALCULANDO',
                'bg-indigo-100 text-indigo-800': state.espelhoAtual().statusCompetencia === 'ENVIADA_HOMOLOGACAO',
                'bg-emerald-100 text-[#007a33]': state.espelhoAtual().statusCompetencia === 'HOMOLOGADA'
              }"
            >
              {{ state.espelhoAtual().statusCompetencia }}
            </span>
          </div>

          <h1 class="text-2xl font-bold text-[#002f6c] tracking-tight mt-0.5">
            Espelho de Ponto — {{ state.espelhoAtual().competenciaLabel }}
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Última sinc. SARH: <strong>{{ state.espelhoAtual().ultimaSincronizacaoSarh }}</strong> •
            Último recálculo: <strong>{{ state.espelhoAtual().ultimoRecalculo }}</strong>
          </p>
        </div>

        <!-- Navegação Mensal + Sincronizar SARH/Recalcular + Enviar p/ Homologação -->
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex rounded-xl border border-slate-300 bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              (click)="state.navegarCompetencia(-1)"
              [disabled]="state.competenciaIndex() === 0"
              class="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              &larr; Competência anterior
            </button>
            <span class="px-3 py-2 text-xs font-mono font-bold text-[#002f6c] bg-slate-50 border-x border-slate-200">
              {{ state.espelhoAtual().competencia }}
            </span>
            <button
              type="button"
              (click)="state.navegarCompetencia(1)"
              [disabled]="state.competenciaIndex() === 1"
              class="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              Próxima competência &rarr;
            </button>
          </div>

          <button
            type="button"
            (click)="state.sincronizarSarhERecalcular()"
            [disabled]="state.execucaoEmAndamento() || state.espelhoBloqueadoParaEdicao()"
            class="h-9 px-3.5 rounded-xl border border-[#002f6c] bg-white hover:bg-blue-50 disabled:opacity-45 text-[#002f6c] text-xs font-bold shadow-sm transition"
            title="Executa na ordem obrigatória: 1) Sincronizar SARH -> 2) Recalcular espelho (Seção 7.5)"
          >
            @if (state.execucaoEmAndamento()) {
              <span>⏳ Processando ({{ state.espelhoAtual().statusCompetencia }})...</span>
            } @else {
              <span>↻ Sincronizar SARH + Recalcular</span>
            }
          </button>

          @if (!state.espelhoBloqueadoParaEdicao()) {
            <button
              type="button"
              (click)="confirmarEnvioModal.set(true)"
              class="h-9 px-4 rounded-xl bg-[#007a33] hover:bg-[#005e27] text-white text-xs font-bold shadow-sm transition"
            >
              Enviar para Homologação
            </button>
          }
        </div>
      </div>

      <!-- Aviso de bloqueio pós-envio (Seção 7.5) -->
      @if (state.espelhoBloqueadoParaEdicao()) {
        <div class="rounded-xl bg-blue-50 border border-[#002f6c]/25 px-4 py-3 text-xs text-[#002f6c] flex items-center justify-between">
          <span>
            <strong>Competência protegida ({{ state.espelhoAtual().statusCompetencia }}):</strong>
            Recálculos e novas solicitações de ajuste estão bloqueados conforme Seção 7.5.
          </span>
        </div>
      }

      <!-- 6 Cards Totalizadores da Competência -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div class="card-surface bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span class="text-[11px] font-medium text-[#97999b] block">Previsto</span>
          <strong class="text-xl font-bold text-slate-900 mt-1 block">
            {{ formatMin(state.espelhoAtual().totalPrevistoMinutos) }}
          </strong>
        </div>

        <div class="card-surface bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span class="text-[11px] font-medium text-[#97999b] block">Trabalhado</span>
          <strong class="text-xl font-bold text-[#002f6c] mt-1 block">
            {{ formatMin(state.espelhoAtual().totalTrabalhadoMinutos) }}
          </strong>
        </div>

        <div class="card-surface bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span class="text-[11px] font-medium text-[#97999b] block">Crédito</span>
          <strong class="text-xl font-bold text-[#007a33] mt-1 block">
            {{ formatMin(state.espelhoAtual().totalCreditoMinutos, true) }}
          </strong>
        </div>

        <div class="card-surface bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span class="text-[11px] font-medium text-[#97999b] block">Débito</span>
          <strong class="text-xl font-bold text-rose-600 mt-1 block">
            {{ formatMin(-state.espelhoAtual().totalDebitoMinutos, true) }}
          </strong>
        </div>

        <div class="card-surface bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span class="text-[11px] font-medium text-[#97999b] block">Banco Computável</span>
          <strong class="text-xl font-bold text-[#007a33] mt-1 block">
            {{ formatMin(state.espelhoAtual().bancoComputavelMinutos, true) }}
          </strong>
        </div>

        <div class="card-surface bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <span class="text-[11px] font-medium text-[#97999b] block">Faltas / Inconsist.</span>
          <strong
            class="text-xl font-bold mt-1 block"
            [ngClass]="state.espelhoAtual().faltasOuInconsistencias > 0 ? 'text-amber-600' : 'text-[#007a33]'"
          >
            {{ state.espelhoAtual().faltasOuInconsistencias }}
          </strong>
        </div>
      </div>

      <!-- Grade Diária com Filtros e Proveniência -->
      <app-espelho-grade-diaria
        [dias]="state.espelhoAtual().dias"
        [selectedDiaId]="diaSelecionado()?.id ?? null"
        (diaSelecionado)="diaSelecionado.set($event)"
      />
    </div>

    <!-- Drawer Lateral de Memória de Cálculo & Solicitação de Ajuste -->
    <app-espelho-detalhe-drawer
      [dia]="diaSelecionado()"
      [bloqueadoParaEdicao]="state.espelhoBloqueadoParaEdicao()"
      (fechar)="diaSelecionado.set(null)"
      (enviarSolicitacao)="state.registrarSolicitacaoAjuste($event)"
    />

    <!-- Modal de Confirmação de Envio para Homologação -->
    @if (confirmarEnvioModal()) {
      <div class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-6 py-4 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 class="text-sm font-bold">Confirmar Envio para Homologação</h3>
            <button type="button" (click)="confirmarEnvioModal.set(false)" class="text-blue-200 hover:text-white">✕</button>
          </div>
          <div class="p-6 text-xs text-slate-600 leading-relaxed">
            <p>
              Você está prestes a enviar o espelho de ponto da competência
              <strong class="text-slate-900">{{ state.espelhoAtual().competencia }}</strong> para análise e homologação da chefia.
            </p>
            <p class="mt-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Após o envio, não será possível recalcular ou enviar novas solicitações de ajuste para esta competência sem devolução formal (Seção 7.5).
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
export class EspelhoPontoComponent {
  readonly state = inject(SecpPontoStateService);
  readonly diaSelecionado = signal<ApuracaoDiaria | null>(null);
  readonly confirmarEnvioModal = signal<boolean>(false);

  formatMin(min: number, comSinal = false): string {
    return formatarMinutos(min, comSinal);
  }

  confirmarEnvio(): void {
    this.confirmarEnvioModal.set(false);
    this.state.enviarParaHomologacao();
  }
}
