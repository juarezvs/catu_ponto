import { CommonModule } from '@angular/common';
import { Component, computed, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OcorrenciaEspelhoItem } from '../../../core/models/ponto.models';

@Component({
  selector: 'app-espelho-aba-ocorrencias',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col gap-3">
      <!-- Indicadores Resumo -->
      <div class="flex flex-wrap items-center gap-2">
        <span class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
          Dias sem ocorrências: {{ diasSemOcorrencias }}
        </span>
        <span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">
          Extras: {{ contarCat('EXTRA') }}
        </span>
        <span class="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700">
          Atrasos / Débitos: {{ contarCat('ATRASO') }}
        </span>
        <span class="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-800">
          Faltas: {{ contarCat('FALTA') }}
        </span>
        <span class="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold text-sky-800">
          Afastamentos / Outras: {{ contarCat('AFASTAMENTO') + contarCat('OUTRA') }}
        </span>
      </div>

      <!-- Tabela de Ocorrências -->
      <div class="rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs overflow-hidden">
        <div class="px-4 py-3 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-xs font-bold text-[#0f172a]">
            Lista de ocorrências ({{ filtrados().length }} registros)
          </h3>
          <span class="text-[11px] font-semibold text-[#64748b]">
            {{ filtrados().length === 0 ? '0 de 0' : (pageStart() + 1) + '–' + pageEnd() + ' de ' + filtrados().length }}
          </span>
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-3">Data</th>
                <th class="py-2.5 px-3">Dia</th>
                <th class="py-2.5 px-3">Tipo</th>
                <th class="py-2.5 px-3">Período</th>
                <th class="py-2.5 px-3 text-center">Duração</th>
                <th class="py-2.5 px-3">Situação</th>
                <th class="py-2.5 px-3">Justificativa / observação</th>
                <th class="py-2.5 px-2 text-center">Ação</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f1f5f9] text-[#334155]">
              @for (oc of paginados(); track oc.id) {
                <tr class="hover:bg-[#f0f7ff]/60 transition-colors">
                  <td class="py-2.5 px-3 font-mono font-semibold text-[#0f172a] whitespace-nowrap">{{ oc.dataFormatada }}</td>
                  <td class="py-2.5 px-3 text-[#64748b] whitespace-nowrap">{{ oc.diaSemana | slice:0:3 }}</td>
                  <td class="py-2.5 px-3">
                    <span class="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-[#0f172a]">
                      {{ oc.tipo }}
                    </span>
                  </td>
                  <td class="py-2.5 px-3 whitespace-nowrap">{{ oc.periodo }}</td>
                  <td class="py-2.5 px-3 text-center font-mono font-semibold">{{ formatColon(oc.duracaoMinutos) }}</td>
                  <td class="py-2.5 px-3 text-[11px]">{{ oc.situacao }}</td>
                  <td class="py-2.5 px-3 text-[11px] text-[#475569] max-w-[260px] truncate" [title]="oc.justificativa">{{ oc.justificativa }}</td>
                  <td class="py-2.5 px-2 text-center">
                    <button
                      type="button"
                      (click)="detalhe.set(oc)"
                      class="rounded-lg px-2 py-1 text-xs font-semibold text-[#003b80] hover:bg-blue-50"
                      title="Detalhes da ocorrência"
                    >
                      Detalhes
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="py-10 text-center text-xs text-[#64748b]">
                    Nenhuma ocorrência encontrada para os filtros atuais.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginação -->
        @if (filtrados().length > 0) {
          <div class="px-4 py-2.5 border-t border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2 text-[#64748b]">
              <span>Por página:</span>
              <select
                [ngModel]="pageSize()"
                (ngModelChange)="setPageSize($event)"
                class="h-7 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-[#0f172a]"
              >
                @for (sz of [10, 20, 30, 50]; track sz) {
                  <option [ngValue]="sz">{{ sz }}</option>
                }
              </select>
            </div>
            <div class="flex items-center gap-1">
              <button type="button" (click)="page.set(1)" [disabled]="page() === 1" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">«</button>
              <button type="button" (click)="page.set(page() - 1)" [disabled]="page() === 1" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">‹</button>
              <span class="px-2.5 font-semibold text-[#334155]">{{ page() }} / {{ totalPages() }}</span>
              <button type="button" (click)="page.set(page() + 1)" [disabled]="page() >= totalPages()" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">›</button>
              <button type="button" (click)="page.set(totalPages())" [disabled]="page() >= totalPages()" class="px-2 py-1 rounded border border-slate-300 bg-white disabled:opacity-40">»</button>
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Modal Detalhe da Ocorrência -->
    @if (detalhe(); as oc) {
      <div class="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
          <div class="px-5 py-3.5 bg-[#002f6c] text-white flex items-center justify-between">
            <h3 class="text-sm font-bold">Detalhe da Ocorrência</h3>
            <button type="button" (click)="detalhe.set(null)" class="text-blue-200 hover:text-white">✕</button>
          </div>
          <div class="p-5 space-y-2.5 text-xs">
            <div class="flex justify-between"><span class="text-slate-500">Data:</span><strong>{{ oc.dataFormatada }} ({{ oc.diaSemana }})</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Tipo:</span><strong>{{ oc.tipo }}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Duração:</span><strong class="font-mono">{{ formatColon(oc.duracaoMinutos) }}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Situação:</span><strong>{{ oc.situacao }}</strong></div>
            <div class="flex justify-between"><span class="text-slate-500">Origem:</span><strong>{{ oc.origem }}</strong></div>
            <div class="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <span class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Justificativa / Motivo</span>
              <p class="text-slate-800">{{ oc.justificativa }}</p>
            </div>
          </div>
          <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap justify-end gap-2">
            @if (oc.podeSolicitarAutorizacao) {
              <button
                type="button"
                (click)="solicitarAutorizacao.emit(oc); detalhe.set(null)"
                class="h-8 px-3 rounded-lg bg-[#003b80] text-white text-xs font-semibold"
              >
                Solicitar autorização
              </button>
            }
            <button type="button" (click)="detalhe.set(null)" class="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold">
              Fechar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class EspelhoAbaOcorrenciasComponent {
  private readonly _itens = signal<readonly OcorrenciaEspelhoItem[]>([]);
  private readonly _search = signal<string>('');

  @Input() set itens(val: readonly OcorrenciaEspelhoItem[]) {
    this._itens.set([...(val ?? [])].sort((a, b) => a.dataIso.localeCompare(b.dataIso)));
    this.page.set(1);
  }
  @Input() set searchTerm(val: string) {
    this._search.set(val ?? '');
    this.page.set(1);
  }
  @Input() diasSemOcorrencias = 0;
  @Output() solicitarAutorizacao = new EventEmitter<OcorrenciaEspelhoItem>();

  readonly page = signal<number>(1);
  readonly pageSize = signal<number>(10);
  readonly detalhe = signal<OcorrenciaEspelhoItem | null>(null);

  readonly filtrados = computed(() => {
    const q = this._search()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const list = this._itens();
    if (!q) return list;
    return list.filter((o) =>
      `${o.dataFormatada} ${o.tipo} ${o.situacao} ${o.justificativa}`
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

  contarCat(cat: OcorrenciaEspelhoItem['categoria']): number {
    return this.filtrados().filter((o) => o.categoria === cat).length;
  }

  formatColon(min: number): string {
    const abs = Math.abs(min);
    return `${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
  }
}
