import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  formatarMinutos,
  SecpPontoStateService,
} from '../../core/services/secp-ponto-state.service';
import { RegistrarPontoFacialResponse } from '../../core/services/facial-recognition.service';
import { BiometriaFacialModalComponent } from '../../shared/components/biometria-facial-modal.component';

const MESES_UPPER = [
  'JANEIRO',
  'FEVEREIRO',
  'MARÇO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
] as const;

@Component({
  selector: 'app-dashboard-servidor',
  standalone: true,
  imports: [CommonModule, RouterLink, BiometriaFacialModalComponent],
  template: `
    <div class="flex flex-col gap-5">
      <!-- Breadcrumb + Ações Superiores -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <a routerLink="/home" class="hover:text-[#002f6c] transition font-medium">Início</a>
          <span>›</span>
          <span class="font-semibold text-slate-700">Dashboard</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            (click)="portariaModalAberta.set(true)"
            class="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:border-[#002f6c] text-xs font-semibold text-[#002f6c] flex items-center gap-1.5 shadow-2xs transition"
          >
            <span>ℹ</span>
            <span>{{ state.regulamentacaoSjam.numeroPortaria }}</span>
          </button>

          <button
            type="button"
            (click)="abrirCadastroFacial()"
            class="h-8 px-3 rounded-xl border border-slate-200 bg-white hover:border-[#002f6c] text-xs font-semibold text-[#002f6c] flex items-center gap-1.5 shadow-2xs transition"
          >
            <span>☺</span>
            <span>Minha Biometria Facial</span>
          </button>

          <button
            type="button"
            [disabled]="state.limiteDiarioAtingido()"
            (click)="acionarRegistroPonto()"
            class="h-8 px-3.5 rounded-xl bg-[#007a33] hover:bg-[#005e27] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5"
          >
            <span>●</span>
            <span>{{ state.proximaAcaoRecomendada().botaoLabel }}</span>
          </button>
        </div>
      </div>

      <!-- HEADER DE BOAS-VINDAS -->
      <div class="rounded-2xl border border-[#e2e8f0] bg-white px-5 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003b80] text-white shadow-sm">
            <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </div>
          <div>
            <div class="flex flex-wrap items-center gap-2.5">
              <h1 class="text-xl font-extrabold tracking-tight text-[#0f172a]">
                {{ saudacao() }}, {{ primeiroNome() }}
              </h1>
              <span class="rounded-full bg-[#eef4fb] border border-[#d6e4f5] px-2.5 py-0.5 text-[11px] font-semibold text-[#003b80]">
                Perfil {{ state.activePerfil().nome }}
              </span>
            </div>
            <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[#64748b]">
              <span>{{ dataHoraAtualFormatada() }}</span>
              <span class="text-slate-300">•</span>
              <span class="font-medium text-[#475569]">
                {{ state.activeOrgao().sigla }} › {{ state.servidorLotacao() }}
              </span>
            </div>
          </div>
        </div>

        <a
          routerLink="/espelho-ponto"
          class="h-9 px-4 rounded-xl bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition"
        >
          <span>Abrir Espelho de Ponto</span>
          <span>→</span>
        </a>
      </div>

      <!-- 5 KPI CARDS -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <!-- KPI 1 -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004494] text-white shadow-xs">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] truncate">
              Jornada prevista hoje
            </span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] leading-tight mt-0.5">7h</strong>
            <span class="block text-[11px] text-[#64748b]">Jornada diária</span>
          </div>
        </div>

        <!-- KPI 2 -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#15803d] text-white shadow-xs">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] truncate">
              Trabalhado hoje
            </span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] leading-tight mt-0.5 font-mono">
              {{ trabalhadoHojeSegundosLabel() }}
            </strong>
            <span class="block text-[11px] text-[#64748b]">Horas apuradas</span>
          </div>
        </div>

        <!-- KPI 3 -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed] text-white shadow-xs">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3M7 4h10l-1 4H8L7 4zm0 16h10l-1-4H8l-1 4z" />
            </svg>
          </div>
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] truncate">
              Banco de horas
            </span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] leading-tight mt-0.5 font-mono">
              {{ saldoBancoLabel() }}
            </strong>
            <span class="block text-[11px] text-[#64748b]">
              {{ state.pendenciasHojeCount() > 0 ? 'Com movimento pendente' : 'Saldo consolidado' }}
            </span>
          </div>
        </div>

        <!-- KPI 4 -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#ea580c] text-white shadow-xs">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] truncate">
              Pendências
            </span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] leading-tight mt-0.5">
              {{ totalPendenciasCard() }}
            </strong>
            <span class="block text-[11px] text-[#64748b] truncate">Itens aguardando regularização</span>
          </div>
        </div>

        <!-- KPI 5 -->
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex items-center gap-3.5">
          <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#004494] text-white shadow-xs">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="min-w-0">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b] truncate">
              Próxima marcação
            </span>
            <strong class="block text-xl font-extrabold text-[#0f172a] leading-tight mt-0.5 truncate">
              {{ proximaMarcacaoResumo() }}
            </strong>
            <span class="block text-[11px] text-[#64748b]">Acompanhe sua jornada</span>
          </div>
        </div>
      </div>

      <!-- FILEIRA DO MEIO: MARCAÇÕES DE HOJE | MINHA JORNADA HOJE | ACESSO RÁPIDO -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Painel 1: Marcações de hoje -->
        <section class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004494] text-white">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <h2 class="text-sm font-bold text-[#0f172a]">Marcações de hoje</h2>
            </div>

            <span class="rounded-full bg-[#eef4fb] px-2.5 py-0.5 text-[11px] font-bold text-[#003b80]">
              {{ state.marcacoesHoje().length }} {{ state.marcacoesHoje().length === 1 ? 'marcação' : 'marcações' }}
            </span>
          </div>

          <div class="p-4 flex-1 flex flex-col gap-3">
            @for (slot of marcacoesTimelineSlots(); track slot.ordem) {
              <div class="flex items-center gap-3">
                <span
                  class="h-2.5 w-2.5 shrink-0 rounded-full"
                  [ngClass]="slot.registrada ? 'bg-[#16a34a]' : 'bg-[#ef4444]'"
                ></span>

                <div class="flex-1 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span
                      class="flex h-7 w-7 items-center justify-center rounded-full text-xs"
                      [ngClass]="slot.registrada ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-600'"
                    >
                      ◷
                    </span>
                    <div>
                      <strong class="block text-xs font-bold text-[#0f172a]">{{ slot.titulo }}</strong>
                      <span class="block text-xs font-mono font-semibold text-[#475569]">
                        {{ slot.horario }}
                      </span>
                    </div>
                  </div>

                  <div class="flex items-center gap-2">
                    <span
                      class="rounded-full px-2 py-0.5 text-[10px] font-bold"
                      [ngClass]="
                        slot.registrada
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      "
                    >
                      {{ slot.registrada ? 'Registrada' : 'Pendente' }}
                    </span>
                    <span class="text-[11px] text-[#64748b] font-medium">
                      {{ slot.origem }}
                    </span>
                  </div>
                </div>
              </div>
            }

            <div class="mt-auto rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2.5 text-[11px] text-[#475569] flex items-center justify-between gap-2">
              <span>O painel exibe todas as marcações do dia em ordem cronológica.</span>
              <button
                type="button"
                [disabled]="state.limiteDiarioAtingido()"
                (click)="acionarRegistroPonto()"
                class="shrink-0 rounded-lg bg-[#003b80] hover:bg-[#002a5c] disabled:opacity-40 px-2.5 py-1 text-[11px] font-bold text-white transition"
              >
                + Registrar
              </button>
            </div>
          </div>
        </section>

        <!-- Painel 2: Minha jornada hoje -->
        <section class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0284c7] text-white">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              <h2 class="text-sm font-bold text-[#0f172a]">Minha jornada hoje</h2>
            </div>

            <a routerLink="/espelho-ponto" class="text-xs font-semibold text-[#003b80] hover:underline">
              Detalhes do dia
            </a>
          </div>

          <div class="p-4 flex-1 flex flex-col justify-between gap-4">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <span class="block text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Entrada prevista</span>
                <strong class="block text-sm font-extrabold text-[#0f172a] mt-1 font-mono">
                  {{ state.regulamentacaoSjam.expedientePadraoInicio }}
                </strong>
              </div>
              <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <span class="block text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Saída prevista</span>
                <strong class="block text-sm font-extrabold text-[#0f172a] mt-1 font-mono">
                  {{ state.regulamentacaoSjam.expedientePadraoFim }}
                </strong>
              </div>
              <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <span class="block text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Jornada prevista</span>
                <strong class="block text-sm font-extrabold text-[#0f172a] mt-1">7h</strong>
              </div>
              <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-2.5">
                <span class="block text-[9px] font-bold uppercase tracking-wider text-[#64748b]">Saída estimada</span>
                <strong class="block text-sm font-extrabold text-[#0f172a] mt-1 font-mono">
                  {{ state.regulamentacaoSjam.expedientePadraoFim }}
                </strong>
              </div>
            </div>

            <!-- Barra de Progresso -->
            <div>
              <div class="h-2.5 w-full rounded-full bg-[#e2e8f0] overflow-hidden">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-[#1d4ed8] to-[#003b80] transition-all duration-500"
                  [style.width.%]="percentualJornadaHoje()"
                ></div>
              </div>
              <div class="mt-1.5 flex items-center justify-between text-[11px] text-[#64748b]">
                <span>Progresso da jornada de hoje ({{ trabalhadoHojeLabel() }} de 07:00)</span>
                <strong class="font-bold text-[#0f172a]">{{ percentualJornadaHoje() }}%</strong>
              </div>
            </div>

            <!-- Blocos visuais de turno -->
            <div>
              <div class="flex justify-between text-[10px] font-mono text-[#64748b] mb-1">
                <span>08:00</span>
                <span>10:00</span>
                <span>12:00</span>
                <span>14:00</span>
                <span>15:00</span>
              </div>
              <div class="grid grid-cols-12 h-9 rounded-xl overflow-hidden border border-[#e2e8f0] text-[11px] font-semibold">
                <div class="col-span-4 bg-emerald-100/80 text-emerald-900 flex items-center justify-center">
                  Trabalhando
                </div>
                <div class="col-span-3 bg-rose-50 text-rose-900 flex items-center justify-center border-x border-[#e2e8f0]">
                  Intervalo
                </div>
                <div class="col-span-4 bg-emerald-100/80 text-emerald-900 flex items-center justify-center border-r border-[#e2e8f0]">
                  Trabalhando
                </div>
                <div class="col-span-1 bg-slate-100 text-slate-400 flex items-center justify-center">-</div>
              </div>
              <div class="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] text-[#64748b]">
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-emerald-500"></span> Período trabalhado</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-rose-500"></span> Intervalo</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-400"></span> Aguardando</span>
                <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-400"></span> Fora da jornada</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Painel 3: Acesso rápido -->
        <section class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#004494] text-white">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </span>
              <h2 class="text-sm font-bold text-[#0f172a]">Acesso rápido</h2>
            </div>

            <a routerLink="/espelho-ponto" class="text-xs font-semibold text-[#003b80] hover:underline">
              Ver todos
            </a>
          </div>

          <div class="p-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1">
            @for (tile of acessoRapidoTiles; track tile.titulo) {
              <a
                [routerLink]="tile.rota"
                class="rounded-xl border border-[#e2e8f0] bg-white hover:border-[#003b80]/40 hover:bg-[#f8fafc] p-3 transition flex flex-col justify-between gap-2 group"
              >
                <span
                  class="flex h-8 w-8 items-center justify-center rounded-lg text-white text-sm shadow-2xs"
                  [style.background-color]="tile.cor"
                >
                  {{ tile.icone }}
                </span>
                <div>
                  <strong class="block text-xs font-bold text-[#0f172a] group-hover:text-[#003b80] truncate">
                    {{ tile.titulo }}
                  </strong>
                  <span class="block text-[10px] leading-snug text-[#64748b] mt-0.5 line-clamp-2">
                    {{ tile.descricao }}
                  </span>
                </div>
              </a>
            }
          </div>
        </section>
      </div>

      <!-- FILEIRA INFERIOR: FREQUÊNCIA MÊS | ALERTAS E AVISOS | PRÓXIMAS AÇÕES -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <!-- Frequência mês -->
        <section class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#15803d] text-white">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </span>
              <h2 class="text-sm font-bold text-[#0f172a]">Frequência mês {{ competenciaTituloUpper() }}</h2>
            </div>

            <a routerLink="/espelho-ponto" class="text-xs font-semibold text-[#003b80] hover:underline">
              Ver espelho
            </a>
          </div>

          <div class="p-4 flex-1 flex flex-col justify-between gap-4">
            <div class="flex items-center gap-5">
              <!-- SVG Donut -->
              <div class="relative h-24 w-24 shrink-0 flex items-center justify-center">
                <svg viewBox="0 0 36 36" class="h-24 w-24 -rotate-90">
                  <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e2e8f0" stroke-width="3.2"></circle>
                  <circle
                    cx="18"
                    cy="18"
                    r="15.9155"
                    fill="none"
                    stroke="#0284c7"
                    stroke-width="3.2"
                    stroke-linecap="round"
                    [attr.stroke-dasharray]="donutFrequenciaDash()"
                  ></circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <strong class="text-lg font-extrabold text-[#0f172a] leading-none">{{ resumoFrequencia().totalDias }}</strong>
                  <span class="text-[9px] text-[#64748b] mt-0.5">dias úteis</span>
                </div>
              </div>

              <!-- Legenda detalhada -->
              <div class="flex-1 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <div class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-emerald-600"></span>
                  <span class="text-[#334155]"><strong>{{ resumoFrequencia().regulares }}</strong> Regulares</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-amber-500"></span>
                  <span class="text-[#334155]"><strong>{{ resumoFrequencia().pendencias }}</strong> Pendências</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-rose-600"></span>
                  <span class="text-[#334155]"><strong>{{ resumoFrequencia().faltas }}</strong> Faltas</span>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-slate-400"></span>
                  <span class="text-[#334155]"><strong>{{ resumoFrequencia().semExpediente }}</strong> Sem expediente</span>
                </div>
                <div class="col-span-2 flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-sky-600"></span>
                  <span class="text-[#334155]"><strong>{{ resumoFrequencia().aguardando }}</strong> Aguardando homologação</span>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3.5 py-2 text-xs text-[#334155]">
              <strong>Status:</strong> {{ resumoFrequencia().percentualRegulares }}% dos dias apurados estão regulares ou aguardando homologação.
            </div>
          </div>
        </section>

        <!-- Alertas e avisos -->
        <section class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ea580c] text-white">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </span>
              <h2 class="text-sm font-bold text-[#0f172a]">Alertas e avisos</h2>
            </div>

            <a routerLink="/solicitacoes" class="text-xs font-semibold text-[#003b80] hover:underline">
              Ver todos
            </a>
          </div>

          <div class="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            <div class="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex flex-col justify-between gap-2">
              <div>
                <div class="flex items-start gap-2">
                  <span class="text-amber-600 text-sm">⚠</span>
                  <strong class="text-xs font-bold text-[#0f172a]">Pendências de frequência</strong>
                </div>
                <p class="mt-1.5 text-[11px] leading-relaxed text-[#475569]">
                  {{ totalPendenciasCard() }} item(ns) precisam de regularização na competência atual.
                </p>
              </div>
              <a routerLink="/solicitacoes" class="text-xs font-bold text-[#003b80] hover:underline">
                Ver solicitações
              </a>
            </div>

            <div class="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 flex flex-col justify-between gap-2">
              <div>
                <div class="flex items-start gap-2">
                  <span class="text-amber-600 text-sm">⚠</span>
                  <strong class="text-xs font-bold text-[#0f172a]">Banco de horas requer atenção</strong>
                </div>
                <p class="mt-1.5 text-[11px] leading-relaxed text-[#475569]">
                  Acompanhe o saldo e movimentos pendentes de validação pela chefia imediata.
                </p>
              </div>
              <a routerLink="/banco-horas" class="text-xs font-bold text-[#003b80] hover:underline">
                Analisar saldo
              </a>
            </div>
          </div>
        </section>

        <!-- Próximas ações -->
        <section class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs flex flex-col overflow-hidden">
          <div class="px-5 py-3.5 border-b border-[#f1f5f9] flex items-center gap-2.5">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-[#7c3aed] text-white">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h2 class="text-sm font-bold text-[#0f172a]">Próximas ações</h2>
          </div>

          <div class="p-4 flex flex-col gap-2.5 flex-1 justify-center">
            @for (acao of proximasAcoesLista; track acao.titulo) {
              <a
                [routerLink]="acao.rota"
                class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] hover:border-[#003b80]/40 hover:bg-[#eef4fb]/60 px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold text-[#0f172a] transition group"
              >
                <span class="flex items-center gap-2.5">
                  <span class="text-[#003b80]">{{ acao.icone }}</span>
                  <span>{{ acao.titulo }}</span>
                </span>
                <span class="text-[#64748b] group-hover:translate-x-0.5 group-hover:text-[#003b80] transition">→</span>
              </a>
            }
          </div>
        </section>
      </div>
    </div>

    <!-- MODAL REAL DE BIOMETRIA FACIAL (CADASTRO E MARCAÇÃO COM PROVA DE VIDA) -->
    @if (modalFacialAberta()) {
      <app-biometria-facial-modal
        [mode]="modalFacialModo()"
        [matricula]="state.servidorMatricula()"
        [servidorNome]="state.servidorNome()"
        (closed)="modalFacialAberta.set(false)"
        (cadastrado)="onBiometriaCadastrada()"
        (marcacaoRegistrada)="onMarcacaoFacialRegistrada($event)"
      />
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
export class DashboardServidorComponent implements OnInit, OnDestroy {
  readonly state = inject(SecpPontoStateService);
  readonly modalFacialAberta = signal<boolean>(false);
  readonly modalFacialModo = signal<'cadastro' | 'marcacao'>('marcacao');
  readonly portariaModalAberta = signal<boolean>(false);
  readonly capturaStatus = signal<string>('Rosto detectado • Prova de vida OK');
  readonly agora = signal<Date>(new Date());
  private clockTimer: ReturnType<typeof setInterval> | null = null;

  readonly acessoRapidoTiles = [
    { titulo: 'Espelho de ponto', descricao: 'Consulte sua frequência mensal.', rota: '/espelho-ponto', icone: '◫', cor: '#004494' },
    { titulo: 'Marcações', descricao: 'Consulte suas marcações do dia.', rota: '/espelho-ponto', icone: '◷', cor: '#0284c7' },
    { titulo: 'Meus afastamentos', descricao: 'Consulte férias, licenças e afastamentos.', rota: '/solicitacoes', icone: '📅', cor: '#7c3aed' },
    { titulo: 'Solicitar ajuste', descricao: 'Corrija falhas de marcação.', rota: '/solicitacoes', icone: '✎', cor: '#15803d' },
    { titulo: 'Compensação', descricao: 'Solicite compensação de horas.', rota: '/banco-horas', icone: '⏳', cor: '#0056b3' },
    { titulo: 'Recesso forense', descricao: 'Acompanhe convocações.', rota: '/banco-horas', icone: '⚖', cor: '#7c3aed' },
  ];

  readonly proximasAcoesLista = [
    { titulo: 'Regularizar marcação pendente', rota: '/solicitacoes', icone: '📄' },
    { titulo: 'Verificar banco de horas', rota: '/banco-horas', icone: '◷' },
    { titulo: 'Enviar solicitações', rota: '/solicitacoes', icone: '✓' },
    { titulo: 'Consultar espelho do mês', rota: '/espelho-ponto', icone: '📅' },
  ];

  ngOnInit(): void {
    this.clockTimer = setInterval(() => {
      this.agora.set(new Date());
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.clockTimer) {
      clearInterval(this.clockTimer);
    }
  }

  readonly primeiroNome = computed(() => {
    const nome = this.state.servidorNome()?.trim() || 'SERVIDOR';
    return nome.split(/\s+/)[0].toUpperCase();
  });

  readonly saudacao = computed(() => {
    const h = this.agora().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  });

  readonly dataHoraAtualFormatada = computed(() => {
    const d = this.agora();
    const tz = this.state.activeOrgao().fusoHorario || 'America/Manaus';
    try {
      const dataStr = new Intl.DateTimeFormat('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        timeZone: tz,
      }).format(d);
      const horaStr = new Intl.DateTimeFormat('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: tz,
      }).format(d);
      const capitalizada = dataStr.charAt(0).toUpperCase() + dataStr.slice(1);
      return `${capitalizada} • ${horaStr}`;
    } catch {
      return d.toLocaleString('pt-BR');
    }
  });

  readonly trabalhadoHojeLabel = computed(() =>
    formatarMinutos(this.state.trabalhadoHojeMinutos())
  );

  readonly trabalhadoHojeSegundosLabel = computed(() => {
    const mins = this.state.trabalhadoHojeMinutos();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  });

  readonly saldoBancoLabel = computed(() =>
    formatarMinutos(this.state.bancoSaldoMinutos(), true)
  );

  readonly percentualJornadaHoje = computed(() => {
    const meta = 7 * 60;
    return Math.min(100, Math.round((this.state.trabalhadoHojeMinutos() / meta) * 100));
  });

  readonly totalPendenciasCard = computed(() => {
    const incEspelho = this.state.espelhoAtual().faltasOuInconsistencias || 0;
    return this.state.pendenciasHojeCount() + incEspelho;
  });

  readonly proximaMarcacaoResumo = computed(() => {
    const qtd = this.state.marcacoesHoje().length;
    if (qtd === 0) return `Entrada ${this.state.regulamentacaoSjam.expedientePadraoInicio}`;
    if (qtd % 2 === 1) return `Saída ${this.state.regulamentacaoSjam.expedientePadraoFim}`;
    return 'Jornada concluída';
  });

  readonly marcacoesTimelineSlots = computed(() => {
    const marcacoes = this.state.marcacoesHoje();
    if (marcacoes.length === 0) {
      return [
        { ordem: 1, titulo: 'Entrada', horario: '--:--', origem: 'Sistema', registrada: false },
        { ordem: 2, titulo: 'Saída', horario: '--:--', origem: 'App Mobile', registrada: false },
      ];
    }
    const items: { ordem: number; titulo: string; horario: string; origem: string; registrada: boolean }[] =
      marcacoes.map((m, idx) => ({
        ordem: idx + 1,
        titulo: idx % 2 === 0 ? 'Entrada' : 'Saída',
        horario: m.horario,
        origem: m.fonte,
        registrada: true,
      }));
    if (marcacoes.length % 2 === 1) {
      items.push({
        ordem: items.length + 1,
        titulo: 'Saída',
        horario: '--:--',
        origem: 'Pendente',
        registrada: false,
      });
    }
    return items;
  });

  readonly competenciaTituloUpper = computed(() => {
    const { ano, mes } = this.state.selectedCompetencia();
    return `${MESES_UPPER[Math.max(0, Math.min(11, mes - 1))]}/${ano}`;
  });

  readonly resumoFrequencia = computed(() => {
    const dias = this.state.espelhoAtual().dias;
    let regulares = 0;
    let pendencias = 0;
    let faltas = 0;
    let semExpediente = 0;
    let aguardando = 0;

    for (const d of dias) {
      if (d.status === 'ABONADA_FERIAS_RECESSO' || d.cargaPrevistaMinutos === 0) {
        semExpediente += 1;
      } else if (d.status === 'REGULAR' || d.status === 'CREDITO') {
        regulares += 1;
      } else if (d.status === 'DEBITO') {
        faltas += 1;
      } else if (d.status === 'INCOMPLETA') {
        pendencias += 1;
      } else {
        aguardando += 1;
      }
    }

    const totalDias = Math.max(1, dias.length - semExpediente);
    const percentualRegulares = Math.min(
      100,
      Math.round(((regulares + aguardando) / totalDias) * 100)
    );
    return {
      totalDias,
      regulares,
      pendencias,
      faltas,
      semExpediente,
      aguardando,
      percentualRegulares,
    };
  });

  readonly donutFrequenciaDash = computed(() => {
    const pct = this.resumoFrequencia().percentualRegulares;
    return `${pct} ${100 - pct}`;
  });

  abrirCadastroFacial(): void {
    this.modalFacialModo.set('cadastro');
    this.modalFacialAberta.set(true);
  }

  acionarRegistroPonto(): void {
    if (this.state.exigeValidacaoFacialNaProxima()) {
      this.modalFacialModo.set('marcacao');
      this.modalFacialAberta.set(true);
    } else {
      this.state.registrarMarcacaoHoje('WEB');
    }
  }

  onBiometriaCadastrada(): void {
    this.state.notificarBiometriaCadastrada();
  }

  onMarcacaoFacialRegistrada(resp: RegistrarPontoFacialResponse): void {
    this.modalFacialAberta.set(false);
    this.state.registrarMarcacaoFacialConfirmada(
      resp.marcacao,
      resp.verificacao.confiancaPct
    );
  }
}
