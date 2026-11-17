import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  HostListener,
  Input,
  computed,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface SearchableSelectOption {
  readonly value: string;
  readonly label: string;
}

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SearchableSelectComponent),
      multi: true,
    },
  ],
  template: `
    <div class="relative w-full">
      <button
        type="button"
        [disabled]="disabled"
        (click)="toggleDropdown()"
        [ngClass]="triggerClasses()"
        class="w-full flex items-center justify-between gap-2 text-left transition outline-none disabled:opacity-50"
        [attr.aria-expanded]="isOpen()"
      >
        <span [ngClass]="size === 'sm' ? 'truncate' : 'whitespace-normal break-words leading-snug'">
          {{ selectedLabel() || placeholder }}
        </span>
        <svg
          class="w-3.5 h-3.5 shrink-0 opacity-70 transition-transform"
          [class.rotate-180]="isOpen()"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      @if (isOpen()) {
        <div
          class="absolute left-0 mt-1 z-50 min-w-full w-max max-w-[min(92vw,560px)] rounded-xl bg-white border border-slate-200 shadow-xl overflow-hidden text-slate-800"
        >
          <div class="p-2 border-b border-slate-100 bg-slate-50">
            <input
              type="text"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              (click)="$event.stopPropagation()"
              (keydown.escape)="closeDropdown()"
              [placeholder]="searchPlaceholder"
              autofocus
              class="w-full h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 outline-none focus:border-[#002f6c]"
            />
          </div>

          <div class="max-h-56 overflow-y-auto py-1">
            @if (!required) {
              <button
                type="button"
                (click)="selectOption('')"
                class="w-full px-3 py-1.5 text-left text-xs text-slate-400 hover:bg-slate-50 transition"
              >
                {{ placeholder }}
              </button>
            }

            @for (opt of filteredOptions(); track opt.value) {
              <button
                type="button"
                (click)="selectOption(opt.value)"
                class="w-full px-3 py-1.5 text-left text-xs hover:bg-blue-50/70 transition flex items-center justify-between gap-2"
                [ngClass]="
                  opt.value === currentValue()
                    ? 'bg-[#002f6c]/10 text-[#002f6c] font-semibold'
                    : 'text-slate-700'
                "
              >
                <span [ngClass]="size === 'sm' ? 'truncate' : 'whitespace-normal break-words leading-snug'">{{ opt.label }}</span>
                @if (opt.value === currentValue()) {
                  <span class="text-[#007a33] font-bold text-[11px]">✓</span>
                }
              </button>
            } @empty {
              <div class="px-3 py-3 text-center text-[11px] text-slate-400">
                Nenhum item encontrado.
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class SearchableSelectComponent implements ControlValueAccessor {
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  @Input() set options(val: readonly SearchableSelectOption[]) {
    this._options.set(val ?? []);
  }
  get options(): readonly SearchableSelectOption[] {
    return this._options();
  }

  @Input() placeholder = '-- Selecione --';
  @Input() searchPlaceholder = 'Pesquisar...';
  @Input() required = false;
  @Input() disabled = false;
  @Input() theme: 'light' | 'dark' = 'light';
  @Input() size: 'sm' | 'md' = 'md';

  private readonly _options = signal<readonly SearchableSelectOption[]>([]);
  readonly isOpen = signal<boolean>(false);
  readonly searchTerm = signal<string>('');
  readonly currentValue = signal<string>('');

  readonly selectedLabel = computed(() => {
    const val = this.currentValue();
    return this._options().find((o) => o.value === val)?.label ?? '';
  });

  readonly filteredOptions = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    const list = this._options();
    if (!q) return list;
    return list.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  });

  private onChange: (val: string) => void = () => {};
  private onTouched: () => void = () => {};

  triggerClasses(): string {
    const h = this.size === 'sm' ? 'h-7 px-2 text-xs rounded-lg' : 'min-h-[38px] py-1.5 px-3 text-xs rounded-xl';
    if (this.theme === 'dark') {
      return `${h} bg-transparent text-white font-semibold hover:bg-white/10`;
    }
    return `${h} bg-white border border-slate-300 text-slate-800 focus:border-[#002f6c]`;
  }

  toggleDropdown(): void {
    if (this.disabled) return;
    this.isOpen.update((v) => !v);
    if (this.isOpen()) {
      this.searchTerm.set('');
    }
  }

  closeDropdown(): void {
    this.isOpen.set(false);
    this.onTouched();
  }

  selectOption(val: string): void {
    this.currentValue.set(val);
    this.onChange(val);
    this.onTouched();
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen() && !this.hostEl.nativeElement.contains(event.target as Node)) {
      this.isOpen.set(false);
    }
  }

  writeValue(val: unknown): void {
    this.currentValue.set(val === null || val === undefined ? '' : String(val));
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
