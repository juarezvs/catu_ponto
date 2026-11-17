import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';

interface ModuloViewSpec {
  readonly title: string;
  readonly category: string;
  readonly description: string;
  readonly columns: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

const MODULO_SPECS: Record<string, ModuloViewSpec> = {
  'solicitacoes-banco-horas': {
    title: 'Solicitações de Banco de Horas',
    category: 'SOLICITAÇÕES E FREQUÊNCIA',
    description:
      'Autorização prévia de crédito (até 16h/mês) e pedidos de compensação dentro do prazo de 3 meses (Portaria SJAM-DIREF 135/2025).',
    columns: ['Protocolo', 'Tipo', 'Data Ref.', 'Quantidade', 'Estado'],
    rows: [
      ['BH-2026-041', 'Autorização Prévia de Crédito', '06/11/2026', '+01h30', 'DEFERIDA'],
      ['BH-2026-049', 'Compensação de Débito', '11/11/2026', '-00h35', 'EM_ANALISE'],
    ],
  },
  'meu-contracheque': {
    title: 'Meu Contracheque',
    category: 'MINHA VIDA FUNCIONAL',
    description:
      'Demonstrativos mensais de pagamento e informe de rendimentos integrados ao SARH.',
    columns: ['Competência', 'Total Proventos', 'Descontos', 'Valor Líquido', 'Situação'],
    rows: [
      ['11/2026', 'R$ 12.480,00', 'R$ 2.890,40', 'R$ 9.589,60', 'Disponível (PDF)'],
      ['10/2026', 'R$ 12.480,00', 'R$ 2.890,40', 'R$ 9.589,60', 'Creditado'],
    ],
  },
  'meus-afastamentos': {
    title: 'Meus Afastamentos',
    category: 'MINHA VIDA FUNCIONAL',
    description:
      'Licenças, capacitações externas e afastamentos importados do SARH com efeito na apuração diária.',
    columns: ['Período', 'Tipo', 'Origem', 'Efeito na Frequência', 'Status'],
    rows: [
      ['12/11/2026', 'Capacitação Externa (5h)', 'CNJ / SJAM', 'Abono integral da jornada', 'DEFERIDA'],
    ],
  },
  'minhas-ferias': {
    title: 'Minhas Férias',
    category: 'MINHA VIDA FUNCIONAL',
    description:
      'Períodos aquisitivos e programação anual de férias (MARCADA ou GOZADA dispensam jornada conforme Seção 7.4).',
    columns: ['Exercício', 'Período Programado', 'Dias', 'Parcela', 'Situação'],
    rows: [
      ['2025/2026', '20/10/2026 a 29/10/2026', '10 dias', '1ª Parcela', 'GOZADA'],
      ['2026/2027', '11/01/2027 a 30/01/2027', '20 dias', '1ª Parcela', 'MARCADA'],
    ],
  },
  'meu-banco-horas': {
    title: 'Meu Banco de Horas',
    category: 'MINHA VIDA FUNCIONAL',
    description:
      'Saldo consolidado (+08h20), créditos no mês (+06h30 de 16h00) e prazo de compensação de 3 meses.',
    columns: ['Data', 'Movimento', 'Minutos', 'Validade', 'Situação'],
    rows: [
      ['13/11/2026', 'CREDITO • Apoio Implantação SECP', '+01h05', '13/02/2027', 'VALIDADO'],
      ['11/11/2026', 'DEBITO • Entrada após horário', '-00h35', '11/02/2027', 'PENDENTE'],
    ],
  },
  'minhas-horas-extras': {
    title: 'Minhas Horas Extras',
    category: 'MINHA VIDA FUNCIONAL',
    description:
      'Solicitações e execuções de serviço extraordinário autorizadas com validação orçamentária.',
    columns: ['Protocolo', 'Período', 'Quantidade', 'Unidade', 'Estado'],
    rows: [
      ['HE-2026-102', '08/11/2026 (Domingo)', '04h00', 'SJAM • NUTEC', 'HOMOLOGADA'],
    ],
  },
  'recesso-forense': {
    title: 'Recesso Forense (20/12 a 06/01)',
    category: 'CONSULTAS E DOCUMENTOS',
    description:
      'Domínio próprio do recesso anual. Dias sem convocação não geram falta nem débito ordinário.',
    columns: ['Exercício', 'Dias Convocados', 'Opção', 'Chefia Recesso', 'Etapa'],
    rows: [
      ['2026/2027', 'Sem convocação registrada até o momento', '—', '—', 'Recesso regular'],
    ],
  },
  'meus-relatorios': {
    title: 'Meus Relatórios',
    category: 'CONSULTAS E DOCUMENTOS',
    description:
      'Emissão em PDF do Espelho de Ponto, Comprovantes de Marcação e Extrato do Banco de Horas com Hash SHA-256.',
    columns: ['Documento', 'Competência', 'Autenticidade', 'Formato', 'Situação'],
    rows: [
      ['Espelho de Ponto Assinado', '10/2026', 'SHA-256 Verificável', 'PDF', 'Homologado'],
      ['Extrato Banco de Horas', '11/2026', 'SHA-256 Verificável', 'PDF', 'Atualizado'],
    ],
  },
  'minhas-substituicoes': {
    title: 'Minhas Substituições',
    category: 'CONSULTAS E DOCUMENTOS',
    description:
      'Histórico de substituições de função de confiança e herança temporária de competências de chefia.',
    columns: ['Função Substituída', 'Titular', 'Período', 'Origem', 'Status'],
    rows: [
      ['FC-05 • Chefe de Núcleo (NUTEC)', 'Marina Costa', '01/10/2026 a 10/10/2026', 'SARH', 'ENCERRADA'],
    ],
  },
};

@Component({
  selector: 'app-servidor-modulo-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="max-w-5xl mx-auto flex flex-col gap-6">
      <!-- Breadcrumb funcional -->
      <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-[11px] font-semibold text-[#97999b] -mb-3">
        <a routerLink="/home" class="hover:text-[#002f6c] hover:underline transition">Início</a>
        <span>›</span>
        <a
          [routerLink]="['/secao', spec().category.includes('SOLICITA') ? 'solicitacoes-frequencia' : 'vida-funcional']"
          class="hover:text-[#002f6c] hover:underline transition"
        >
          {{ spec().category }}
        </a>
        <span>›</span>
        <span class="text-[#002f6c]">{{ spec().title }}</span>
      </nav>

      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider text-[#007a33]">
            {{ spec().category }} • {{ state.activeOrgao().unidadeLabel }}
          </span>
          <h1 class="text-2xl font-bold text-[#002f6c] tracking-tight mt-0.5">
            {{ spec().title }}
          </h1>
          <p class="text-xs text-slate-600 mt-1">{{ spec().description }}</p>
        </div>

        <a
          routerLink="/dashboard"
          class="h-9 px-4 rounded-xl bg-[#002f6c] hover:bg-[#00224f] text-white text-xs font-bold flex items-center shrink-0"
        >
          &larr; Voltar ao Dashboard
        </a>
      </div>

      <div class="card-surface bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-[#97999b] uppercase">
                @for (col of spec().columns; track col) {
                  <th class="py-3 px-4">{{ col }}</th>
                }
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 text-xs text-slate-700">
              @for (row of spec().rows; track $index) {
                <tr class="hover:bg-slate-50/70">
                  @for (cell of row; track $index; let last = $last) {
                    <td class="py-3.5 px-4">
                      @if (last) {
                        <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-[#007a33]">
                          {{ cell }}
                        </span>
                      } @else {
                        <span>{{ cell }}</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class ServidorModuloPageComponent {
  readonly state = inject(SecpPontoStateService);
  private readonly route = inject(ActivatedRoute);
  private readonly slug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('slug') ?? 'meu-banco-horas')),
    { initialValue: 'meu-banco-horas' }
  );

  readonly spec = computed(
    () =>
      MODULO_SPECS[this.slug()] ??
      MODULO_SPECS['meu-banco-horas']
  );
}
