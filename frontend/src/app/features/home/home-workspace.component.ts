import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';

@Component({
  selector: 'app-home-workspace',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-5xl mx-auto py-4 flex flex-col gap-8">
      <!-- Saudação Principal estilo CARTO Workspace (clausa.app.carto.com/home) -->
      <div>
        <h1 class="text-3xl font-bold text-[#002f6c] tracking-tight">
          Bem-vindo ao SECP Ponto, {{ state.servidorNome() }}
        </h1>
        <p class="text-sm text-slate-600 mt-2 max-w-2xl leading-relaxed">
          Acompanhe sua frequência em tempo real, realize marcações com validação biométrica facial,
          consulte seu espelho de ponto e gerencie o banco de horas sob a
          <strong class="text-slate-800">{{ state.regulamentacaoSjam.numeroPortaria }}</strong>.
        </p>

        <!-- 3 Links Horizontais com Ícones Circulares (Padrão CARTO Home) -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-5 border-t border-slate-200">
          <a
            routerLink="/dashboard"
            class="flex items-start gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition group"
          >
            <span class="w-9 h-9 rounded-full bg-blue-50 text-[#002f6c] flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-[#002f6c] group-hover:text-white transition">
              ⏱
            </span>
            <div>
              <strong class="text-xs font-bold text-slate-900 block group-hover:text-[#002f6c]">
                Primeira marcação do dia
              </strong>
              <span class="text-[11px] text-slate-500">
                Validação facial web obrigatória na entrada
              </span>
            </div>
          </a>

          <a
            routerLink="/espelho-ponto"
            class="flex items-start gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition group"
          >
            <span class="w-9 h-9 rounded-full bg-emerald-50 text-[#007a33] flex items-center justify-center shrink-0 border border-emerald-100 group-hover:bg-[#007a33] group-hover:text-white transition">
              📋
            </span>
            <div>
              <strong class="text-xs font-bold text-slate-900 block group-hover:text-[#007a33]">
                Conferir Espelho Mensal
              </strong>
              <span class="text-[11px] text-slate-500">
                Sincronize SARH e envie até o dia 10
              </span>
            </div>
          </a>

          <a
            routerLink="/dashboard"
            class="flex items-start gap-3 p-3 rounded-xl hover:bg-white hover:shadow-sm transition group"
          >
            <span class="w-9 h-9 rounded-full bg-slate-100 text-[#002f6c] flex items-center justify-center shrink-0 border border-slate-200 group-hover:bg-[#002f6c] group-hover:text-white transition">
              ⚖
            </span>
            <div>
              <strong class="text-xs font-bold text-slate-900 block group-hover:text-[#002f6c]">
                Consultar Portaria 135/2025
              </strong>
              <span class="text-[11px] text-slate-500">
                Regras de banco de horas (16h/mês • 3 meses)
              </span>
            </div>
          </a>
        </div>
      </div>

      <!-- Seção 1: Comece sua rotina de ponto (Grid de 4 Cards estilo CARTO) -->
      <div>
        <h2 class="text-sm font-bold text-slate-800 mb-3.5">
          Comece sua rotina no {{ state.activeOrgao().sigla }}
        </h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Card Principal CTA -->
          <a
            routerLink="/dashboard"
            class="rounded-2xl border border-slate-200 bg-gradient-to-br from-[#002f6c]/5 via-white to-blue-50/40 p-5 flex flex-col items-center justify-center text-center min-h-[190px] hover:shadow-md hover:border-[#002f6c]/40 transition group"
          >
            <span class="px-4 py-2 rounded-xl bg-[#007a33] group-hover:bg-[#005e27] text-white text-xs font-bold shadow-sm transition">
              Abrir Dashboard / Bater Ponto
            </span>
            <span class="text-[11px] text-slate-500 mt-3">
              {{ state.marcacoesHoje().length }}/6 marcações hoje • {{ state.activeOrgao().fusoHorario }}
            </span>
          </a>

          <!-- Card Espelho -->
          <a
            routerLink="/espelho-ponto"
            class="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between min-h-[190px] hover:shadow-md hover:border-[#002f6c]/40 transition"
          >
            <div class="h-24 bg-gradient-to-r from-[#002f6c] to-[#005f73] p-4 flex items-end justify-between text-white">
              <span class="text-xs font-bold">Espelho {{ state.espelhoAtual().competencia }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-semibold">
                {{ state.espelhoAtual().statusCompetencia }}
              </span>
            </div>
            <div class="p-4">
              <strong class="text-sm font-bold text-slate-900 block">Meu Espelho de Ponto</strong>
              <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <span class="px-2 py-0.5 rounded bg-slate-100 font-medium">Apuração Diária</span>
                <span>SARH</span>
              </div>
            </div>
          </a>

          <!-- Card Banco de Horas -->
          <a
            routerLink="/espelho-ponto"
            class="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between min-h-[190px] hover:shadow-md hover:border-[#007a33]/40 transition"
          >
            <div class="h-24 bg-gradient-to-r from-[#007a33] to-emerald-600 p-4 flex items-end justify-between text-white">
              <span class="text-lg font-bold font-mono">+08h20</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-semibold">
                Teto 16h/mês
              </span>
            </div>
            <div class="p-4">
              <strong class="text-sm font-bold text-slate-900 block">Banco de Horas</strong>
              <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <span class="px-2 py-0.5 rounded bg-slate-100 font-medium">Validade 3 meses</span>
                <span>SJAM</span>
              </div>
            </div>
          </a>

          <!-- Card Solicitações -->
          <a
            routerLink="/espelho-ponto"
            class="rounded-2xl border border-slate-200 bg-white overflow-hidden flex flex-col justify-between min-h-[190px] hover:shadow-md hover:border-[#002f6c]/40 transition"
          >
            <div class="h-24 bg-gradient-to-r from-slate-800 to-[#002f6c] p-4 flex items-end justify-between text-white">
              <span class="text-xs font-bold">Ajustes &amp; Abonos</span>
              <span class="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-semibold">
                {{ state.pendenciasHojeCount() }} pendência(s)
              </span>
            </div>
            <div class="p-4">
              <strong class="text-sm font-bold text-slate-900 block">Solicitações de Frequência</strong>
              <div class="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                <span class="px-2 py-0.5 rounded bg-slate-100 font-medium">Fluxo Chefia</span>
                <span>Auditoria</span>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class HomeWorkspaceComponent {
  readonly state = inject(SecpPontoStateService);
}
