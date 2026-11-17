import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  formatarMinutos,
  SecpPontoStateService,
} from '../../core/services/secp-ponto-state.service';
import { TimelineMarcacoesComponent } from './components/timeline-marcacoes.component';

@Component({
  selector: 'app-dashboard-servidor',
  standalone: true,
  imports: [CommonModule, RouterLink, TimelineMarcacoesComponent],
  template: `
    <div class="max-w-6xl mx-auto flex flex-col gap-6">
      <!-- Breadcrumb funcional -->
      <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[11px] font-semibold text-[#97999b] -mb-3">
        <a routerLink="/home" class="hover:text-[#002f6c] hover:underline transition">Início</a>
        <span>›</span>
        <a routerLink="/secao/meu-ponto" class="hover:text-[#002f6c] hover:underline transition">Meu Ponto</a>
        <span>›</span>
        <span class="text-[#002f6c]">Dashboard do Servidor</span>
      </nav>

      <!-- Cabeçalho da Tela -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-[#007a33]">
            {{ state.activeOrgao().unidadeLabel }} • {{ state.activeOrgao().fusoHorario }}
          </span>
          <h1 class="text-2xl font-bold text-[#002f6c] tracking-tight mt-0.5">
            Dashboard do Servidor • Olá, {{ state.servidorNome() }}
          </h1>
          <p class="text-xs text-slate-600 mt-0.5">
            {{ state.servidorLotacao() }} • Matrícula {{ state.servidorMatricula() }}
          </p>
        </div>

        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="portariaModalAberta.set(true)"
            class="h-9 px-3.5 rounded-xl border border-[#002f6c]/25 bg-white hover:bg-blue-50 text-[#002f6c] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
          >
            <span>ℹ</span>
            <span>{{ state.regulamentacaoSjam.numeroPortaria }}</span>
          </button>

          <a
            routerLink="/espelho-ponto"
            class="h-9 px-4 rounded-xl bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-bold flex items-center shadow-sm transition"
          >
            Abrir Espelho de Ponto &rarr;
          </a>
        </div>
      </div>

      <!-- PRIMEIRA DOBRA: Card de Próxima Ação + 4 Indicadores -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <!-- Card Próxima Ação Recomendada -->
        <div class="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#002f6c] to-[#005f73] text-white p-6 shadow-md flex flex-col justify-between">
          <div>
            <span class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/15 px-3 py-1 rounded-full">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Próxima Ação Recomendada
            </span>
            <h2 class="text-xl font-bold mt-3 leading-snug">
              {{ state.proximaAcaoRecomendada().titulo }}
            </h2>
            <p class="text-xs text-blue-100 mt-1.5 leading-relaxed">
              {{ state.proximaAcaoRecomendada().subtitulo }}
            </p>
          </div>

          <div class="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              [disabled]="state.limiteDiarioAtingido()"
              (click)="acionarRegistroPonto()"
              class="px-4 py-2.5 rounded-xl bg-[#007a33] hover:bg-[#005e27] disabled:opacity-50 text-white text-xs font-bold shadow transition"
            >
              {{ state.proximaAcaoRecomendada().botaoLabel }}
            </button>

            <a
              routerLink="/espelho-ponto"
              class="px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition"
            >
              Consultar Espelho
            </a>
          </div>
        </div>

        <!-- 4 Cards de Indicadores -->
        <div class="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="card-surface bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[#97999b]">Jornada Hoje</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-[#002f6c]">7h Ininterrupta</span>
            </div>
            <strong class="text-3xl font-bold text-[#002f6c] mt-2">07h00</strong>
            <span class="text-[11px] text-slate-500 mt-1">
              Expediente padrão: {{ state.regulamentacaoSjam.expedientePadraoInicio }} às {{ state.regulamentacaoSjam.expedientePadraoFim }}
            </span>
          </div>

          <div class="card-surface bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[#97999b]">Trabalhado Hoje</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">Tempo Real</span>
            </div>
            <strong class="text-3xl font-bold text-slate-900 mt-2">{{ trabalhadoHojeLabel() }}</strong>
            <span class="text-[11px] text-slate-500 mt-1">
              {{ state.marcacoesHoje().length }} de {{ state.regulamentacaoSjam.limiteMarcacoesDia }} marcações contabilizadas
            </span>
          </div>

          <div class="card-surface bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[#97999b]">Banco de Horas</span>
              <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#007a33]">
                Teto {{ limiteBancoLabel }} • {{ state.regulamentacaoSjam.mesesExpiracaoCompensacao }} meses
              </span>
            </div>
            <strong class="text-3xl font-bold text-[#007a33] mt-2">{{ saldoBancoLabel() }}</strong>
            <div class="mt-1">
              <div class="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>Créditos mês: {{ creditosMesLabel() }} / {{ limiteBancoLabel }}</span>
                <span>{{ percentualTetoUsado() }}%</span>
              </div>
              <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div class="h-full bg-[#007a33]" [style.width.%]="percentualTetoUsado()"></div>
              </div>
            </div>
          </div>

          <div class="card-surface bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-[#97999b]">Pendências</span>
              <span
                class="text-[10px] font-bold px-2 py-0.5 rounded"
                [ngClass]="state.pendenciasHojeCount() > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-[#007a33]'"
              >
                {{ state.pendenciasHojeCount() > 0 ? 'Atenção' : 'Regular' }}
              </span>
            </div>
            <strong
              class="text-3xl font-bold mt-2"
              [ngClass]="state.pendenciasHojeCount() > 0 ? 'text-amber-600' : 'text-[#007a33]'"
            >
              {{ state.pendenciasHojeCount() }}
            </strong>
            <span class="text-[11px] text-slate-500 mt-1">
              {{ state.pendenciasHojeCount() > 0 ? 'Aguardando conclusão da sequência diária' : 'Sequência do dia equilibrada' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Timeline Cronológica do Dia (até 6 marcações + badges REP/FACIAL/AFD/WEB) -->
      <app-timeline-marcacoes
        [marcacoes]="state.marcacoesHoje()"
        [fusoHorario]="state.activeOrgao().fusoHorario"
        [limiteMarcacoes]="state.regulamentacaoSjam.limiteMarcacoesDia"
      />
    </div>

    <!-- MODAL SIMULADO DE CAPTURA BIOMÉTRICA FACIAL (1ª MARCAÇÃO WEB - SEÇÃO 7.2) -->
    @if (modalFacialAberta()) {
      <div
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-facial-title"
      >
        <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-6 py-4 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 id="modal-facial-title" class="text-sm font-bold">
              Validação Biométrica Facial Obrigatória (1ª Marcação)
            </h3>
            <button
              type="button"
              (click)="modalFacialAberta.set(false)"
              class="text-blue-200 hover:text-white"
              aria-label="Fechar modal biométrica"
            >
              ✕
            </button>
          </div>

          <div class="p-6 flex flex-col items-center text-center gap-4">
            <div class="w-48 h-48 rounded-2xl bg-[#0b1b36] p-4 flex flex-col items-center justify-center text-white relative w-full">
              <div class="w-28 h-28 rounded-full border-2 border-dashed border-emerald-400 flex flex-col items-center justify-center">
                <svg class="w-11 h-11 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <span class="mt-2 px-3 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-[10px] text-emerald-300 font-semibold">
                {{ capturaStatus() }}
              </span>
              <div class="w-full flex items-center justify-between text-[10px] text-slate-300 mt-3 pt-2 border-t border-white/10 font-mono">
                <span>Qualidade: 0.91 (mín 0.65)</span>
                <span>Distância: 0.24 (≤ 0.42)</span>
              </div>
            </div>

            <div class="w-full rounded-xl bg-slate-50 border border-slate-200 p-3 text-left text-xs flex flex-col gap-1.5">
              <div class="flex justify-between">
                <span class="text-slate-500">Servidor:</span>
                <strong class="text-slate-900">{{ state.servidorNome() }} ({{ state.servidorMatricula() }})</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Próxima sequência:</span>
                <strong class="text-[#002f6c]">1ª Batida — Entrada (Exige Facial)</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Fuso oficial:</span>
                <strong class="text-slate-900">{{ state.activeOrgao().fusoHorario }}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Token biométrico:</span>
                <strong class="text-[#007a33]">Uso único (validade 2 min)</strong>
              </div>
            </div>

            <div class="w-full pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                (click)="modalFacialAberta.set(false)"
                class="h-9 px-4 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmarCapturaFacial()"
                class="h-9 px-4 rounded-xl bg-[#007a33] hover:bg-[#005e27] text-white text-xs font-bold"
              >
                ✓ Validar Face e Registrar Ponto
              </button>
            </div>
          </div>
        </div>
      </div>
    }

    <!-- MODAL INFORMATIVO: PARÂMETROS DA PORTARIA SJAM-DIREF 135/2025 (ANEXO C.2) -->
    @if (portariaModalAberta()) {
      <div
        class="fixed inset-0 bg-slate-900/60 backdrop-blur-[1px] z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-portaria-title"
      >
        <div class="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-6 py-4 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 id="modal-portaria-title" class="text-sm font-bold">
              Parâmetros Vigentes — {{ state.regulamentacaoSjam.numeroPortaria }} (Anexo C.2)
            </h3>
            <button
              type="button"
              (click)="portariaModalAberta.set(false)"
              class="text-blue-200 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div class="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[#97999b] block">Limite de Crédito Mensal</span>
              <strong class="text-slate-900 text-sm">{{ state.regulamentacaoSjam.limiteCreditoMensalMinutos }} min (16h00/mês)</strong>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[#97999b] block">Prazo de Compensação</span>
              <strong class="text-slate-900 text-sm">{{ state.regulamentacaoSjam.mesesExpiracaoCompensacao }} meses</strong>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[#97999b] block">Crédito Mínimo (Jornada 7h)</span>
              <strong class="text-slate-900 text-sm">{{ state.regulamentacaoSjam.jornada7hCreditoMinimoMinutos }} min (08h00)</strong>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[#97999b] block">Autorização Prévia de Crédito</span>
              <strong class="text-slate-900 text-sm">{{ state.regulamentacaoSjam.exigeAutorizacaoPreviaCredito ? 'Sim (Obrigatória)' : 'Não' }}</strong>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[#97999b] block">Expediente &amp; Janela Permitida</span>
              <strong class="text-slate-900 text-sm">
                {{ state.regulamentacaoSjam.expedientePadraoInicio }}–{{ state.regulamentacaoSjam.expedientePadraoFim }}
                (Máx {{ state.regulamentacaoSjam.entradaMinimaPermitida }}–{{ state.regulamentacaoSjam.saidaMaximaPermitida }})
              </strong>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span class="text-[#97999b] block">Acréscimos Especiais</span>
              <strong class="text-slate-900 text-sm">
                Sáb +{{ state.regulamentacaoSjam.percentualCreditoSabado }}% • Dom/Fer/Recesso +{{ state.regulamentacaoSjam.percentualCreditoDomingoFeriado }}%
              </strong>
            </div>
          </div>

          <div class="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button
              type="button"
              (click)="portariaModalAberta.set(false)"
              class="h-9 px-4 rounded-xl bg-[#002f6c] text-white text-xs font-bold"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class DashboardServidorComponent {
  readonly state = inject(SecpPontoStateService);
  readonly modalFacialAberta = signal<boolean>(false);
  readonly portariaModalAberta = signal<boolean>(false);
  readonly capturaStatus = signal<string>('Rosto detectado • Prova de vida OK');

  readonly limiteBancoLabel = formatarMinutos(
    this.state.regulamentacaoSjam.limiteCreditoMensalMinutos
  );

  readonly trabalhadoHojeLabel = computed(() =>
    formatarMinutos(this.state.trabalhadoHojeMinutos())
  );

  readonly saldoBancoLabel = computed(() =>
    formatarMinutos(this.state.bancoSaldoMinutos(), true)
  );

  readonly creditosMesLabel = computed(() =>
    formatarMinutos(this.state.bancoCreditosMesMinutos(), true)
  );

  readonly percentualTetoUsado = computed(() =>
    Math.min(
      100,
      Math.round(
        (this.state.bancoCreditosMesMinutos() /
          this.state.regulamentacaoSjam.limiteCreditoMensalMinutos) *
          100
      )
    )
  );

  acionarRegistroPonto(): void {
    if (this.state.exigeValidacaoFacialNaProxima()) {
      this.modalFacialAberta.set(true);
    } else {
      this.state.registrarMarcacaoHoje('WEB');
    }
  }

  confirmarCapturaFacial(): void {
    this.modalFacialAberta.set(false);
    this.state.registrarMarcacaoHoje('FACIAL');
  }
}
