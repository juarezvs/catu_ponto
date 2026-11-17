import { CommonModule } from '@angular/common';
import { Component, Input, forwardRef, signal } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PasswordInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="relative w-full">
      <input
        [id]="inputId"
        [type]="visible() ? 'text' : 'password'"
        [ngModel]="value()"
        (ngModelChange)="onValueChange($event)"
        (blur)="onTouched()"
        [required]="required"
        [disabled]="disabled"
        [attr.minlength]="minlength"
        [placeholder]="placeholder"
        [attr.autocomplete]="autocomplete"
        [ngClass]="inputClass"
        class="w-full pr-9 outline-none"
      />
      <button
        type="button"
        (click)="toggleVisibility()"
        [attr.aria-label]="visible() ? 'Ocultar senha' : 'Mostrar senha'"
        [title]="visible() ? 'Ocultar senha' : 'Mostrar senha'"
        class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#002f6c] transition p-0.5"
      >
        @if (visible()) {
          <!-- Olho cortado (ocultar) -->
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
            <line x1="1" y1="1" x2="23" y2="23"></line>
          </svg>
        } @else {
          <!-- Olho aberto (mostrar) -->
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
        }
      </button>
    </div>
  `,
})
export class PasswordInputComponent implements ControlValueAccessor {
  @Input() inputId = '';
  @Input() placeholder = '••••••••';
  @Input() autocomplete = 'current-password';
  @Input() required = false;
  @Input() disabled = false;
  @Input() minlength: number | null = null;
  @Input() inputClass = 'h-9 px-3 rounded-xl border border-slate-300 text-xs focus:border-[#002f6c]';

  readonly value = signal<string>('');
  readonly visible = signal<boolean>(false);

  private onChange: (val: string) => void = () => {};
  onTouched: () => void = () => {};

  toggleVisibility(): void {
    this.visible.update((v) => !v);
  }

  onValueChange(val: string): void {
    this.value.set(val ?? '');
    this.onChange(val ?? '');
  }

  writeValue(val: unknown): void {
    this.value.set(val === null || val === undefined ? '' : String(val));
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
