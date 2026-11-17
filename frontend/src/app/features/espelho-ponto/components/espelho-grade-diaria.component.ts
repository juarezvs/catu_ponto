import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import {
  ApuracaoDiaria,
  StatusApuracaoDia,
} from '../../../core/models/ponto.models';
import { formatarMinutos } from '../../../core/services/secp-ponto-state.service';

@Component({
  selector: 'app-espelho-grade-diaria',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-surface bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <!-- Barra de Filtros por Ocorrência -->
      <div class="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-1.5">
          @for (f of filtros; track f.valor) {
            <button
              type="button"
              (click)="filtroAtivo.set(f.valor)"
              class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              [ngClass]="
                filtroAtivo() === f.valor
                  ? 'bg-[#002f6c] text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              "
            >
              {{ f.label }}
            </button>
          }
        </div>

        <span class="text-xs text-[#97999b]">
          {{ diasFiltrados().length }} registro(s) • Clique em um dia para abrir a memória de cálculo
        </span>
      </div>

      <!-- Tabela Diária -->
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-[#97999b] uppercase tracking-wider">
              <th (click)="alternarOrdenacao('data')" class="py-3 px-4 cursor-pointer select-none hover:bg-slate-100 hover:text-[#002f6c] transition">
                Data <span class="text-[10px]">{{ sortBy() === 'data' ? (sortDir() === 'asc' ? '▲' : '▼') : '⇅' }}</span>
              </th>
              <th (click)="alternarOrdenacao('prevista')" class="py-3 px-4 cursor-pointer select-none hover:bg-slate-100 hover:text-[#002f6c] transition">
                Prevista <span class="text-[10px]">{{ sortBy() === 'prevista' ? (sortDir() === 'asc' ? '▲' : '▼') : '⇅' }}</span>
              </th>
              <th class="py-3 px-4">Marcações &amp; Fonte Bruta</th>
              <th (click)="alternarOrdenacao('trabalhado')" class="py-3 px-4 cursor-pointer select-none hover:bg-slate-100 hover:text-[#002f6c] transition">
                Trabalhado <span class="text-[10px]">{{ sortBy() === 'trabalhado' ? (sortDir() === 'asc' ? '▲' : '▼') : '⇅' }}</span>
              </th>
              <th (click)="alternarOrdenacao('saldo')" class="py-3 px-4 cursor-pointer select-none hover:bg-slate-100 hover:text-[#002f6c] transition">
                Crédito / Débito <span class="text-[10px]">{{ sortBy() === 'saldo' ? (sortDir() === 'asc' ? '▲' : '▼') : '⇅' }}</span>
              </th>
              <th (click)="alternarOrdenacao('situacao')" class="py-3 px-4 cursor-pointer select-none hover:bg-slate-100 hover:text-[#002f6c] transition">
                Situação <span class="text-[10px]">{{ sortBy() === 'situacao' ? (sortDir() === 'asc' ? '▲' : '▼') : '⇅' }}</span>
              </th>
              <th class="py-3 px-4 text-right">Memória</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 text-xs text-slate-700">
            @for (dia of diasFiltrados(); track dia.id) {
              <tr
                (click)="diaSelecionado.emit(dia)"
                class="hover:bg-blue-50/40 cursor-pointer transition-colors"
                [ngClass]="selectedDiaId === dia.id ? 'bg-blue-50/70' : ''"
              >
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <strong class="text-slate-900 block">{{ dia.dataFormatada }}</strong>
                  <span class="text-[11px] text-[#97999b]">{{ dia.diaSemana }}</span>
                </td>

                <td class="py-3.5 px-4 font-mono">
                  {{ formatMin(dia.cargaPrevistaMinutos) }}
                </td>

                <td class="py-3.5 px-4">
                  @if (dia.eventoInstitucional) {
                    <span class="text-xs font-medium text-[#002f6c]">
                      {{ dia.eventoInstitucional }}
                    </span>
                  } @else if (dia.marcacoes.length === 0) {
                    <span class="text-[#97999b]">Sem marcações</span>
                  } @else {
                    <div class="flex flex-wrap gap-1.5">
                      @for (m of dia.marcacoes; track m.id) {
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px]">
                          <strong class="text-slate-900">{{ m.horario | slice:0:5 }}</strong>
                          <span
                            class="text-[9px] font-sans font-bold px-1 rounded"
                            [ngClass]="{
                              'bg-blue-100 text-[#002f6c]': m.fonte === 'REP',
                              'bg-emerald-100 text-[#007a33]': m.fonte === 'FACIAL',
                              'bg-indigo-100 text-indigo-800': m.fonte === 'AFD',
                              'bg-amber-100 text-amber-800': m.fonte === 'WEB'
                            }"
                          >
                            {{ m.fonte }}
                          </span>
                        </span>
                      }
                    </div>
                  }
                </td>

                <td class="py-3.5 px-4 font-mono font-semibold text-slate-900">
                  {{ formatMin(dia.trabalhadoMinutos) }}
                </td>

                <td class="py-3.5 px-4 font-mono whitespace-nowrap">
                  @if (dia.creditoMinutos > 0) {
                    <span class="text-[#007a33] font-bold">{{ formatMin(dia.creditoMinutos, true) }}</span>
                  } @else if (dia.debitoMinutos > 0) {
                    <span class="text-rose-600 font-bold">{{ formatMin(-dia.debitoMinutos, true) }}</span>
                  } @else {
                    <span class="text-[#97999b]">00h00</span>
                  }
                </td>

                <td class="py-3.5 px-4">
                  <span
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                    [ngClass]="{
                      'bg-emerald-100 text-[#007a33]': dia.status === 'REGULAR' || dia.status === 'CREDITO',
                      'bg-rose-100 text-rose-800': dia.status === 'DEBITO',
                      'bg-amber-100 text-amber-800': dia.status === 'INCOMPLETA',
                      'bg-blue-100 text-[#002f6c]': dia.status === 'ABONADA_FERIAS_RECESSO'
                    }"
                  >
                    {{ dia.statusLabel }}
                  </span>
                </td>

                <td class="py-3.5 px-4 text-right">
                  <button
                    type="button"
                    (click)="$event.stopPropagation(); diaSelecionado.emit(dia)"
                    class="text-xs font-semibold text-[#002f6c] hover:underline"
                  >
                    Detalhar &rarr;
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class EspelhoGradeDiariaComponent {
  private readonly _dias = signal<readonly ApuracaoDiaria[]>([]);
  @Input() set dias(value: readonly ApuracaoDiaria[]) {
    this._dias.set(value ?? []);
  }
  @Input() selectedDiaId: string | null = null;
  @Output() diaSelecionado = new EventEmitter<ApuracaoDiaria>();

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

  readonly diasFiltrados = computed(() => {
    const f = this.filtroAtivo();
    const list = this._dias();
    const filtered = f === 'TODOS' ? [...list] : list.filter((d) => d.status === f);
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
}
