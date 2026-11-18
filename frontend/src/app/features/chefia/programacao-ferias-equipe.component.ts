import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import {
  SearchableSelectComponent,
  SearchableSelectOption,
} from '../../shared/components/searchable-select.component';

interface FeriasPeriodo {
  id: string;
  matricula: string;
  servidorNome: string;
  unidadeSigla: string;
  unidadeNome: string;
  dataInicioIso: string;
  dataFimIso: string;
  dataInicioBr: string;
  dataFimBr: string;
  mes: number;
  dias: number;
  exercicio: string;
  status: 'PROGRAMADA' | 'GOZADA' | 'CANCELADA_ALTERADA' | 'ALTERADA' | 'INATIVA';
  statusLabel: string;
}

interface ServidorEscopo {
  matricula: string;
  nomeFuncional: string;
  unidadeSigla: string;
  unidadeNome: string;
}

const MESES_NOMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

@Component({
  selector: 'app-programacao-ferias-equipe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SearchableSelectComponent],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Breadcrumb -->
      <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-xs text-[#64748b]">
        <a routerLink="/home" class="hover:text-[#002f6c] font-medium transition">Início</a>
        <span>›</span>
        <a routerLink="/chefia/equipe" class="hover:text-[#002f6c] font-medium transition">Minha Equipe</a>
        <span>›</span>
        <span class="font-semibold text-[#334155]">Programação de Férias</span>
      </nav>

      <!-- Cabeçalho Principal -->
      <div class="rounded-2xl border border-[#e2e8f0] bg-white px-5 py-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eef4fb] border border-[#d6e4f5] text-[#003b80]">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 class="text-xl font-extrabold tracking-tight text-[#0f172a]">Programação de Férias</h1>
            <p class="text-xs text-[#64748b] mt-0.5">
              Acompanhe a programação anual de férias da equipe subordinada à sua chefia ({{ state.activePerfil().nome }}).
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <a
            routerLink="/modulo/solicitacoes"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#003b80] hover:bg-[#002a5c] px-4 text-xs font-bold text-white shadow-xs transition"
          >
            Solicitações
          </a>
          <button
            type="button"
            (click)="favoritado.set(!favoritado())"
            class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white px-3.5 text-xs font-semibold text-[#334155] hover:border-[#003b80]/40 hover:text-[#003b80] transition"
          >
            <span>{{ favoritado() ? '★' : '☆' }}</span>
            <span>{{ favoritado() ? 'Favoritado' : 'Favoritar' }}</span>
          </button>
        </div>
      </div>

      <!-- Container Principal do Calendário -->
      <section class="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-2xs flex flex-col gap-4">
        <!-- Barra Superior de Título e Controles de Ano/Filtro -->
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
              📅 Programação de Férias
            </span>
            <h2 class="text-xl font-extrabold tracking-tight text-[#0f172a] mt-0.5">
              Calendário da equipe em {{ ano() }}
            </h2>
            <p class="text-xs text-[#64748b] mt-0.5">
              Visualize as férias da equipe por mês, incluindo períodos programados, gozados, cancelados ou alterados, conforme os dados sincronizados do SARH.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              (click)="carregarFerias()"
              [disabled]="loading()"
              class="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-slate-50 disabled:opacity-50 px-3 text-xs font-semibold text-[#334155] transition"
            >
              <span>↻</span>
              <span>{{ loading() ? 'Sincronizando...' : 'Atualizar SARH' }}</span>
            </button>

            <div class="inline-flex items-center rounded-xl border border-[#cbd5e1] bg-white overflow-hidden">
              <button
                type="button"
                (click)="mudarAno(ano() - 1)"
                class="h-9 px-2.5 text-xs font-bold text-[#475569] hover:bg-slate-100"
                title="Ano anterior"
              >
                &lt;
              </button>
              <button
                type="button"
                (click)="mudarAno(anoAtualSistema)"
                class="h-9 px-3 text-xs font-semibold text-[#334155] border-x border-[#e2e8f0] hover:bg-slate-50"
              >
                Ano atual
              </button>
              <button
                type="button"
                (click)="mudarAno(ano() + 1)"
                class="h-9 px-2.5 text-xs font-bold text-[#475569] hover:bg-slate-100"
                title="Próximo ano"
              >
                &gt;
              </button>
            </div>

            <div class="inline-flex items-center gap-1.5">
              <input
                type="number"
                [(ngModel)]="anoDigitado"
                min="2020"
                max="2035"
                class="h-9 w-20 rounded-xl border border-[#cbd5e1] px-2.5 text-xs font-bold text-[#0f172a] outline-none focus:border-[#003b80]"
              />
              <button
                type="button"
                (click)="mudarAno(anoDigitado)"
                class="h-9 rounded-xl bg-[#003b80] hover:bg-[#002a5c] px-3.5 text-xs font-bold text-white transition"
              >
                Ver ano
              </button>
            </div>

            <button
              type="button"
              (click)="filtrosAbertos.set(!filtrosAbertos())"
              class="inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition"
              [ngClass]="
                filtrosAbertos()
                  ? 'border-[#003b80] bg-[#eef4fb] text-[#003b80]'
                  : 'border-[#cbd5e1] bg-white text-[#334155] hover:bg-slate-50'
              "
            >
              <span>⛭</span>
              <span>Filtrar</span>
            </button>
          </div>
        </div>

        <!-- Barra de Filtros por Servidor, Unidade e Situação -->
        @if (filtrosAbertos()) {
          <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3.5 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label class="block text-[11px] font-bold text-[#475569] mb-1">Filtrar por Servidor</label>
              <app-searchable-select
                [options]="servidorOptions()"
                [ngModel]="filtroServidor()"
                (ngModelChange)="filtroServidor.set($event)"
                placeholder="Todos os servidores..."
                searchPlaceholder="Buscar por nome ou matrícula..."
              />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-[#475569] mb-1">Filtrar por Unidade</label>
              <app-searchable-select
                [options]="unidadeOptions()"
                [ngModel]="filtroUnidade()"
                (ngModelChange)="filtroUnidade.set($event)"
                placeholder="Todas as unidades..."
                searchPlaceholder="Buscar unidade..."
              />
            </div>

            <div>
              <label class="block text-[11px] font-bold text-[#475569] mb-1">Situação</label>
              <app-searchable-select
                [options]="statusOptions"
                [ngModel]="filtroStatus()"
                (ngModelChange)="filtroStatus.set($event)"
                placeholder="Todas as situações..."
                searchPlaceholder="Filtrar situação..."
              />
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="limparFiltros()"
                class="h-9 px-3.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-slate-100 text-xs font-semibold text-[#475569] transition"
              >
                Limpar filtros
              </button>
            </div>
          </div>
        }

        <!-- Banner Sincronização SARH -->
        <div class="rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3 text-xs">
            <span class="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-[#e2e8f0] text-[#003b80]">
              ◷
            </span>
            <div>
              <strong class="block text-[#0f172a]">Sincronização SARH de férias</strong>
              <span class="text-[11px] text-[#64748b]">
                Última gravação de férias no SECP: <strong>{{ ultimaSincronizacao() }}</strong>
              </span>
            </div>
          </div>

          <span class="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
            Mapa atualizado
          </span>
        </div>

        <!-- 4 KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Períodos de férias</span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] mt-1">{{ periodosFiltrados().length }}</strong>
          </div>

          <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Servidores com férias</span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] mt-1">{{ servidoresDistintosCount() }}</strong>
          </div>

          <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Mês com maior concentração</span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] mt-1">{{ mesMaiorConcentracao().nome }}</strong>
          </div>

          <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4">
            <span class="block text-[10px] font-bold uppercase tracking-wider text-[#64748b]">Maior volume mensal</span>
            <strong class="block text-2xl font-extrabold text-[#0f172a] mt-1">{{ mesMaiorConcentracao().total }}</strong>
          </div>
        </div>

        <!-- Legenda de Status -->
        <div class="flex flex-wrap items-center gap-2 text-[11px]">
          <span class="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 font-semibold text-sky-700">
            <span class="h-2 w-2 rounded-full bg-sky-600"></span> Programada
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">
            <span class="h-2 w-2 rounded-full bg-emerald-600"></span> Gozada
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 font-semibold text-rose-700">
            <span class="h-2 w-2 rounded-full bg-rose-600"></span> Cancelada/alterada
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700">
            <span class="h-2 w-2 rounded-full bg-amber-500"></span> Alterada
          </span>
          <span class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">
            <span class="h-2 w-2 rounded-full bg-slate-500"></span> Inativa
          </span>
        </div>

        <!-- Grade 12 Meses (3 colunas) -->
        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          @for (mesCard of calendarioMeses(); track mesCard.numero) {
            <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 flex flex-col gap-3">
              <div class="flex items-center justify-between border-b border-[#f1f5f9] pb-2">
                <h3 class="text-sm font-bold text-[#0f172a]">{{ mesCard.nome }}</h3>
                <span class="rounded-full bg-[#eef4fb] px-2 py-0.5 text-[11px] font-bold text-[#003b80]">
                  {{ mesCard.itens.length }}
                </span>
              </div>

              @if (mesCard.itens.length === 0) {
                <div class="flex-1 flex items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-[#f8fafc]/70 py-8 text-xs text-[#94a3b8]">
                  Sem férias neste mês.
                </div>
              } @else {
                <div class="flex flex-col gap-2">
                  @for (item of mesCard.itens; track item.id) {
                    <div
                      class="rounded-xl border px-3 py-2.5 flex items-start justify-between gap-2 text-xs"
                      [ngClass]="{
                        'border-emerald-200 bg-emerald-50/70': item.status === 'GOZADA',
                        'border-sky-200 bg-sky-50/70': item.status === 'PROGRAMADA',
                        'border-rose-200 bg-rose-50/70': item.status === 'CANCELADA_ALTERADA',
                        'border-amber-200 bg-amber-50/70': item.status === 'ALTERADA',
                        'border-slate-200 bg-slate-50': item.status === 'INATIVA'
                      }"
                    >
                      <div class="min-w-0">
                        <strong class="block text-xs font-extrabold text-[#0f172a] truncate">
                          {{ item.servidorNome }}
                        </strong>
                        <span class="block text-[10px] text-[#475569] truncate">
                          {{ item.unidadeSigla }} {{ item.unidadeNome ? '• ' + item.unidadeNome : '' }}
                        </span>
                        <div class="mt-1 flex items-center gap-1.5 text-[10px]">
                          <span
                            class="font-bold"
                            [ngClass]="{
                              'text-emerald-700': item.status === 'GOZADA',
                              'text-sky-700': item.status === 'PROGRAMADA',
                              'text-rose-700': item.status === 'CANCELADA_ALTERADA',
                              'text-amber-700': item.status === 'ALTERADA',
                              'text-slate-600': item.status === 'INATIVA'
                            }"
                          >
                            {{ item.statusLabel }}
                          </span>
                          <span class="text-[#64748b]">• {{ item.dias }} dia(s)</span>
                          <span class="text-[#64748b]">• Exercício {{ item.exercicio }}</span>
                        </div>
                      </div>

                      <span class="shrink-0 font-mono text-[11px] font-bold text-[#0f172a]">
                        {{ item.dataInicioBr }} a {{ item.dataFimBr }}
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class ProgramacaoFeriasEquipeComponent implements OnInit {
  private readonly http = inject(HttpClient);
  readonly state = inject(SecpPontoStateService);

  readonly anoAtualSistema = new Date().getFullYear();
  readonly ano = signal<number>(this.anoAtualSistema);
  anoDigitado = this.anoAtualSistema;

  readonly loading = signal<boolean>(false);
  readonly favoritado = signal<boolean>(false);
  readonly filtrosAbertos = signal<boolean>(true);
  readonly ultimaSincronizacao = signal<string>('--');

  readonly servidoresEscopo = signal<readonly ServidorEscopo[]>([]);
  readonly periodos = signal<readonly FeriasPeriodo[]>([]);

  readonly filtroServidor = signal<string>('');
  readonly filtroUnidade = signal<string>('');
  readonly filtroStatus = signal<string>('');

  readonly statusOptions: SearchableSelectOption[] = [
    { value: '', label: 'Todas as situações' },
    { value: 'PROGRAMADA', label: 'Programada' },
    { value: 'GOZADA', label: 'Gozada' },
    { value: 'CANCELADA_ALTERADA', label: 'Cancelada/alterada' },
    { value: 'ALTERADA', label: 'Alterada' },
    { value: 'INATIVA', label: 'Inativa' },
  ];

  readonly servidorOptions = computed<SearchableSelectOption[]>(() => [
    { value: '', label: 'Todos os servidores do escopo' },
    ...this.servidoresEscopo().map((s) => ({
      value: s.matricula,
      label: `${s.nomeFuncional} (${s.matricula})${s.unidadeSigla ? ' — ' + s.unidadeSigla : ''}`,
    })),
  ]);

  readonly unidadeOptions = computed<SearchableSelectOption[]>(() => {
    const mapa = new Map<string, string>();
    for (const s of this.servidoresEscopo()) {
      if (s.unidadeSigla) {
        mapa.set(s.unidadeSigla, s.unidadeNome ? `${s.unidadeSigla} — ${s.unidadeNome}` : s.unidadeSigla);
      }
    }
    return [
      { value: '', label: 'Todas as unidades' },
      ...Array.from(mapa.entries()).map(([value, label]) => ({ value, label })),
    ];
  });

  readonly periodosFiltrados = computed(() => {
    const srv = this.filtroServidor();
    const uni = this.filtroUnidade();
    const st = this.filtroStatus();
    return this.periodos().filter((p) => {
      if (srv && p.matricula !== srv) return false;
      if (uni && p.unidadeSigla !== uni) return false;
      if (st && p.status !== st) return false;
      return true;
    });
  });

  readonly servidoresDistintosCount = computed(() => {
    const set = new Set(this.periodosFiltrados().map((p) => p.matricula));
    return set.size;
  });

  readonly calendarioMeses = computed(() => {
    const itens = this.periodosFiltrados();
    return MESES_NOMES.map((nome, idx) => {
      const mesNum = idx + 1;
      return {
        numero: mesNum,
        nome,
        itens: itens.filter((i) => i.mes === mesNum),
      };
    });
  });

  readonly mesMaiorConcentracao = computed(() => {
    let best = { nome: 'Nenhum', total: 0 };
    for (const m of this.calendarioMeses()) {
      if (m.itens.length > best.total) {
        best = { nome: m.nome, total: m.itens.length };
      }
    }
    return best;
  });

  ngOnInit(): void {
    this.carregarFerias();
  }

  mudarAno(novoAno: number): void {
    const clamped = Math.max(2020, Math.min(2035, Number(novoAno) || this.anoAtualSistema));
    this.ano.set(clamped);
    this.anoDigitado = clamped;
    this.carregarFerias();
  }

  limparFiltros(): void {
    this.filtroServidor.set('');
    this.filtroUnidade.set('');
    this.filtroStatus.set('');
  }

  carregarFerias(): void {
    this.loading.set(true);
    const mat = encodeURIComponent(this.state.loggedInMatricula());
    const perfil = encodeURIComponent(this.state.activePerfilCodigo());
    const orgao = encodeURIComponent(this.state.activeOrgao().sigla);
    this.http
      .get<any>(
        `http://127.0.0.1:8000/api/v1/secp/ponto/real/chefia/ferias?matricula=${mat}&perfil=${perfil}&orgao=${orgao}&ano=${this.ano()}`
      )
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.ultimaSincronizacao.set(res?.ultimaSincronizacao || '--');
          this.servidoresEscopo.set(Array.isArray(res?.servidoresEscopo) ? res.servidoresEscopo : []);
          this.periodos.set(Array.isArray(res?.periodos) ? res.periodos : []);
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }
}
