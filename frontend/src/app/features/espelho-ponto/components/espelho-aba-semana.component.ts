import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { ApuracaoDiaria } from '../../../core/models/ponto.models';

@Component({
  selector: 'app-espelho-aba-semana',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-4">
      <!-- Navegação de Semana + Filtro -->
      <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="anteriorSemana()"
            [disabled]="semanaIdx() <= 0"
            class="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            ← Anterior
          </button>
          <span class="px-3 py-1 rounded-lg bg-[#eef4fb] text-[#003b80] text-xs font-bold">
            {{ semanaAtual().titulo }}: {{ semanaAtual().periodo }}
          </span>
          <button
            type="button"
            (click)="proximaSemana()"
            [disabled]="semanaIdx() >= semanas().length - 1"
            class="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
          >
            Próxima →
          </button>
        </div>

        <span class="text-[11px] font-semibold text-[#64748b]">
          1–{{ diasSemanaFiltrados().length }} de {{ semanaAtual().dias.length }} dias na semana
        </span>
      </div>

      <!-- Tabela Compacta da Semana -->
      <div class="rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3 text-center w-10">SIT.</th>
                <th class="py-2.5 px-3 whitespace-nowrap">DATA</th>
                <th class="py-2.5 px-3 min-w-[160px]">MARCAÇÕES</th>
                <th class="py-2.5 px-2.5 text-center">EXIGÍVEL</th>
                <th class="py-2.5 px-2.5 text-center">COMPUTÁVEL</th>
                <th class="py-2.5 px-2.5 text-center text-emerald-700">CRÉDITO</th>
                <th class="py-2.5 px-2.5 text-center text-rose-700">DÉBITO</th>
                <th class="py-2.5 px-2.5 text-center">AUTORIZADO</th>
                <th class="py-2.5 px-2.5 text-center">PENDENTE</th>
                <th class="py-2.5 px-2.5 text-center">SALDO</th>
                <th class="py-2.5 px-3">OCORRÊNCIAS</th>
                <th class="py-2.5 px-2 text-center sticky right-0 bg-[#f8fafc] border-l border-[#e2e8f0]">AÇÕES</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f1f5f9] text-[#334155]">
              @for (d of diasSemanaFiltrados(); track d.id) {
                @let saldo = (d.saldoMinutos ?? (d.creditoMinutos - d.debitoMinutos));
                <tr (click)="diaSelecionado.emit(d)" class="hover:bg-[#f0f7ff]/70 cursor-pointer transition-colors">
                  <td class="py-2.5 px-3 text-center">
                    @if (d.conferenciaStatus === 'AGUARDANDO') {
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-amber-500 text-amber-600 text-[10px] font-bold" [title]="d.statusLabel">◷</span>
                    } @else if (d.status === 'INCOMPLETA' || d.status === 'DEBITO') {
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-rose-500 text-rose-600 text-[10px] font-bold" [title]="d.statusLabel">!</span>
                    } @else {
                      <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500 text-emerald-600 text-[10px] font-bold" [title]="d.statusLabel">✓</span>
                    }
                  </td>
                  <td class="py-2.5 px-3 whitespace-nowrap font-medium text-[#0f172a]">
                    {{ d.dataFormatada | slice:0:5 }} <span class="text-[#64748b]">- {{ d.diaSemana | slice:0:3 }}</span>
                  </td>
                  <td class="py-2.5 px-3 font-mono text-[11px]">
                    @if (d.marcacoes.length === 0) {
                      <span class="text-[#94a3b8]">-</span>
                    } @else {
                      <span>{{ formatarMarcacoesSemana(d.marcacoes) }}</span>
                      @if (d.marcacoes.length > 8) {
                        <span class="ml-1 rounded bg-slate-200 px-1 text-[10px] font-bold">+{{ d.marcacoes.length - 8 }}</span>
                      }
                    }
                  </td>
                  <td class="py-2.5 px-2.5 text-center font-mono">{{ formatColon(d.cargaPrevistaMinutos) }}</td>
                  <td class="py-2.5 px-2.5 text-center font-mono font-semibold text-[#003b80]">{{ formatColon(d.trabalhadoMinutos) }}</td>
                  <td class="py-2.5 px-2.5 text-center font-mono text-emerald-700">{{ formatColon(d.creditoMinutos) }}</td>
                  <td class="py-2.5 px-2.5 text-center font-mono text-rose-700">{{ formatColon(d.debitoMinutos) }}</td>
                  <td class="py-2.5 px-2.5 text-center font-mono">{{ formatColon(d.excedenteAutorizadoMinutos ?? 0) }}</td>
                  <td class="py-2.5 px-2.5 text-center font-mono text-amber-700">{{ formatColon(d.excedentePendenteMinutos ?? 0) }}</td>
                  <td class="py-2.5 px-2.5 text-center font-mono font-semibold" [ngClass]="saldo > 0 ? 'text-emerald-700' : saldo < 0 ? 'text-rose-700' : 'text-slate-500'">
                    {{ formatColon(saldo, true) }}
                  </td>
                  <td class="py-2.5 px-3 text-[11px]">{{ d.eventoInstitucional || d.statusLabel }}</td>
                  <td class="py-2.5 px-2 text-center sticky right-0 bg-white border-l border-[#f1f5f9]">
                    <button type="button" (click)="$event.stopPropagation(); diaSelecionado.emit(d)" class="rounded-lg p-1 text-[#64748b] hover:bg-slate-200/70 hover:text-[#002f6c]" title="Ações do dia">⋮</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="12" class="py-8 text-center text-xs text-[#64748b]">Nenhum registro encontrado para os filtros aplicados.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Painéis: Resumo da Semana + Indicadores da Semana -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div class="lg:col-span-8 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
          <div class="flex items-center justify-between gap-2 mb-3">
            <h4 class="text-xs font-bold text-[#0f172a]">Resumo da semana (comparativo diário)</h4>
            <div class="flex items-center gap-3 text-[10px] text-[#64748b]">
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-slate-300"></span>Prevista</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-[#003b80]"></span>Trabalhada</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-amber-500"></span>Extras</span>
              <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-full bg-rose-500"></span>Débito</span>
            </div>
          </div>

          <div class="grid grid-cols-7 gap-2 items-end h-36 pt-4 border-b border-slate-100">
            @for (d of semanaAtual().dias; track d.id) {
              @let maxMin = 600;
              <div
                class="flex flex-col items-center gap-1 h-full justify-end group relative"
                [title]="d.dataFormatada + ': Prev ' + formatColon(d.cargaPrevistaMinutos) + ' | Trab ' + formatColon(d.trabalhadoMinutos)"
              >
                <div class="w-full flex items-end justify-center gap-0.5 h-24">
                  <div class="w-2 rounded-t bg-slate-300 transition-all" [style.height.%]="Math.min(100, (d.cargaPrevistaMinutos / maxMin) * 100)"></div>
                  <div class="w-2 rounded-t bg-[#003b80] transition-all" [style.height.%]="Math.min(100, (d.trabalhadoMinutos / maxMin) * 100)"></div>
                  @if ((d.excedentePendenteMinutos ?? 0) + (d.excedenteAutorizadoMinutos ?? 0) > 0) {
                    <div class="w-2 rounded-t bg-amber-500 transition-all" [style.height.%]="Math.min(100, (((d.excedentePendenteMinutos ?? 0) + (d.excedenteAutorizadoMinutos ?? 0)) / maxMin) * 100)"></div>
                  }
                  @if (d.debitoMinutos > 0) {
                    <div class="w-2 rounded-t bg-rose-500 transition-all" [style.height.%]="Math.min(100, (d.debitoMinutos / maxMin) * 100)"></div>
                  }
                </div>
                <span class="text-[10px] font-semibold text-[#64748b]">{{ d.dataFormatada | slice:0:2 }}</span>
              </div>
            }
          </div>
        </div>

        <div class="lg:col-span-4 rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs flex flex-col justify-between gap-2">
          <div>
            <h4 class="text-xs font-bold text-[#0f172a]">Indicadores da semana</h4>
            <p class="text-[11px] text-[#64748b]">Totais do bloco {{ semanaAtual().periodo }}</p>
          </div>
          <div class="space-y-2 text-xs">
            <div class="flex justify-between">
              <span class="text-[#64748b]">Cumprimento</span>
              <strong class="font-mono text-[#003b80]">{{ semanaAtual().cumprimentoPct }}%</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-[#64748b]">Previsto</span>
              <strong class="font-mono">{{ formatColon(semanaAtual().previsto) }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-[#64748b]">Trabalhado</span>
              <strong class="font-mono text-[#003b80]">{{ formatColon(semanaAtual().trabalhado) }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-[#64748b]">Excedente (Aut. / Pend.)</span>
              <strong class="font-mono text-amber-700">{{ formatColon(semanaAtual().autorizado) }} / {{ formatColon(semanaAtual().pendente) }}</strong>
            </div>
            <div class="flex justify-between">
              <span class="text-[#64748b]">Débito</span>
              <strong class="font-mono text-rose-700">{{ formatColon(semanaAtual().debito) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class EspelhoAbaSemanaComponent {
  protected readonly Math = Math;
  private readonly _dias = signal<readonly ApuracaoDiaria[]>([]);
  private readonly _search = signal<string>('');

  @Input() set dias(val: readonly ApuracaoDiaria[]) {
    this._dias.set(val ?? []);
    const idx = this.semanas().findIndex((s) =>
      s.dias.some((d) => d.dataIso === new Date().toISOString().slice(0, 10))
    );
    if (idx >= 0) {
      this.semanaIdx.set(idx);
    } else {
      this.semanaIdx.set(0);
    }
  }
  @Input() set searchTerm(val: string) {
    this._search.set(val ?? '');
  }
  @Output() diaSelecionado = new EventEmitter<ApuracaoDiaria>();

  readonly semanaIdx = signal<number>(0);

  readonly semanas = computed(() => {
    const list = this._dias();
    const out: {
      titulo: string;
      periodo: string;
      dias: ApuracaoDiaria[];
      previsto: number;
      trabalhado: number;
      autorizado: number;
      pendente: number;
      debito: number;
      cumprimentoPct: number;
    }[] = [];

    for (let i = 0; i < list.length; i += 7) {
      const slice = list.slice(i, i + 7);
      if (slice.length === 0) continue;
      const previsto = slice.reduce((a, d) => a + d.cargaPrevistaMinutos, 0);
      const trabalhado = slice.reduce((a, d) => a + d.trabalhadoMinutos, 0);
      const autorizado = slice.reduce((a, d) => a + (d.excedenteAutorizadoMinutos ?? 0), 0);
      const pendente = slice.reduce((a, d) => a + (d.excedentePendenteMinutos ?? 0), 0);
      const debito = slice.reduce((a, d) => a + d.debitoMinutos, 0);
      out.push({
        titulo: `Semana ${out.length + 1}`,
        periodo: `${slice[0].dataFormatada} a ${slice[slice.length - 1].dataFormatada}`,
        dias: slice,
        previsto,
        trabalhado,
        autorizado,
        pendente,
        debito,
        cumprimentoPct: previsto > 0 ? Math.min(100, Math.round((trabalhado / previsto) * 100)) : 0,
      });
    }
    return out;
  });

  readonly semanaAtual = computed(() => {
    const list = this.semanas();
    const idx = Math.max(0, Math.min(this.semanaIdx(), Math.max(0, list.length - 1)));
    return (
      list[idx] ?? {
        titulo: 'Semana 1',
        periodo: '-',
        dias: [],
        previsto: 0,
        trabalhado: 0,
        autorizado: 0,
        pendente: 0,
        debito: 0,
        cumprimentoPct: 0,
      }
    );
  });

  readonly diasSemanaFiltrados = computed(() => {
    const q = this._search()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const list = this.semanaAtual().dias;
    if (!q) return list;
    return list.filter((d) => {
      const texto = `${d.dataFormatada} ${d.diaSemana} ${d.statusLabel} ${d.eventoInstitucional ?? ''}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
      return texto.includes(q);
    });
  });

  anteriorSemana(): void {
    this.semanaIdx.update((i) => Math.max(0, i - 1));
  }

  proximaSemana(): void {
    this.semanaIdx.update((i) => Math.min(Math.max(0, this.semanas().length - 1), i + 1));
  }

  formatarMarcacoesSemana(marcacoes: ApuracaoDiaria['marcacoes']): string {
    return marcacoes
      .slice(0, 8)
      .map((m) => m.horario.slice(0, 5) + (m.ajustada ? '*' : ''))
      .join(' - ');
  }

  formatColon(min: number, comSinal = false): string {
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!comSinal || min === 0) return base;
    return min > 0 ? `+${base}` : `-${base}`;
  }
}
