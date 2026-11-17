import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Input, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import { SearchableSelectComponent } from '../../shared/components/searchable-select.component';

export interface OrganogramaNode {
  id: string;
  codigo: string;
  sigla: string;
  nome: string;
  tipo: string;
  uf: string;
  municipio: string;
  ativo?: boolean;
  children: OrganogramaNode[];
}

export interface OrganogramaExternalFilter {
  column: string;
  operator: 'contains' | 'equals' | 'starts_with';
  value: string;
}

interface OrganogramaResponse {
  orgaos: { id: string; sigla: string; nome: string; uf: string }[];
  orgao: { id: string; sigla: string; nome: string; uf: string } | null;
  root: OrganogramaNode | null;
  totalUnidades: number;
}

@Component({
  selector: 'app-organograma-view',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent],
  template: `
    <div class="flex flex-col bg-[#f8fafc] min-h-[540px]">
      <!-- BARRA DO ORGANOGRAMA -->
      <div class="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="flex items-center gap-1.5">
            <span class="font-semibold text-slate-600">Órgão/Seccional (1 por vez):</span>
            @if (canSwitchOrgao()) {
              <div class="w-64">
                <app-searchable-select
                  size="sm"
                  [required]="true"
                  [ngModel]="selectedOrgao()"
                  (ngModelChange)="onOrgaoChange($event)"
                  [options]="orgaoOptions()"
                  searchPlaceholder="Escolher 1 órgão/seccional..."
                />
              </div>
            } @else {
              <span class="px-2.5 py-1 rounded-lg bg-[#eff6fc] border border-[#0078d4]/25 text-[#005a9e] font-bold">
                {{ selectedOrgao() }}
              </span>
            }
          </div>

          <input
            type="text"
            [ngModel]="searchQuery()"
            (ngModelChange)="onSearchChange($event)"
            placeholder="Localizar sigla ou unidade..."
            class="h-8 px-3 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:border-[#002f6c] w-52"
          />

          <span class="text-[11px] font-semibold text-slate-500">
            {{ totalUnidades() }} unidade(s)
          </span>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            (click)="expandirTudo()"
            class="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
          >
            Expandir todos os níveis
          </button>
          <button
            type="button"
            (click)="expandirAteNivel(2)"
            class="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
          >
            2 níveis
          </button>
          <button
            type="button"
            (click)="recolherTudo()"
            class="h-7 px-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-[11px] font-semibold text-slate-700"
          >
            Recolher
          </button>

          <button
            type="button"
            (click)="centralizarScroll()"
            class="h-7 px-2.5 rounded-lg border border-[#0078d4]/40 bg-[#eff6fc] hover:bg-[#deecf9] text-[11px] font-semibold text-[#005a9e]"
            title="Centralizar organograma"
          >
            ⌖ Centralizar
          </button>

          <span class="h-4 w-px bg-slate-200 mx-1"></span>

          <button
            type="button"
            (click)="alterarZoom(-0.1)"
            class="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700"
            title="Diminuir zoom"
          >
            −
          </button>
          <span class="w-11 text-center font-mono text-[11px] font-semibold text-slate-700">
            {{ Math.round(zoom() * 100) }}%
          </span>
          <button
            type="button"
            (click)="alterarZoom(0.1)"
            class="w-7 h-7 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-700"
            title="Aumentar zoom"
          >
            +
          </button>
        </div>
      </div>

      <!-- ÁREA DO ORGANOGRAMA COM SCROLL HORIZONTAL/VERTICAL E ARRASTE (PAN) -->
      <div
        #scrollViewport
        (mousedown)="onPanStart($event)"
        (mousemove)="onPanMove($event)"
        (mouseup)="onPanEnd()"
        (mouseleave)="onPanEnd()"
        [ngClass]="isPanning() ? 'cursor-grabbing select-none' : 'cursor-grab'"
        class="relative flex-1 overflow-auto p-6 min-h-[480px]"
      >
        @if (loading()) {
          <div class="py-16 text-center text-xs text-slate-500">
            Montando organograma hierárquico...
          </div>
        } @else if (!filteredRootNode()) {
          <div class="py-16 text-center text-xs text-slate-500">
            Nenhuma unidade organizacional corresponde aos filtros atuais neste órgão.
          </div>
        } @else {
          <div
            class="inline-flex flex-col items-center min-w-full origin-top transition-transform duration-150"
            [style.transform]="'scale(' + zoom() + ')'"
          >
            <ng-container
              *ngTemplateOutlet="nodeTpl; context: { $implicit: filteredRootNode()!, depth: 0 }"
            ></ng-container>
          </div>
        }

        <!-- LEGENDA INSTITUCIONAL -->
        <div class="mt-8 inline-flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-xl bg-white/95 border border-slate-200 shadow-sm text-[11px]">
          <strong class="text-slate-700 uppercase tracking-wider text-[10px]">Legenda:</strong>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-xs bg-[#006d77]"></span> Órgão / Diretoria
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-xs bg-[#0f766e]"></span> Secretaria / Centro
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-xs bg-[#9d174d]"></span> Núcleo
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-xs bg-[#047857]"></span> Seção
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-xs border border-dashed border-[#4d7c0f] bg-[#f7fee7]"></span> Serviço / Setor
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="w-3 h-3 rounded-xs bg-[#b45309]"></span> Gabinete / Vara
          </span>
        </div>
      </div>
    </div>

    <!-- TEMPLATE RECURSIVO DOS NÓS DO ORGANOGRAMA -->
    <ng-template #nodeTpl let-node let-depth="depth">
      <div class="flex flex-col items-center">
        <!-- CARD DA UNIDADE -->
        <div
          [attr.data-node-id]="node.id"
          (click)="selecionarEExpandirSubarvore(node)"
          [ngClass]="cardClasses(node, depth)"
          class="w-44 rounded-lg shadow-xs cursor-pointer select-none transition hover:shadow-md flex flex-col justify-between overflow-hidden"
          [title]="node.sigla + ' — ' + node.nome + (node.uf ? ' (' + node.uf + ')' : '')"
        >
          <div class="px-2.5 py-2 text-center min-h-[44px] flex items-center justify-center">
            <span class="text-[11px] leading-tight font-semibold line-clamp-3">
              {{ node.nome }}
            </span>
          </div>
          <div
            [ngClass]="siglaBarClasses(node, depth)"
            class="px-2 py-1 text-[10px] font-bold tracking-wide flex items-center justify-between"
          >
            <span class="truncate">{{ node.sigla }}</span>
            @if (node.children.length > 0) {
              <button
                type="button"
                (click)="$event.stopPropagation(); toggleNode(node)"
                class="px-1.5 py-0.2 rounded bg-white/25 hover:bg-white/40 text-[9px] font-bold shrink-0"
                [title]="isExpanded(node.id) ? 'Recolher este ramo' : 'Expandir este ramo'"
              >
                {{ isExpanded(node.id) ? '−' : '+' + node.children.length }}
              </button>
            }
          </div>
        </div>

        <!-- CONECTOR E FILHOS -->
        @if (node.children.length > 0 && isExpanded(node.id)) {
          <div class="w-px h-4 bg-slate-400"></div>

          <div class="flex items-start justify-center">
            @for (child of node.children; track child.id; let isFirst = $first; let isLast = $last) {
              <div class="flex flex-col items-center px-2 relative">
                @if (node.children.length > 1) {
                  <div
                    class="h-px bg-slate-400 absolute top-0"
                    [ngClass]="{
                      'left-1/2 right-0': isFirst && !isLast,
                      'left-0 right-1/2': isLast && !isFirst,
                      'left-0 right-0': !isFirst && !isLast
                    }"
                  ></div>
                }
                <div class="w-px h-4 bg-slate-400"></div>

                <ng-container
                  *ngTemplateOutlet="nodeTpl; context: { $implicit: child, depth: depth + 1 }"
                ></ng-container>
              </div>
            }
          </div>
        }
      </div>
    </ng-template>
  `,
})
export class OrganogramaViewComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly state = inject(SecpPontoStateService);
  private readonly apiUrl = 'http://localhost:8000/api/v1/secp/cadastros/aux/organograma';

  @ViewChild('scrollViewport') scrollViewport?: ElementRef<HTMLDivElement>;

  @Input() set externalSearch(val: string) {
    this._externalSearch.set(val ?? '');
  }
  @Input() set externalFilters(val: readonly OrganogramaExternalFilter[]) {
    this._externalFilters.set(val ?? []);
  }

  readonly Math = Math;
  readonly loading = signal<boolean>(false);
  readonly orgaosList = signal<{ id: string; sigla: string; nome: string; uf: string }[]>([]);
  readonly selectedOrgao = signal<string>('SJAM');
  readonly rootNode = signal<OrganogramaNode | null>(null);
  readonly totalUnidades = signal<number>(0);
  readonly expandedIds = signal<Set<string>>(new Set());
  readonly focusedNodeId = signal<string | null>(null);
  readonly isPanning = signal<boolean>(false);

  private panStartX = 0;
  private panStartY = 0;
  private panStartScrollLeft = 0;
  private panStartScrollTop = 0;
  private panMoved = false;
  private suppressNextClick = false;
  readonly searchQuery = signal<string>('');
  readonly _externalSearch = signal<string>('');
  readonly _externalFilters = signal<readonly OrganogramaExternalFilter[]>([]);
  readonly zoom = signal<number>(0.85);

  readonly canSwitchOrgao = computed(() => {
    const perfil = this.state.activePerfilCodigo();
    return perfil === 'MASTER' || this.orgaosList().length > 1;
  });

  readonly orgaoOptions = computed(() =>
    this.orgaosList().map((o) => ({
      value: o.sigla,
      label: `${o.sigla} • ${o.nome}${o.uf ? ' (' + o.uf + ')' : ''}`,
    }))
  );

  readonly filteredRootNode = computed<OrganogramaNode | null>(() => {
    const root = this.rootNode();
    if (!root) return null;
    const extQ = this._externalSearch().trim().toLowerCase();
    const locQ = this.searchQuery().trim().toLowerCase();
    const flts = this._externalFilters();

    const filterTree = (n: OrganogramaNode, pathSigla: string): OrganogramaNode | null => {
      if (n.ativo === false) {
        return null;
      }
      const currentPath = pathSigla ? `${pathSigla}\\${n.sigla}` : n.sigla;
      const filteredChildren = n.children
        .map((c) => filterTree(c, currentPath))
        .filter((c): c is OrganogramaNode => c !== null);

      if (!extQ && !locQ && flts.length === 0) {
        return { ...n, children: filteredChildren };
      }

      const selfMatches = this.nodeMatches(n, currentPath, extQ, locQ, flts);
      if (selfMatches || filteredChildren.length > 0) {
        return { ...n, children: filteredChildren };
      }
      return null;
    };

    return filterTree(root, '');
  });

  ngOnInit(): void {
    const initialSigla = this.state.activeOrgao().sigla || 'SJAM';
    this.selectedOrgao.set(initialSigla);
    this.carregarOrganograma(initialSigla);
  }

  onOrgaoChange(sigla: string): void {
    if (!sigla) return;
    this.selectedOrgao.set(sigla);
    this.carregarOrganograma(sigla);
  }

  carregarOrganograma(orgaoSigla: string): void {
    this.loading.set(true);
    this.http
      .get<OrganogramaResponse>(`${this.apiUrl}?orgao=${encodeURIComponent(orgaoSigla)}`)
      .subscribe({
        next: (res) => {
          this.orgaosList.set(res.orgaos || []);
          this.rootNode.set(res.root);
          this.totalUnidades.set(res.totalUnidades || 0);
          this.loading.set(false);
          // Padrão: exibe TODOS os níveis conforme hierarquia departamental e centraliza
          this.expandirTudo();
          this.centralizarScroll();
        },
        error: () => {
          this.loading.set(false);
        },
      });
  }

  isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  onPanStart(event: MouseEvent): void {
    if (event.button !== 0) return;
    const el = this.scrollViewport?.nativeElement;
    if (!el) return;
    this.isPanning.set(true);
    this.panMoved = false;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panStartScrollLeft = el.scrollLeft;
    this.panStartScrollTop = el.scrollTop;
  }

  onPanMove(event: MouseEvent): void {
    if (!this.isPanning()) return;
    const el = this.scrollViewport?.nativeElement;
    if (!el) return;
    const dx = event.clientX - this.panStartX;
    const dy = event.clientY - this.panStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      this.panMoved = true;
    }
    if (this.panMoved) {
      el.scrollLeft = this.panStartScrollLeft - dx;
      el.scrollTop = this.panStartScrollTop - dy;
    }
  }

  onPanEnd(): void {
    if (!this.isPanning()) return;
    this.isPanning.set(false);
    if (this.panMoved) {
      this.suppressNextClick = true;
      setTimeout(() => {
        this.suppressNextClick = false;
      }, 50);
    }
  }

  selecionarEExpandirSubarvore(node: OrganogramaNode): void {
    if (this.suppressNextClick) {
      this.suppressNextClick = false;
      return;
    }
    this.focusedNodeId.set(node.id);
    if (node.children.length > 0) {
      this.expandedIds.update((prev) => {
        const next = new Set(prev);
        const expandAll = (n: OrganogramaNode) => {
          if (n.children.length > 0) {
            next.add(n.id);
            for (const c of n.children) expandAll(c);
          }
        };
        expandAll(node);
        return next;
      });
    }
    setTimeout(() => {
      const container = this.scrollViewport?.nativeElement;
      if (!container) return;
      const cardEl = container.querySelector<HTMLElement>(`[data-node-id="${node.id}"]`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
    }, 60);
  }

  toggleNode(node: OrganogramaNode): void {
    if (node.children.length === 0) return;
    this.expandedIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(node.id)) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
  }

  centralizarScroll(): void {
    setTimeout(() => {
      const el = this.scrollViewport?.nativeElement;
      if (!el) return;
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      el.scrollTo({
        left: maxScrollLeft > 0 ? maxScrollLeft / 2 : 0,
        top: 0,
        behavior: 'smooth',
      });
    }, 60);
  }

  expandirAteNivel(maxDepth: number): void {
    const root = this.rootNode();
    if (!root) return;
    const ids = new Set<string>();
    const walk = (n: OrganogramaNode, depth: number) => {
      if (depth < maxDepth && n.children.length > 0) {
        ids.add(n.id);
        for (const c of n.children) walk(c, depth + 1);
      }
    };
    walk(root, 0);
    this.expandedIds.set(ids);
  }

  expandirTudo(): void {
    const root = this.rootNode();
    if (!root) return;
    const ids = new Set<string>();
    const walk = (n: OrganogramaNode) => {
      if (n.children.length > 0) {
        ids.add(n.id);
        for (const c of n.children) walk(c);
      }
    };
    walk(root);
    this.expandedIds.set(ids);
  }

  recolherTudo(): void {
    const root = this.rootNode();
    this.expandedIds.set(root ? new Set([root.id]) : new Set());
  }

  alterarZoom(delta: number): void {
    this.zoom.update((z) => Math.min(1.5, Math.max(0.4, Number((z + delta).toFixed(2)))));
  }

  onSearchChange(q: string): void {
    this.searchQuery.set(q);
    if (q.trim()) {
      this.expandirTudo();
    }
  }

  private nodeMatches(
    n: OrganogramaNode,
    pathSigla: string,
    extQ: string,
    locQ: string,
    flts: readonly OrganogramaExternalFilter[]
  ): boolean {
    const combined = `${n.sigla} ${pathSigla} ${n.nome} ${n.codigo} ${n.tipo} ${n.uf} ${n.municipio}`.toLowerCase();
    if (extQ && !combined.includes(extQ)) return false;
    if (locQ && !combined.includes(locQ)) return false;

    for (const f of flts) {
      const val = f.value.trim().toLowerCase();
      if (!val) continue;
      let target = '';
      if (f.column === 'sigla') target = pathSigla.toLowerCase();
      else if (f.column === 'nome') target = (n.nome || '').toLowerCase();
      else if (f.column === 'codigo') target = (n.codigo || '').toLowerCase();
      else if (f.column === 'tipo') target = (n.tipo || '').toLowerCase();
      else if (f.column === 'uf') target = (n.uf || '').toLowerCase();
      else if (f.column === 'municipio') target = (n.municipio || '').toLowerCase();
      else if (f.column === 'ativo') {
        if (['false', '0', 'nao', 'não', 'inativo'].includes(val)) return false;
        continue;
      }
      else target = combined;

      if (f.operator === 'equals' && target !== val && n.sigla.toLowerCase() !== val) return false;
      if (f.operator === 'starts_with' && !target.startsWith(val) && !n.sigla.toLowerCase().startsWith(val)) return false;
      if (f.operator === 'contains' && !target.includes(val)) return false;
    }
    return true;
  }

  private isHighlight(node: OrganogramaNode): boolean {
    const q = (this.searchQuery() || this._externalSearch()).trim().toLowerCase();
    if (!q) return false;
    return node.sigla.toLowerCase().includes(q) || node.nome.toLowerCase().includes(q);
  }

  private resolveCategoria(node: OrganogramaNode, depth: number): string {
    const s = (node.sigla || '').toUpperCase();
    const n = (node.nome || '').toUpperCase();
    if (depth === 0 || node.tipo === 'ORGAO' || s === 'DIREF') return 'ORGAO';
    if (s.startsWith('NUC') || n.includes('NÚCLEO') || n.includes('NUCLEO')) return 'NUCLEO';
    if (s.startsWith('GAB') || s.startsWith('GAJ') || n.includes('GABINETE') || n.includes('JUIZ')) return 'GABINETE';
    if (s.startsWith('SER') || s.startsWith('SET') || n.includes('SERVIÇO') || n.includes('SETOR')) return 'SERVICO';
    if (s.startsWith('SEC') || s.startsWith('COJ') || s.startsWith('CEJ') || n.includes('SECRETARIA')) return 'SECRETARIA';
    return 'SECAO';
  }

  cardClasses(node: OrganogramaNode, depth: number): string {
    const ring =
      this.focusedNodeId() === node.id
        ? 'ring-2 ring-[#0078d4] ring-offset-2'
        : this.isHighlight(node)
          ? 'ring-2 ring-amber-400 ring-offset-2'
          : '';
    const cat = this.resolveCategoria(node, depth);
    if (cat === 'ORGAO') return `bg-[#006d77] text-white border border-[#00555d] ${ring}`;
    if (cat === 'NUCLEO') return `bg-[#fdf2f8] text-slate-800 border border-[#9d174d] ${ring}`;
    if (cat === 'GABINETE') return `bg-[#fffbeb] text-slate-800 border border-[#d97706] ${ring}`;
    if (cat === 'SERVICO') return `bg-[#f7fee7] text-slate-800 border border-dashed border-[#65a30d] ${ring}`;
    if (cat === 'SECRETARIA') return `bg-[#f0fdfa] text-slate-800 border border-[#0f766e] ${ring}`;
    return `bg-[#ecfdf5] text-slate-800 border border-[#047857] ${ring}`;
  }

  siglaBarClasses(node: OrganogramaNode, depth: number): string {
    const cat = this.resolveCategoria(node, depth);
    if (cat === 'ORGAO') return 'bg-[#004e56] text-white';
    if (cat === 'NUCLEO') return 'bg-[#9d174d] text-white';
    if (cat === 'GABINETE') return 'bg-[#b45309] text-white';
    if (cat === 'SERVICO') return 'bg-[#4d7c0f] text-white';
    if (cat === 'SECRETARIA') return 'bg-[#0f766e] text-white';
    return 'bg-[#047857] text-white';
  }
}
