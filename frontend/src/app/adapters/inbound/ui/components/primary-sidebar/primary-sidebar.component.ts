import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NavigationItem } from '../../../../../domain/models/navigation.model';

@Component({
  selector: 'app-primary-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside
      class="h-[calc(100vh-4rem)] bg-white border-r border-slate-200 flex flex-col justify-between py-3 transition-all duration-200 ease-in-out select-none shrink-0 overflow-hidden"
      [ngClass]="expanded ? 'w-64' : 'w-20'"
    >
      <nav class="flex flex-col gap-1.5 px-2.5" aria-label="Sidebar Primária SECP">
        @for (item of items; track item.id) {
          <button
            type="button"
            (click)="itemSelected.emit(item)"
            [title]="!expanded ? item.label : ''"
            class="group relative flex items-center h-10 rounded-lg text-sm transition-all duration-150 overflow-hidden"
            [ngClass]="
              activeItemId === item.id
                ? 'font-semibold text-slate-900'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            "
            [style.backgroundColor]="
              activeItemId === item.id ? themeColorHex + '18' : ''
            "
            [style.color]="activeItemId === item.id ? themeColorHex : ''"
          >
            <!-- Barra vertical indicadora de item ativo -->
            @if (activeItemId === item.id) {
              <span
                class="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r"
                [style.backgroundColor]="themeColorHex"
              ></span>
            }

            <!-- Slot fixo de ícone para manter centralização em w-20 e alinhamento em w-64 -->
            <span class="w-14 h-10 flex items-center justify-center shrink-0">
              @switch (item.icon) {
                @case ('home') {
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                    <path d="M3 10.5L12 3l9 7.5"></path>
                    <path d="M5 9.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"></path>
                  </svg>
                }
                @case ('folder') {
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
                  </svg>
                }
                @case ('workflows') {
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                    <circle cx="6" cy="6" r="2.5"></circle>
                    <circle cx="6" cy="18" r="2.5"></circle>
                    <circle cx="18" cy="12" r="2.5"></circle>
                    <path d="M8.5 6h4a2 2 0 0 1 2 2v2"></path>
                    <path d="M8.5 18h4a2 2 0 0 0 2-2v-2"></path>
                  </svg>
                }
                @case ('analytics') {
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                    <ellipse cx="12" cy="5" rx="8" ry="3"></ellipse>
                    <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"></path>
                    <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"></path>
                  </svg>
                }
                @default {
                  <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.77 1.05 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                }
              }
            </span>

            <!-- Nome do item do menu (revelado quando w-64, ocultado quando w-20) -->
            <span
              class="whitespace-nowrap flex-1 text-left transition-opacity duration-150"
              [ngClass]="expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'"
            >
              {{ item.label }}
            </span>

            @if (item.hasSecondaryMenu && expanded) {
              <span class="pr-3 opacity-60">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </span>
            }
          </button>
        }
      </nav>

      <!-- Rodapé da Sidebar Primária (Colapsar w-20 / Expandir w-64) -->
      <div class="px-2.5 pt-2 border-t border-slate-100">
        <button
          type="button"
          (click)="toggleExpand.emit()"
          class="w-full h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center transition-colors overflow-hidden"
          [title]="expanded ? 'Colapsar Sidebar Primária (w-20)' : 'Expandir Sidebar Primária (w-64)'"
        >
          <span class="w-14 h-9 flex items-center justify-center shrink-0">
            @if (expanded) {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="11 17 6 12 11 7"></polyline>
                <polyline points="18 17 13 12 18 7"></polyline>
              </svg>
            } @else {
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
              </svg>
            }
          </span>
          <span
            class="whitespace-nowrap transition-opacity duration-150"
            [ngClass]="expanded ? 'opacity-100' : 'opacity-0 pointer-events-none'"
          >
            Recolher menu
          </span>
        </button>
      </div>
    </aside>
  `,
})
export class PrimarySidebarComponent {
  @Input() items: readonly NavigationItem[] = [];
  @Input() activeItemId: string | null = null;
  @Input() expanded = true;
  @Input() themeColorHex = '#0891B2';

  @Output() itemSelected = new EventEmitter<NavigationItem>();
  @Output() toggleExpand = new EventEmitter<void>();
}
