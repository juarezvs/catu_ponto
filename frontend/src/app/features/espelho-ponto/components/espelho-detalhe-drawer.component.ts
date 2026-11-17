import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ApuracaoDiaria,
  SolicitacaoAjustePayload,
} from '../../../core/models/ponto.models';
import { formatarMinutos } from '../../../core/services/secp-ponto-state.service';
import { SearchableSelectComponent } from '../../../shared/components/searchable-select.component';

@Component({
  selector: 'app-espelho-detalhe-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  template: `
    @if (dia) {
      <div class="fixed inset-0 bg-slate-900/40 z-50 flex justify-end" role="dialog" aria-modal="true">
        <div class="w-full max-w-lg bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden">
          <!-- Cabeçalho do Drawer -->
          <div class="px-6 py-4 bg-[#002f6c] text-white flex items-center justify-between">
            <div>
              <span class="text-[11px] uppercase tracking-wider text-blue-200 font-semibold">
                Memória de Cálculo Diária
              </span>
              <h3 class="text-base font-bold">
                {{ dia.dataFormatada }} • {{ dia.diaSemana }}
              </h3>
            </div>
            <button
              type="button"
              (click)="fechar.emit()"
              class="p-1.5 rounded-lg hover:bg-white/10 text-blue-100"
              aria-label="Fechar detalhes do dia"
            >
              ✕
            </button>
          </div>

          <!-- Corpo -->
          <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-5 text-xs">
            <!-- Resumo numérico -->
            <div class="grid grid-cols-3 gap-2.5">
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span class="text-[#97999b] block">Prevista</span>
                <strong class="text-sm font-mono text-slate-900">{{ formatMin(dia.cargaPrevistaMinutos) }}</strong>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span class="text-[#97999b] block">Trabalhado</span>
                <strong class="text-sm font-mono text-[#002f6c]">{{ formatMin(dia.trabalhadoMinutos) }}</strong>
              </div>
              <div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span class="text-[#97999b] block">Saldo Dia</span>
                <strong
                  class="text-sm font-mono"
                  [ngClass]="dia.creditoMinutos > 0 ? 'text-[#007a33]' : dia.debitoMinutos > 0 ? 'text-rose-600' : 'text-slate-700'"
                >
                  {{ dia.creditoMinutos > 0 ? formatMin(dia.creditoMinutos, true) : dia.debitoMinutos > 0 ? formatMin(-dia.debitoMinutos, true) : '00h00' }}
                </strong>
              </div>
            </div>

            <!-- Parâmetros da Memória de Cálculo -->
            <div class="rounded-xl border border-slate-200 p-4 flex flex-col gap-2 bg-slate-50/50">
              <h4 class="font-bold text-[#002f6c]">Parâmetros Aplicados na Apuração</h4>
              <div class="flex justify-between">
                <span class="text-slate-500">Jornada vigente:</span>
                <strong class="text-slate-800">{{ dia.memoriaCalculo.jornadaAplicada }}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Janela de expediente:</span>
                <strong class="text-slate-800">{{ dia.memoriaCalculo.janelaExpediente }}</strong>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500">Intervalo (exigido / realizado):</span>
                <strong class="text-slate-800">
                  {{ dia.memoriaCalculo.intervaloExigidoMinutos }} min / {{ dia.memoriaCalculo.intervaloRealizadoMinutos }} min
                </strong>
              </div>
              <p class="text-[11px] text-slate-600 pt-2 border-t border-slate-200">
                {{ dia.memoriaCalculo.regraPortaria }}
              </p>
              @for (obs of dia.memoriaCalculo.observacoes; track $index) {
                <p class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  {{ obs }}
                </p>
              }
            </div>

            <!-- Marcações Brutas Imutáveis -->
            <div>
              <h4 class="font-bold text-slate-900 mb-2">Marcações Brutas Registradas</h4>
              @if (dia.marcacoes.length === 0) {
                <p class="text-slate-500 italic">Sem registros biométricos neste dia.</p>
              } @else {
                <div class="flex flex-col gap-2">
                  @for (m of dia.marcacoes; track m.id) {
                    <div class="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <strong class="font-mono text-sm text-slate-900">{{ m.horario }}</strong>
                        <span class="ml-2 font-semibold text-[#002f6c]">{{ m.tipoClassificado }}</span>
                        <span class="block text-[11px] text-slate-500">{{ m.equipamentoOuOrigem }}</span>
                      </div>
                      <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {{ m.fonte }}
                      </span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Gatilho para Solicitação de Ajuste (Bloqueado se enviada/homologada - Seção 7.5) -->
            <div class="pt-4 border-t border-slate-200">
              <h4 class="font-bold text-[#002f6c] mb-2">Solicitação de Ajuste / Compensação</h4>

              @if (bloqueadoParaEdicao) {
                <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900">
                  <strong>Competência Bloqueada (Seção 7.5):</strong>
                  <p class="mt-1">
                    Esta competência já foi enviada para homologação ou está homologada. Novas solicitações de ajuste estão bloqueadas.
                  </p>
                </div>
              } @else if (!formAberto()) {
                <button
                  type="button"
                  (click)="formAberto.set(true)"
                  class="w-full h-10 rounded-xl bg-[#007a33] hover:bg-[#005e27] text-white font-bold transition"
                >
                  + Solicitar Ajuste ou Justificativa para este Dia
                </button>
              } @else {
                <form (submit)="onSubmit($event)" class="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <div>
                    <label class="font-semibold text-slate-700 block mb-1">Tipo de Solicitação</label>
                    <app-searchable-select
                      [(ngModel)]="tipoSolicitacao"
                      name="tipo"
                      [required]="true"
                      [options]="tiposSolicitacaoOptions"
                      searchPlaceholder="Pesquisar tipo..."
                    />
                  </div>
                  <div>
                    <label class="font-semibold text-slate-700 block mb-1">Horário Sugerido (se ajuste)</label>
                    <input type="time" [(ngModel)]="horarioSugerido" name="horario" class="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                  </div>
                  <div>
                    <label class="font-semibold text-slate-700 block mb-1">Justificativa (mín. 10 caracteres)</label>
                    <textarea [(ngModel)]="justificativa" name="justificativa" rows="3" required minlength="10" class="w-full p-2.5 rounded-lg border border-slate-300 bg-white" placeholder="Descreva o motivo para análise da chefia..."></textarea>
                  </div>
                  <div class="flex justify-end gap-2">
                    <button type="button" (click)="formAberto.set(false)" class="h-8 px-3 rounded-lg border border-slate-300 bg-white font-semibold">Cancelar</button>
                    <button type="submit" class="h-8 px-4 rounded-lg bg-[#002f6c] text-white font-bold">Enviar à Chefia</button>
                  </div>
                </form>
              }
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class EspelhoDetalheDrawerComponent {
  @Input() dia: ApuracaoDiaria | null = null;
  @Input() bloqueadoParaEdicao = false;
  @Output() fechar = new EventEmitter<void>();
  @Output() enviarSolicitacao = new EventEmitter<SolicitacaoAjustePayload>();

  readonly formAberto = signal<boolean>(false);
  readonly tiposSolicitacaoOptions = [
    { value: 'AJUSTE_PONTO', label: 'Ajuste de Marcação Esquecida' },
    { value: 'COMPENSACAO', label: 'Compensação em Banco de Horas' },
    { value: 'ABONO_JUSTIFICATIVA', label: 'Abono / Justificativa Legal' },
  ];
  tipoSolicitacao: SolicitacaoAjustePayload['tipo'] = 'AJUSTE_PONTO';
  horarioSugerido = '15:00';
  justificativa = '';

  formatMin(min: number, comSinal = false): string {
    return formatarMinutos(min, comSinal);
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (!this.dia || this.justificativa.trim().length < 10) {
      return;
    }
    this.enviarSolicitacao.emit({
      dataIso: this.dia.dataIso,
      tipo: this.tipoSolicitacao,
      horarioSugerido: this.horarioSugerido,
      justificativa: this.justificativa.trim(),
    });
    this.justificativa = '';
    this.formAberto.set(false);
  }
}
