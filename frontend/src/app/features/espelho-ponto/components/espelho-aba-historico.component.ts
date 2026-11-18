import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HistoricoAjusteItem } from '../../../core/models/ponto.models';

@Component({
  selector: 'app-espelho-aba-historico',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-4">
      <!-- 5 Cartões Resumo -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div class="rounded-xl border border-[#e2e8f0] bg-white p-3 shadow-2xs">
          <span class="block text-[10px] font-semibold text-[#64748b]">Ajustes realizados</span>
          <strong class="block text-xl font-extrabold text-[#0f172a] mt-0.5">{{ _itens().length }}</strong>
        </div>
        <div class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 shadow-2xs">
          <span class="block text-[10px] font-semibold text-emerald-700">Aprovados</span>
          <strong class="block text-xl font-extrabold text-emerald-700 mt-0.5">{{ contarStatus('APROVADO') }}</strong>
        </div>
        <div class="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-2xs">
          <span class="block text-[10px] font-semibold text-amber-800">Em análise</span>
          <strong class="block text-xl font-extrabold text-amber-700 mt-0.5">{{ contarStatus('EM_ANALISE') }}</strong>
        </div>
        <div class="rounded-xl border border-rose-200 bg-rose-50/50 p-3 shadow-2xs">
          <span class="block text-[10px] font-semibold text-rose-700">Reprovados</span>
          <strong class="block text-xl font-extrabold text-rose-700 mt-0.5">{{ contarStatus('REPROVADO') }}</strong>
        </div>
        <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-2xs">
          <span class="block text-[10px] font-semibold text-slate-600">Cancelado</span>
          <strong class="block text-xl font-extrabold text-slate-700 mt-0.5">{{ contarStatus('CANCELADO') }}</strong>
        </div>
      </div>

      <!-- Tabela Histórico -->
      <div class="rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs overflow-hidden">
        <div class="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex items-center justify-between">
          <h3 class="text-xs font-bold text-[#0f172a]">Histórico de solicitações e ajustes</h3>
          <span class="text-[11px] font-semibold text-[#64748b]">
            {{ filtrados().length === 0 ? '0 de 0' : (pageStart() + 1) + '–' + pageEnd() + ' de ' + filtrados().length }}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3">Data solicitação</th>
                <th class="py-2.5 px-3">Período</th>
                <th class="py-2.5 px-3">Tipo de ajuste</th>
                <th class="py-2.5 px-3">Data afetada</th>
                <th class="py-2.5 px-3">Status</th>
                <th class="py-2.5 px-3">Aprovado por</th>
                <th class="py-2.5 px-2 text-center">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f1f5f9] text-[#334155]">
              @for (item of paginados(); track item.id) {
                <tr class="hover:bg-slate-50/80 transition-colors">
                  <td class="py-2.5 px-3 font-mono whitespace-nowrap">{{ item.dataSolicitacao }}</td>
                  <td class="py-2.5 px-3 whitespace-nowrap">{{ item.periodo }}</td>
                  <td class="py-2.5 px-3 font-semibold text-[#0f172a]">{{ item.tipoAjuste }}</td>
                  <td class="py-2.5 px-3 font-mono whitespace-nowrap">{{ item.dataAfetada }}</td>
                  <td class="py-2.5 px-3">
                    <span
                      class="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      [ngClass]="{
                        'bg-emerald-50 text-emerald-700 border border-emerald-200': item.status === 'APROVADO',
                        'bg-amber-50 text-amber-800 border border-amber-200': item.status === 'EM_ANALISE',
                        'bg-rose-50 text-rose-700 border border-rose-200': item.status === 'REPROVADO',
                        'bg-slate-100 text-slate-600 border border-slate-200': item.status === 'CANCELADO'
                      }"
                    >
                      {{ item.statusLabel }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 text-[11px]">{{ item.aprovadoPor || '-' }}</td>
                  <td class="py-2.5 px-2 text-center">
                    <button type="button" (click)="detalhe.set(item)" class="rounded-lg px-2 py-1 text-xs font-semibold text-[#003b80] hover:bg-blue-50">
                      Ver
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="py-10 text-center text-xs text-[#64748b]">
                    Nenhuma solicitação registrada para esta competência.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (filtrados().length > 0) {
          <div class="px-4 py-2.5 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 text-[#64748b]">
              <span>Por página:</span>
              <select [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)" class="h-7 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold">
                @for (sz of [10, 20, 30, 50]; track sz) {
                  <option [ngValue]="sz">{{ sz }}</option>
                }
              </select>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" (click)="page.set(1)" [disabled]="page() === 1" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">«</button>
              <button type="button" (click)="page.set(page() - 1)" [disabled]="page() === 1" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">‹</button>
              <span class="px-2.5 font-semibold">{{ page() }} / {{ totalPages() }}</span>
              <button type="button" (click)="page.set(page() + 1)" [disabled]="page() >= totalPages()" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">›</button>
              <button type="button" (click)="page.set(totalPages())" [disabled]="page() >= totalPages()" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">»</button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Modal Detalhe Solicitação -->
    @if (detalhe(); as item) {
      <div class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-5 py-3.5 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 class="text-sm font-bold">Detalhe da Solicitação</h3>
            <button type="button" (click)="detalhe.set(null)" class="text-blue-200 hover:text-white">✕</button>
          </div>
          <div class="p-5 space-y-2.5 text-xs">
            <div class="flex justify-between"><span class="text-slate-500">Tipo:</span><strong>{{ item.tipoAjuste }}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Data afetada:</span><strong>{{ item.dataAfetada }}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Status:</span><strong>{{ item.statusLabel }}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Responsável:</span><strong>{{ item.aprovadoPor || '-' }}</strong></div>
            <div class="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <span class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Justificativa</span>
              <p class="text-slate-800">{{ item.justificativa }}</p>
            </div>
          </div>
          <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              (click)="novaSimilar.emit(item); detalhe.set(null)"
              class="h-8 px-3 rounded-lg bg-[#003b80] text-white text-xs font-semibold"
            >
              Nova similar
            </button>
            <button type="button" (click)="detalhe.set(null)" class="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold">
              Fechar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EspelhoAbaHistoricoComponent {
  readonly _itens = signal<readonly HistoricoAjusteItem[]>([]);
  private readonly _search = signal<string>('');

  @Input() set itens(val: readonly HistoricoAjusteItem[]) {
    this._itens.set(val ?? []);
    this.page.set(1);
  }
  @Input() set searchTerm(val: string) {
    this._search.set(val ?? '');
    this.page.set(1);
  }
  @Output() novaSimilar = new EventEmitter<HistoricoAjusteItem>();

  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly detalhe = signal<HistoricoAjusteItem | null>(null);

  readonly filtrados = computed(() => {
    const q = this._search()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const list = this._itens();
    if (!q) return list;
    return list.filter((i) =>
      `${i.tipoAjuste} ${i.dataAfetada} ${i.statusLabel} ${i.justificativa}`
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .includes(q)
    );
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtrados().length / this.pageSize())));
  readonly pageStart = computed(() => (this.page() - 1) * this.pageSize());
  readonly pageEnd = computed(() => Math.min(this.filtrados().length, this.pageStart() + this.pageSize()));
  readonly paginados = computed(() => this.filtrados().slice(this.pageStart(), this.pageEnd()));

  setPageSize(sz: number): void {
    this.pageSize.set(sz);
    this.page.set(1);
  }

  contarStatus(st: HistoricoAjusteItem['status']): number {
    return this._itens().filter((i) => i.status === st).length;
  }
}
