import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MarcacaoBruta } from '../../../core/models/ponto.models';

@Component({
  selector: 'app-timeline-marcacoes',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="card-surface bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 class="text-sm font-bold text-[#002f6c]">
            Timeline Cronológica do Dia ({{ marcacoes.length }}/{{ limiteMarcacoes }} contabilizadas)
          </h3>
          <p class="text-xs text-[#97999b] mt-0.5">
            Fuso oficial da unidade: <strong class="text-slate-700">{{ fusoHorario }}</strong> • Registros brutos imutáveis
          </p>
        </div>

        <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
          Máx. {{ limiteMarcacoes }} marcações/dia (Seção 7.2)
        </span>
      </div>

      @if (marcacoes.length === 0) {
        <div class="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
          <p class="text-xs font-semibold text-slate-700">
            Nenhuma marcação registrada hoje até o momento.
          </p>
          <p class="text-[11px] text-slate-500 mt-1">
            A 1ª marcação via portal web exige validação por reconhecimento facial obrigatória.
          </p>
        </div>
      } @else {
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          @for (marc of marcacoes; track marc.id) {
            <div class="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 flex flex-col gap-1.5">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[11px] font-bold text-[#002f6c]">
                  {{ marc.ordemDia }}ª • {{ marc.tipoClassificado }}
                </span>

                <!-- Badge de origem bruta (REP, FACIAL, AFD, WEB) -->
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase"
                  [ngClass]="{
                    'bg-emerald-100 text-[#007a33]': marc.fonte === 'FACIAL',
                    'bg-blue-100 text-[#002f6c]': marc.fonte === 'REP',
                    'bg-indigo-100 text-indigo-800': marc.fonte === 'AFD',
                    'bg-amber-100 text-amber-800': marc.fonte === 'WEB'
                  }"
                >
                  {{ marc.fonte }}
                </span>
              </div>

              <strong class="text-xl font-mono font-bold text-slate-900">
                {{ marc.horario }}
              </strong>

              <span class="text-[11px] text-slate-600 truncate" [title]="marc.equipamentoOuOrigem">
                {{ marc.equipamentoOuOrigem }}
              </span>

              <div class="pt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-[#97999b]">
                <span class="font-mono">SHA-256: {{ marc.hashSha256 | slice:0:12 }}...</span>
                <span class="font-semibold text-[#007a33]">Imutável</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class TimelineMarcacoesComponent {
  @Input() marcacoes: readonly MarcacaoBruta[] = [];
  @Input() fusoHorario = 'America/Manaus';
  @Input() limiteMarcacoes = 6;
}
