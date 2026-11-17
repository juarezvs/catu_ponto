import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BancoHorasResumo,
  EspelhoDia,
  HomologacaoItem,
  MarcacaoPonto,
  PontoDashboard,
} from '../../../../../domain/models/navigation.model';

@Component({
  selector: 'app-ponto-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-6xl mx-auto px-8 py-7 flex flex-col gap-6">
      <!-- =================================================================== -->
      <!-- 1. DASHBOARD INTUITIVO DO SERVIDOR (SPEC 10 + SPEC 11 - secp_antigo) -->
      <!-- =================================================================== -->
      @if (activeSubSlug === 'dashboard' && dashboard) {
        <!-- Saudação + Unidade + Popup Regra Portaria 135/2025 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-xs text-cyan-700 font-semibold mb-1">
              <span>SECP Ponto • Portaria SJAM-DIREF 135/2025</span>
              <span>•</span>
              <span>{{ dashboard.unidadeLabel }}</span>
            </div>
            <h1 class="text-2xl font-bold text-slate-900 tracking-tight">
              Olá, {{ dashboard.servidorNome }}
            </h1>
            <p class="text-xs text-slate-500 mt-0.5">
              {{ dashboard.jornadaNome }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              (click)="showPortariaPopup = !showPortariaPopup"
              class="h-9 px-3 rounded-lg border border-cyan-200 bg-cyan-50/70 hover:bg-cyan-100 text-cyan-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>ℹ</span>
              <span>Regras da Portaria 135</span>
            </button>
          </div>
        </div>

        @if (showPortariaPopup) {
          <div class="bg-white border border-cyan-200 rounded-xl p-4 shadow-sm text-xs text-slate-700 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <strong class="text-cyan-800 block mb-0.5">Jornada &amp; Expediente</strong>
              7h ininterruptas ou 8h com intervalo de 1h a 3h. Expediente ordinário 08h–18h (excepcional 06h–19h).
            </div>
            <div>
              <strong class="text-cyan-800 block mb-0.5">Banco de Horas</strong>
              Limite ordinário de <strong>16h/mês</strong> de crédito e compensação em até <strong>3 meses</strong>.
            </div>
            <div>
              <strong class="text-cyan-800 block mb-0.5">Homologação &amp; Boletim</strong>
              Chefia homologa até o <strong>2º dia útil</strong>; Boletim enviado até o <strong>dia 10</strong>.
            </div>
          </div>
        }

        <!-- PRIMEIRA DOBRA: Card Azul Petróleo de Próxima Ação + 4 Métricas -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div class="lg:col-span-5 rounded-2xl bg-gradient-to-br from-[#0891B2] to-[#0e7490] text-white p-5 shadow-md flex flex-col justify-between">
            <div>
              <span class="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider bg-white/15 px-2.5 py-0.5 rounded-full">
                <span class="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                Próxima Ação Recomendada
              </span>
              <h2 class="text-lg font-bold mt-3 leading-snug">
                {{ dashboard.proximaAcaoLabel }}
              </h2>
              <p class="text-xs text-cyan-100 mt-1">
                @if (dashboard.exigeBiometriaFacial) {
                  1ª marcação do dia via web exige confirmação por reconhecimento facial.
                } @else if (dashboard.proximaAcaoCodigo === 'DIA_COMPLETO') {
                  Todas as 4 posições da jornada de hoje já foram registradas.
                } @else {
                  Classificação automática pela sequência cronológica do dia.
                }
              </p>
            </div>

            <div class="mt-4 flex items-center gap-2.5">
              @if (dashboard.proximaAcaoCodigo !== 'DIA_COMPLETO') {
                <button
                  type="button"
                  (click)="iniciarRegistro(dashboard.exigeBiometriaFacial)"
                  class="px-4 py-2 rounded-xl bg-white text-[#0e7490] hover:bg-cyan-50 text-xs font-bold shadow-sm transition-colors"
                >
                  {{ dashboard.exigeBiometriaFacial ? '📷 Iniciar Biometria Facial' : '⏱ Registrar Horário Agora' }}
                </button>
              }
              <button
                type="button"
                (click)="navegarSubitem.emit('espelho')"
                class="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors"
              >
                Ver Espelho
              </button>
            </div>
          </div>

          <!-- 4 Cards de Métricas do Servidor -->
          <div class="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
              <span class="text-xs font-medium text-slate-500">Jornada Hoje</span>
              <strong class="text-2xl font-bold text-slate-900 mt-2">{{ dashboard.jornadaPrevistaFormatado }}</strong>
              <span class="text-[11px] text-cyan-700 font-semibold mt-1">Prevista</span>
            </div>
            <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
              <span class="text-xs font-medium text-slate-500">Trabalhado Hoje</span>
              <strong class="text-2xl font-bold text-slate-900 mt-2">{{ dashboard.trabalhadoHojeFormatado }}</strong>
              <span class="text-[11px] text-slate-500 mt-1">Apuração em tempo real</span>
            </div>
            <div
              (click)="navegarSubitem.emit('banco-horas')"
              class="bg-white rounded-2xl border border-slate-200 hover:border-cyan-400 p-4 flex flex-col justify-between shadow-sm cursor-pointer transition-colors"
            >
              <span class="text-xs font-medium text-slate-500">Banco de Horas</span>
              <strong class="text-2xl font-bold text-emerald-600 mt-2">{{ dashboard.saldoBancoFormatado }}</strong>
              <span class="text-[11px] text-cyan-700 font-semibold mt-1">Ver extrato &rarr;</span>
            </div>
            <div class="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col justify-between shadow-sm">
              <span class="text-xs font-medium text-slate-500">Pendências</span>
              <strong
                class="text-2xl font-bold mt-2"
                [ngClass]="dashboard.pendenciasCount > 0 ? 'text-amber-600' : 'text-emerald-600'"
              >
                {{ dashboard.pendenciasCount }}
              </strong>
              <span class="text-[11px] text-slate-500 mt-1">
                {{ dashboard.pendenciasCount > 0 ? 'Aguardando 1ª batida' : 'Tudo regular' }}
              </span>
            </div>
          </div>
        </div>

        <!-- PAINEL DE BIOMETRIA FACIAL (SPEC 11) + COMPROVANTE SHA-256 -->
        @if (biometriaModalOpen) {
          <div class="bg-white rounded-2xl border-2 border-cyan-500 p-5 shadow-lg flex flex-col md:flex-row items-center gap-6">
            <div class="w-36 h-36 rounded-full border-4 border-dashed border-cyan-500 bg-slate-900 flex flex-col items-center justify-center text-white shrink-0 relative">
              <span class="text-3xl">👤</span>
              <span class="text-[10px] text-cyan-300 mt-1">Rosto detectado</span>
            </div>
            <div class="flex-1">
              <span class="text-[11px] font-bold uppercase text-cyan-700">Verificação Biométrica Facial • Portaria 135</span>
              <h3 class="text-base font-bold text-slate-900 mt-0.5">
                Centralize seu rosto no círculo e mantenha boa iluminação
              </h3>
              <p class="text-xs text-slate-600 mt-1">
                A evidência facial gera apenas hash SHA-256 auditável vinculada à marcação bruta imutável.
              </p>
              <div class="mt-4 flex items-center gap-2.5">
                <button
                  type="button"
                  (click)="confirmarBiometriaFacial()"
                  class="px-4 py-2 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-bold"
                >
                  Confirmar Captura &amp; Registrar Ponto
                </button>
                <button
                  type="button"
                  (click)="biometriaModalOpen = false"
                  class="px-3 py-2 rounded-lg border border-slate-300 text-slate-600 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        }

        @if (ultimoComprovante) {
          <div class="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div class="text-xs text-emerald-900">
              <strong class="block text-sm">✓ Registro realizado com sucesso! Comprovante gerado.</strong>
              <span>
                Classificação: <strong>{{ ultimoComprovante.tipo }}</strong> às
                <strong>{{ ultimoComprovante.horarioLabel }}</strong> ({{ ultimoComprovante.fonte }}) •
                Hash SHA-256: <code class="font-mono text-[11px]">{{ ultimoComprovante.hashSha256 | slice:0:18 }}...</code>
              </span>
            </div>
          </div>
        }

        <!-- TIMELINE DO DIA (4 POSIÇÕES) + FREQUÊNCIA DO MÊS -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-sm font-bold text-slate-900">Marcações de Hoje (Timeline Sequencial)</h3>
              <span class="text-[11px] text-slate-500">Fuso: America/Manaus (UTC-4)</span>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
              @for (pos of dashboard.timelineDia; track pos.ordem) {
                <div
                  class="rounded-xl border p-3.5 flex flex-col gap-1 transition-all"
                  [ngClass]="
                    pos.concluido
                      ? 'border-cyan-300 bg-cyan-50/50'
                      : 'border-slate-200 bg-slate-50/60'
                  "
                >
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-semibold text-slate-500">{{ pos.ordem }}ª Batida</span>
                    <span
                      class="w-2 h-2 rounded-full"
                      [ngClass]="pos.concluido ? 'bg-cyan-600' : 'bg-slate-300'"
                    ></span>
                  </div>
                  <span class="text-xs font-bold text-slate-800">{{ pos.titulo }}</span>
                  <strong class="text-lg font-mono text-slate-900 mt-1">
                    {{ pos.horario || '--:--' }}
                  </strong>
                  <span class="text-[10px] text-slate-500 truncate">
                    {{ pos.fonte || 'Aguardando' }}
                  </span>
                </div>
              }
            </div>
          </div>

          <div class="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
            <div>
              <h3 class="text-sm font-bold text-slate-900">Frequência do Mês (11/2026)</h3>
              <div class="mt-3 flex items-baseline gap-2">
                <strong class="text-3xl font-bold text-cyan-700">{{ dashboard.frequenciaMesPercentual }}%</strong>
                <span class="text-xs text-slate-500">
                  ({{ dashboard.diasRegularesMes }}/{{ dashboard.diasUteisMes }} dias regulares)
                </span>
              </div>
              <div class="w-full h-2.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
                <div
                  class="h-full bg-[#0891B2] rounded-full"
                  [style.width.%]="dashboard.frequenciaMesPercentual"
                ></div>
              </div>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              <button
                type="button"
                (click)="navegarSubitem.emit('espelho')"
                class="text-xs font-semibold text-cyan-700 hover:underline"
              >
                Espelho de Ponto &rarr;
              </button>
              <button
                type="button"
                (click)="navegarSubitem.emit('homologacao')"
                class="text-xs font-semibold text-slate-600 hover:underline"
              >
                Homologação Chefia &rarr;
              </button>
            </div>
          </div>
        </div>
      }

      <!-- =================================================================== -->
      <!-- 2. ESPELHO DE PONTO MENSAL (SPEC 13 - secp_antigo)                  -->
      <!-- =================================================================== -->
      @if (activeSubSlug === 'espelho') {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold text-cyan-700">SECP Ponto &gt; Movimentações</span>
            <h1 class="text-2xl font-bold text-slate-900">Espelho de Ponto Mensal (11/2026)</h1>
            <p class="text-xs text-slate-600 mt-0.5">
              Consulta de apurações diárias, marcações, créditos/débitos e marcação automática de Recesso Forense.
            </p>
          </div>
          <button
            type="button"
            class="h-9 px-4 rounded-lg bg-[#0891B2] text-white text-xs font-bold shadow-sm"
          >
            Exportar Espelho (PDF Oficial)
          </button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                  <th class="py-3 px-4">Data</th>
                  <th class="py-3 px-4">Prevista</th>
                  <th class="py-3 px-4">Marcações</th>
                  <th class="py-3 px-4">Trabalhado</th>
                  <th class="py-3 px-4">Crédito</th>
                  <th class="py-3 px-4">Débito</th>
                  <th class="py-3 px-4">Situação</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-xs text-slate-700">
                @for (dia of espelho; track dia.data) {
                  <tr class="hover:bg-slate-50/70">
                    <td class="py-3 px-4">
                      <strong class="text-slate-900">{{ dia.data }}</strong>
                      <span class="text-slate-400 ml-1">({{ dia.diaSemana }})</span>
                    </td>
                    <td class="py-3 px-4 font-mono">{{ dia.jornadaPrevista }}</td>
                    <td class="py-3 px-4">
                      <div class="flex flex-wrap gap-1">
                        @for (m of dia.marcacoes; track $index) {
                          <span class="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-800">{{ m }}</span>
                        }
                      </div>
                    </td>
                    <td class="py-3 px-4 font-mono font-semibold">{{ dia.trabalhado }}</td>
                    <td class="py-3 px-4 font-mono text-emerald-700 font-semibold">{{ dia.credito }}</td>
                    <td class="py-3 px-4 font-mono text-rose-700 font-semibold">{{ dia.debito }}</td>
                    <td class="py-3 px-4">
                      <span
                        class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                        [ngClass]="{
                          'bg-emerald-100 text-emerald-800': dia.situacao === 'Regular' || dia.situacao === 'Homologado',
                          'bg-amber-100 text-amber-800': dia.situacao === 'Pendente de ajuste',
                          'bg-indigo-100 text-indigo-800': dia.situacao === 'Recesso forense',
                          'bg-slate-100 text-slate-700': dia.situacao === 'Feriado'
                        }"
                      >
                        {{ dia.situacao }}
                      </span>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- =================================================================== -->
      <!-- 3. BANCO DE HORAS (TETO 16h/MÊS + COMPENSAÇÃO 3 MESES)               -->
      <!-- =================================================================== -->
      @if (activeSubSlug === 'banco-horas' && bancoHoras) {
        <div>
          <span class="text-xs font-semibold text-cyan-700">SECP Ponto &gt; Banco de Horas</span>
          <h1 class="text-2xl font-bold text-slate-900">Banco de Horas &amp; Limite de 16h/Mês</h1>
          <p class="text-xs text-slate-600 mt-0.5">
            Controle de créditos, débitos, prazo de compensação de 3 meses e teto ordinário mensal da Portaria 135/2025.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Saldo Atual</span>
            <strong class="block text-2xl font-bold text-emerald-600 mt-1">{{ bancoHoras.saldoAtualFormatado }}</strong>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Créditos no Mês (Teto {{ bancoHoras.limiteMensalFormatado }})</span>
            <strong class="block text-2xl font-bold text-cyan-700 mt-1">{{ bancoHoras.creditosMesFormatado }}</strong>
            <div class="w-full h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
              <div class="h-full bg-cyan-600" [style.width.%]="bancoHoras.percentualLimiteUsado"></div>
            </div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Débitos no Mês</span>
            <strong class="block text-2xl font-bold text-rose-600 mt-1">{{ bancoHoras.debitosMesFormatado }}</strong>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <span class="text-xs text-slate-500">Créditos a Vencer (3 meses)</span>
            <strong class="block text-2xl font-bold text-amber-600 mt-1">{{ bancoHoras.creditosAVencerFormatado }}</strong>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th class="py-3 px-4">Data</th>
                <th class="py-3 px-4">Tipo</th>
                <th class="py-3 px-4">Movimento</th>
                <th class="py-3 px-4">Descrição</th>
                <th class="py-3 px-4">Expira em</th>
                <th class="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs text-slate-700">
              @for (mov of bancoHoras.movimentos; track mov.id) {
                <tr>
                  <td class="py-3 px-4 font-mono">{{ mov.data }}</td>
                  <td class="py-3 px-4 font-semibold">{{ mov.tipo }}</td>
                  <td class="py-3 px-4 font-mono font-bold">{{ mov.minutosFormatado }}</td>
                  <td class="py-3 px-4">{{ mov.descricao }}</td>
                  <td class="py-3 px-4 font-mono">{{ mov.expiraEm || '--' }}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                      {{ mov.status }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- =================================================================== -->
      <!-- 4. HOMOLOGAÇÃO PELA CHEFIA (SPEC 14 - secp_antigo)                   -->
      <!-- =================================================================== -->
      @if (activeSubSlug === 'homologacao') {
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span class="text-xs font-semibold text-cyan-700">SECP Ponto &gt; Homologação da Chefia</span>
            <h1 class="text-2xl font-bold text-slate-900">Fila de Homologação Mensal (11/2026)</h1>
            <p class="text-xs text-slate-600 mt-0.5">
              Prazo normativo: homologação até o <strong>2º dia útil</strong> e envio do Boletim de Frequência até o <strong>dia 10</strong>.
            </p>
          </div>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                <th class="py-3 px-4">Prioridade</th>
                <th class="py-3 px-4">Servidor / Unidade</th>
                <th class="py-3 px-4">Trabalhado</th>
                <th class="py-3 px-4">Crédito / Débito</th>
                <th class="py-3 px-4">Resumo de Análise</th>
                <th class="py-3 px-4 text-right">Decisão</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs text-slate-700">
              @for (item of homologacaoQueue; track item.id) {
                <tr class="hover:bg-slate-50/70">
                  <td class="py-3 px-4">
                    <span
                      class="px-2.5 py-0.5 rounded-full text-[11px] font-bold"
                      [ngClass]="{
                        'bg-rose-100 text-rose-800': item.status === 'CRITICO',
                        'bg-amber-100 text-amber-800': item.status === 'PENDENTE',
                        'bg-cyan-100 text-cyan-800': item.status === 'REGULAR',
                        'bg-emerald-100 text-emerald-800': item.status === 'HOMOLOGADO'
                      }"
                    >
                      {{ item.status }}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <strong class="block text-slate-900">{{ item.servidorNome }} ({{ item.matricula }})</strong>
                    <span class="text-[11px] text-slate-500">{{ item.unidade }}</span>
                  </td>
                  <td class="py-3 px-4 font-mono font-semibold">{{ item.trabalhadoFormatado }}</td>
                  <td class="py-3 px-4 font-mono">
                    <span class="text-emerald-700">{{ item.creditoFormatado }}</span> /
                    <span class="text-rose-700">{{ item.debitoFormatado }}</span>
                  </td>
                  <td class="py-3 px-4">{{ item.pendenciasResumo }}</td>
                  <td class="py-3 px-4 text-right">
                    @if (item.status !== 'HOMOLOGADO') {
                      <button
                        type="button"
                        (click)="homologar.emit(item.id)"
                        class="px-3 py-1.5 rounded-lg bg-[#0891B2] hover:bg-[#0e7490] text-white text-xs font-bold"
                      >
                        Homologar
                      </button>
                    } @else {
                      <span class="text-[11px] text-emerald-700 font-semibold">✓ Homologado</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class PontoWorkspaceComponent {
  @Input() activeSubSlug: string = 'dashboard';
  @Input() dashboard: PontoDashboard | null = null;
  @Input() espelho: readonly EspelhoDia[] = [];
  @Input() bancoHoras: BancoHorasResumo | null = null;
  @Input() homologacaoQueue: readonly HomologacaoItem[] = [];
  @Input() ultimoComprovante: MarcacaoPonto | null = null;

  @Output() registrarPonto = new EventEmitter<{ fonte: string; observacao?: string }>();
  @Output() homologar = new EventEmitter<string>();
  @Output() navegarSubitem = new EventEmitter<string>();

  biometriaModalOpen = false;
  showPortariaPopup = false;

  iniciarRegistro(exigeFacial: boolean): void {
    if (exigeFacial) {
      this.biometriaModalOpen = true;
    } else {
      this.registrarPonto.emit({ fonte: 'WEB' });
    }
  }

  confirmarBiometriaFacial(): void {
    this.biometriaModalOpen = false;
    this.registrarPonto.emit({ fonte: 'BIOMETRIA_FACIAL' });
  }
}
