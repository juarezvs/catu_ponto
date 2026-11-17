import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  NavigationItem,
  NavigationSubItem,
} from '../../../../../domain/models/navigation.model';

@Component({
  selector: 'app-secondary-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (primaryItem && primaryItem.hasSecondaryMenu) {
      <aside
        class="w-60 h-[calc(100vh-4rem)] bg-[#fbfcfe] border-r border-slate-200 flex flex-col select-none shrink-0 overflow-hidden"
        aria-label="Sidebar Secundária Contextual de Subitens"
      >
        <!-- Cabeçalho da 2ª Barra Lateral com opção de Fixar (Pin) ou Fechar -->
        <div class="px-4 py-3 border-b border-slate-200/80 flex items-center justify-between bg-white">
          <div class="flex items-center gap-2">
            <span
              class="w-2 h-2 rounded-full"
              [style.backgroundColor]="themeColorHex"
            ></span>
            <span class="text-xs font-bold uppercase tracking-wider text-slate-700">
              {{ primaryItem.label }}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <button
              type="button"
              (click)="togglePin.emit()"
              class="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"
              [title]="pinned ? 'Barra secundária fixada' : 'Fixar barra secundária'"
            >
              <svg
                class="w-3.5 h-3.5"
                [style.color]="pinned ? themeColorHex : ''"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 17v5"></path>
                <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"></path>
              </svg>
            </button>
            <button
              type="button"
              (click)="closeSidebar.emit()"
              class="p-1 rounded hover:bg-slate-100 text-slate-500 transition-colors"
              title="Fechar segunda barra lateral"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Lista de Seções e Subitens filtrados pelo RBAC do usuário -->
        <div class="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
          @for (section of primaryItem.sections; track section.id) {
            <div class="flex flex-col gap-1">
              <div class="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider px-2.5 pb-1">
                {{ section.title }}
              </div>

              @for (sub of section.items; track sub.id) {
                <button
                  type="button"
                  (click)="subItemSelected.emit(sub)"
                  [title]="sub.description"
                  class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] text-left transition-all"
                  [ngClass]="
                    activeSubItemId === sub.id
                      ? 'font-semibold'
                      : 'text-slate-700 hover:bg-slate-100'
                  "
                  [style.backgroundColor]="
                    activeSubItemId === sub.id ? themeColorHex + '18' : ''
                  "
                  [style.color]="activeSubItemId === sub.id ? themeColorHex : ''"
                >
                  <span class="truncate">{{ sub.label }}</span>
                  @if (sub.badge) {
                    <span
                      class="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      [style.backgroundColor]="
                        activeSubItemId === sub.id ? themeColorHex + '26' : '#e2e8f0'
                      "
                      [style.color]="
                        activeSubItemId === sub.id ? themeColorHex : '#475569'
                      "
                    >
                      {{ sub.badge }}
                    </span>
                  }
                </button>
              }
            </div>
          }
        </div>
      </aside>
    }
  `,
})
export class SecondarySidebarComponent {
  @Input() primaryItem: NavigationItem | null = null;
  @Input() activeSubItemId: string | null = null;
  @Input() themeColorHex = '#0891B2';
  @Input() pinned = true;

  @Output() subItemSelected = new EventEmitter<NavigationSubItem>();
  @Output() closeSidebar = new EventEmitter<void>();
  @Output() togglePin = new EventEmitter<void>();
}
