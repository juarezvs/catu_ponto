import {
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface CompetenciaSelecionada {
  ano: number;
  mes: number;
}

const MESES_COMPLETOS = [
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

const MESES_CURTOS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

@Component({
  selector: 'app-competencia-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative inline-flex items-center gap-1.5 select-none">
      <button
        type="button"
        (click)="navegarMes(-1)"
        title="Competência anterior"
        class="inline-flex h-9 w-8 items-center justify-center rounded-xl text-[#475569] transition-colors hover:bg-white hover:text-[#002f6c] hover:shadow-sm"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        type="button"
        (click)="togglePopover()"
        [attr.aria-expanded]="aberto()"
        class="inline-flex h-9 min-w-[196px] items-center justify-between gap-3 rounded-full border border-[#cbd5e1] bg-white px-4 text-[13px] font-semibold text-[#0f172a] shadow-sm transition-all hover:border-[#002f6c]/50 hover:shadow focus:outline-none focus:ring-2 focus:ring-[#002f6c]/20"
        [ngClass]="{ 'border-[#002f6c] ring-2 ring-[#002f6c]/15': aberto() }"
      >
        <span>{{ labelAtual() }}</span>
        <svg class="h-4 w-4 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.9">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </button>

      <button
        type="button"
        (click)="navegarMes(1)"
        title="Próxima competência"
        class="inline-flex h-9 w-8 items-center justify-center rounded-xl text-[#475569] transition-colors hover:bg-white hover:text-[#002f6c] hover:shadow-sm"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      @if (aberto()) {
        <div
          class="absolute right-0 top-[calc(100%+10px)] z-50 w-[304px] rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.22)] ring-1 ring-black/5"
        >
          <!-- Cabeçalho de Ano -->
          <div class="mb-4 flex items-center justify-between">
            <button
              type="button"
              (click)="navegarAno(-1)"
              title="Ano anterior"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#334155] transition-colors hover:border-[#002f6c]/30 hover:bg-[#f8fafc] hover:text-[#002f6c]"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <span class="text-[15px] font-bold tracking-tight text-[#0f172a]">
              {{ anoExibido() }}
            </span>

            <button
              type="button"
              (click)="navegarAno(1)"
              title="Próximo ano"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#334155] transition-colors hover:border-[#002f6c]/30 hover:bg-[#f8fafc] hover:text-[#002f6c]"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <!-- Grade 4x3 de Meses -->
          <div class="grid grid-cols-3 gap-2">
            @for (mesNome of mesesCurtos; track $index) {
              @let mesNumero = $index + 1;
              @let ativo = anoExibido() === ano() && mesNumero === mes();
              <button
                type="button"
                (click)="selecionarMes(mesNumero)"
                class="h-10 rounded-xl border text-[13px] font-semibold transition-all"
                [ngClass]="
                  ativo
                    ? 'border-[#002f6c] bg-[#002f6c] text-white shadow-sm'
                    : 'border-[#e2e8f0] bg-white text-[#1e293b] hover:border-[#002f6c]/40 hover:bg-[#f1f5f9] hover:text-[#002f6c]'
                "
              >
                {{ mesNome }}
              </button>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class CompetenciaPickerComponent {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  readonly ano = input.required<number>();
  readonly mes = input.required<number>();
  readonly competenciaChange = output<CompetenciaSelecionada>();

  readonly aberto = signal<boolean>(false);
  readonly anoExibido = signal<number>(2026);
  readonly mesesCurtos = MESES_CURTOS;

  readonly labelAtual = computed(() => {
    const idx = Math.max(0, Math.min(11, this.mes() - 1));
    return `${MESES_COMPLETOS[idx]} De ${this.ano()}`;
  });

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.aberto() && !this.hostEl.nativeElement.contains(event.target as Node)) {
      this.aberto.set(false);
    }
  }

  togglePopover(): void {
    const next = !this.aberto();
    if (next) {
      this.anoExibido.set(this.ano());
    }
    this.aberto.set(next);
  }

  navegarAno(delta: -1 | 1): void {
    this.anoExibido.update((v) => v + delta);
  }

  navegarMes(delta: -1 | 1): void {
    let m = this.mes() + delta;
    let a = this.ano();
    if (m < 1) {
      m = 12;
      a -= 1;
    } else if (m > 12) {
      m = 1;
      a += 1;
    }
    this.competenciaChange.emit({ ano: a, mes: m });
  }

  selecionarMes(mesNumero: number): void {
    this.aberto.set(false);
    this.competenciaChange.emit({ ano: this.anoExibido(), mes: mesNumero });
  }
}
