import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import { MenuItemIconComponent } from '../../shared/components/menu-item-icon.component';

interface CatalogCountItem {
  slug: string;
  totalRegistros: number;
}

@Component({
  selector: 'app-secao-cards-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MenuItemIconComponent],
  template: `
    <div class="bg-white min-h-full p-4 sm:p-5 max-w-7xl mx-auto flex flex-col gap-4 rounded-xl border border-[#edebe9]">
      <!-- BREADCRUMB FUNCIONAL -->
      <nav aria-label="Breadcrumb" class="flex items-center flex-wrap gap-1.5 text-xs font-semibold text-[#605e5c]">
        <a routerLink="/home" class="hover:text-[#0078d4] hover:underline transition">Início</a>
        <span>›</span>
        @if (grupoFiltro()) {
          <a
            [routerLink]="['/secao', menuId()]"
            class="hover:text-[#0078d4] hover:underline transition"
          >
            {{ menuAtual()?.label || menuId() }}
          </a>
          <span>›</span>
          <span class="text-[#323130]">{{ grupoFiltro() }}</span>
        } @else {
          <span class="text-[#323130]">{{ menuAtual()?.label || menuId() }}</span>
        }
      </nav>

      <!-- CABEÇALHO ESTILO AZURE TODOS OS SERVIÇOS -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#edebe9]">
        <div>
          <h1 class="text-xl font-semibold text-[#323130] tracking-tight">
            {{ grupoFiltro() ? grupoFiltro() : (menuAtual()?.label || 'Todos os itens') }}
          </h1>
          <p class="text-xs text-[#605e5c] mt-0.5">
            Selecione um item para acessar a respectiva funcionalidade.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <input
            type="text"
            [ngModel]="filtroTexto()"
            (ngModelChange)="filtroTexto.set($event)"
            placeholder="Filtrar serviços..."
            class="h-8 px-3 rounded border border-[#d2d0ce] bg-[#faf9f8] focus:bg-white text-xs text-[#323130] outline-none focus:border-[#0078d4] w-48"
          />
          <button
            type="button"
            (click)="expandirTodos()"
            class="h-8 px-3 rounded border border-[#d2d0ce] bg-white hover:bg-[#f3f2f1] text-xs font-medium text-[#323130] transition"
          >
            Expandir todos
          </button>
          <button
            type="button"
            (click)="recolherTodos()"
            class="h-8 px-3 rounded border border-[#d2d0ce] bg-white hover:bg-[#f3f2f1] text-xs font-medium text-[#323130] transition"
          >
            Recolher todos
          </button>
          @if (grupoFiltro()) {
            <a
              [routerLink]="['/secao', menuId()]"
              class="h-8 px-3 rounded border border-[#0078d4]/40 bg-[#eff6fc] hover:bg-[#deecf9] text-xs font-semibold text-[#005a9e] inline-flex items-center transition"
            >
              Ver todos os grupos
            </a>
          }
        </div>
      </div>

      <!-- GRUPOS EXPANSÍVEIS / COLAPSÁVEIS (PADRÃO EXPANDIDOS - ESTILO AZURE) -->
      @for (sec of secoesVisiveis(); track sec.title) {
        <section class="flex flex-col">
          <!-- Cabeçalho do Grupo com Chevron ^ / v -->
          <button
            type="button"
            (click)="toggleGrupo(sec.title)"
            class="w-full flex items-center justify-between py-2 border-b border-[#edebe9] hover:bg-[#faf9f8] px-1 text-left transition group"
            [attr.aria-expanded]="!isColapsado(sec.title)"
          >
            <span class="text-[14px] font-semibold text-[#323130]">
              {{ formatarTituloGrupo(sec.title) }}
              <span class="font-normal text-[#605e5c]">({{ sec.items.length }})</span>
            </span>

            <svg
              class="w-4 h-4 text-[#605e5c] group-hover:text-[#323130] transition-transform duration-150"
              [class.rotate-180]="isColapsado(sec.title)"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            >
              <polyline points="4 10 8 6 12 10"/>
            </svg>
          </button>

          <!-- Grid 3 colunas estilo Azure -->
          @if (!isColapsado(sec.title)) {
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1 py-3">
              @for (item of sec.items; track item.id) {
                <a
                  [routerLink]="item.route"
                  [title]="item.description"
                  class="group flex items-center justify-between gap-2 px-2.5 py-2 rounded hover:bg-[#f3f2f1] transition"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <app-menu-item-icon [itemId]="item.id" sizeClass="w-[18px] h-[18px]" />
                    <span class="text-[13px] text-[#323130] group-hover:text-[#0078d4] truncate">
                      {{ item.label }}
                    </span>
                  </div>

                  @if (countForRoute(item.route) !== null) {
                    <span class="px-1.5 py-0.5 rounded border border-[#0078d4]/30 text-[10px] font-semibold text-[#005a9e] bg-[#eff6fc] shrink-0">
                      {{ countForRoute(item.route) }}
                    </span>
                  } @else if (item.badge) {
                    <span class="px-1.5 py-0.5 rounded border border-[#d2d0ce] text-[10px] font-semibold text-[#605e5c] bg-[#faf9f8] shrink-0">
                      {{ item.badge }}
                    </span>
                  }
                </a>
              }
            </div>
          }
        </section>
      } @empty {
        <div class="py-10 text-center text-xs text-[#605e5c]">
          Nenhuma opção encontrada.
        </div>
      }
    </div>
  `,
})
export class SecaoCardsPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly http = inject(HttpClient);
  readonly state = inject(SecpPontoStateService);

  readonly menuId = signal<string>('cadastros');
  readonly grupoFiltro = signal<string | null>(null);
  readonly filtroTexto = signal<string>('');
  readonly collapsedGroups = signal<Set<string>>(new Set());
  readonly catalogCounts = signal<Record<string, number>>({});

  readonly menuAtual = computed(() =>
    this.state.cartoMenusVisiveis().find((m) => m.id === this.menuId()) ?? null
  );

  readonly secoesVisiveis = computed(() => {
    const menu = this.menuAtual();
    if (!menu) return [];
    const gf = (this.grupoFiltro() || '').trim().toLowerCase();
    let sections = menu.sections;

    if (gf) {
      const matched = sections.filter((s) => {
        const st = s.title.toLowerCase();
        if (st === gf || st.includes(gf) || gf.includes(st)) return true;
        const firstWord = gf.split(/\s+/)[0];
        return Boolean(firstWord && st.includes(firstWord));
      });
      if (matched.length > 0) {
        sections = matched;
      }
    }

    const q = this.filtroTexto()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!q) return sections;

    return sections
      .map((sec) => ({
        ...sec,
        items: sec.items.filter((it) =>
          `${it.label} ${it.description} ${sec.title}`
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .includes(q)
        ),
      }))
      .filter((sec) => sec.items.length > 0);
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('menuId') || 'cadastros';
      this.menuId.set(id);
      this.collapsedGroups.set(new Set());
      this.filtroTexto.set('');
      if (id === 'cadastros') {
        this.carregarContagensCatalogo();
      }
    });
    this.route.queryParamMap.subscribe((qp) => {
      const g = qp.get('grupo');
      this.grupoFiltro.set(g ? g.trim() : null);
      this.collapsedGroups.set(new Set());
    });
  }

  formatarTituloGrupo(title: string): string {
    return title
      .toLowerCase()
      .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
  }

  isColapsado(title: string): boolean {
    return this.collapsedGroups().has(title);
  }

  toggleGrupo(title: string): void {
    this.collapsedGroups.update((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }

  expandirTodos(): void {
    this.collapsedGroups.set(new Set());
  }

  recolherTodos(): void {
    const all = new Set(this.secoesVisiveis().map((s) => s.title));
    this.collapsedGroups.set(all);
  }

  countForRoute(route: string): number | null {
    if (!route.startsWith('/cadastros/')) return null;
    const slug = route.replace('/cadastros/', '');
    const map = this.catalogCounts();
    return slug in map ? map[slug] : null;
  }

  private carregarContagensCatalogo(): void {
    this.http
      .get<CatalogCountItem[]>('http://localhost:8000/api/v1/secp/cadastros/catalog')
      .subscribe({
        next: (rows) => {
          const map: Record<string, number> = {};
          for (const r of rows || []) {
            map[r.slug] = r.totalRegistros;
          }
          this.catalogCounts.set(map);
        },
        error: () => {},
      });
  }
}
