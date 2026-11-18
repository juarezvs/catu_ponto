import { CommonModule } from '@angular/common';
import { Component, computed, Input, signal } from '@angular/core';
import { TotalTipoHoraItem } from '../../../core/models/ponto.models';

@Component({
  selector: 'app-espelho-aba-totais',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-4">
      <div class="rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs overflow-hidden">
        <div class="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <h3 class="text-xs font-bold text-[#0f172a]">Totais por tipo de hora (9 categorias)</h3>
          <span class="text-[11px] font-semibold text-[#64748b]">
            1–{{ filtrados().length }} de {{ _itens().length }}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-4">Tipo de hora</th>
                <th class="py-2.5 px-3 text-center">Quantidade de registros</th>
                <th class="py-2.5 px-3 text-center">Total de horas</th>
                <th class="py-2.5 px-4 min-w-[180px]">Participação</th>
                <th class="py-2.5 px-4">Saldo / observação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f1f5f9]">
              @for (item of filtrados(); track item.codigo) {
                <tr class="hover:bg-slate-50/80 transition-colors">
                  <td class="py-3 px-4 font-semibold text-[#0f172a]">
                    <span class="inline-flex items-center gap-2">
                      <span class="h-2.5 w-2.5 rounded-full shrink-0" [style.backgroundColor]="item.cor"></span>
                      <span>{{ item.label }}</span>
                    </span>
                  </td>
                  <td class="py-3 px-3 text-center font-mono text-[#475569]">{{ item.quantidadeRegistros }}</td>
                  <td class="py-3 px-3 text-center font-mono font-bold text-[#0f172a]">
                    {{ formatColon(item.totalMinutos, item.codigo === 'BANCO_HORAS') }}
                  </td>
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2.5">
                      <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          class="h-full rounded-full transition-all"
                          [style.backgroundColor]="item.cor"
                          [style.width.%]="Math.min(100, item.participacaoPct)"
                        ></div>
                      </div>
                      <span class="w-12 text-right font-mono text-[11px] font-semibold text-[#334155]">
                        {{ item.participacaoPct.toFixed(1) }}%
                      </span>
                    </div>
                  </td>
                  <td class="py-3 px-4 text-[11px]">
                    @if (item.aguardandoAutorizacao) {
                      <span class="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 font-semibold text-amber-800">
                        Aguardando autorização
                      </span>
                    } @else {
                      <span class="text-[#64748b]">{{ item.saldoObservacao }}</span>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="py-8 text-center text-xs text-[#64748b]">Nenhuma categoria encontrada para os filtros atuais.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Painéis: Distribuição por tipo & Composição do período -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
          <h4 class="text-xs font-bold text-[#0f172a]">Distribuição por tipo</h4>
          <p class="text-[11px] text-[#64748b] mt-0.5">Proporção em relação à carga prevista da competência.</p>
          <div class="mt-3 space-y-2">
            @for (item of _itens(); track item.codigo) {
              @if (item.totalMinutos !== 0) {
                <div class="flex items-center justify-between text-xs">
                  <span class="inline-flex items-center gap-2 text-[#334155]">
                    <span class="h-2 w-2 rounded-full" [style.backgroundColor]="item.cor"></span>
                    {{ item.label }}
                  </span>
                  <strong class="font-mono text-[#0f172a]">{{ item.participacaoPct.toFixed(1) }}%</strong>
                </div>
              }
            }
          </div>
        </div>

        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
          <h4 class="text-xs font-bold text-[#0f172a]">Composição do período</h4>
          <p class="text-[11px] text-[#64748b] mt-0.5">Resumo de regularidade, excedentes e ausências.</p>
          <div class="mt-3 grid grid-cols-2 gap-2.5 text-xs">
            <div class="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
              <span class="block text-[10px] text-[#64748b]">Previsto total</span>
              <strong class="font-mono text-sm text-[#0f172a]">{{ formatColon(previstoMinutos) }}</strong>
            </div>
            <div class="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5">
              <span class="block text-[10px] text-[#64748b]">Ajustes / Solicitações</span>
              <strong class="font-mono text-sm text-[#003b80]">{{ quantidadeAjustes }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class EspelhoAbaTotaisComponent {
  protected readonly Math = Math;
  readonly _itens = signal<readonly TotalTipoHoraItem[]>([]);
  private readonly _search = signal<string>('');

  @Input() set itens(val: readonly TotalTipoHoraItem[]) {
    this._itens.set([...(val ?? [])].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')));
  }
  @Input() set searchTerm(val: string) {
    this._search.set(val ?? '');
  }
  @Input() previstoMinutos = 0;
  @Input() quantidadeAjustes = 0;

  readonly filtrados = computed(() => {
    const q = this._search()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const list = this._itens();
    if (!q) return list;
    return list.filter((i) =>
      `${i.label} ${i.saldoObservacao}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(q)
    );
  });

  formatColon(min: number, comSinal = false): string {
    const abs = Math.abs(min);
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    if (!comSinal || min === 0) return base;
    return min > 0 ? `+${base}` : `-${base}`;
  }
}
