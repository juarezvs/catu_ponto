import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';

@Component({
  selector: 'app-chefia-equipe',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="flex flex-col gap-5">
      <!-- Breadcrumb + Retorno ao Próprio Ponto -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <nav class="flex items-center gap-1.5 text-xs text-slate-500">
            <a routerLink="/home" class="hover:text-[#002f6c] font-medium">Início</a>
            <span>›</span>
            <span class="font-semibold text-slate-700">Equipe &amp; Unidades Subordinadas</span>
          </nav>
          <h1 class="text-xl font-extrabold text-[#0f172a] mt-1">
            Gestão da Chefia — Unidades e Subordinados
          </h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Visualização hierárquica das unidades geridas, unidades subordinadas e servidores vinculados.
          </p>
        </div>

        <div class="flex items-center gap-2">
          @if (state.servidorMatricula() !== state.loggedInMatricula()) {
            <button
              type="button"
              (click)="voltarParaMeuPonto()"
              class="h-9 px-3.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-xs transition"
            >
              ↺ Voltar ao meu ponto ({{ state.loggedInMatricula() }})
            </button>
          }
          <button
            type="button"
            (click)="recarregar()"
            class="h-9 px-3.5 rounded-xl border border-[#cbd5e1] bg-white hover:bg-slate-50 text-xs font-semibold text-[#003b80] shadow-2xs transition"
          >
            ↻ Atualizar escopo
          </button>
        </div>
      </div>

      <!-- Resumo KPIs do Escopo -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Unidades no Escopo</span>
          <strong class="block text-2xl font-extrabold text-[#003b80] mt-1">
            {{ unidades().length }}
          </strong>
          <span class="text-[11px] text-[#64748b]">Lotação gerida + unidades subordinadas abaixo</span>
        </div>

        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Servidores Subordinados</span>
          <strong class="block text-2xl font-extrabold text-[#0f172a] mt-1">
            {{ subordinados().length }}
          </strong>
          <span class="text-[11px] text-[#64748b]">Lotações ativas nas unidades subordinadas</span>
        </div>

        <div class="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-2xs">
          <span class="text-[11px] font-bold uppercase tracking-wider text-[#64748b]">Solicitações da Equipe</span>
          <strong class="block text-2xl font-extrabold text-amber-600 mt-1">
            {{ solicitacoesEquipe().length }}
          </strong>
          <span class="text-[11px] text-[#64748b]">Registros recentes de ajuste/justificativa</span>
        </div>
      </div>

      <!-- Unidades Geridas e Subordinadas -->
      <section class="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-2xs">
        <h2 class="text-sm font-bold text-[#0f172a]">
          Unidades sob Gestão e Subordinadas ({{ unidades().length }})
        </h2>
        @if (unidades().length === 0) {
          <p class="mt-3 text-xs text-[#64748b]">
            Nenhum vínculo ativo de gestão encontrado em <code>gestores_unidades</code> para a matrícula
            <strong>{{ state.loggedInMatricula() }}</strong>.
          </p>
        } @else {
          <div class="mt-3 flex flex-wrap gap-2">
            @for (u of unidades(); track u.id) {
              <div
                class="rounded-xl border px-3 py-2 text-xs"
                [ngClass]="
                  u.nivel === 0
                    ? 'border-[#003b80]/30 bg-[#eef4fb] text-[#003b80]'
                    : 'border-[#e2e8f0] bg-[#f8fafc] text-[#334155]'
                "
              >
                <div class="flex items-center gap-1.5 font-bold">
                  <span>{{ u.sigla || u.nome }}</span>
                  <span class="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold">
                    {{ u.nivel === 0 ? u.papel_gestor : 'Nível +' + u.nivel }}
                  </span>
                </div>
                <span class="block text-[11px] opacity-80 mt-0.5">{{ u.nome }}</span>
              </div>
            }
          </div>
        }
      </section>

      <!-- Lista de Servidores Subordinados -->
      <section class="rounded-2xl border border-[#e2e8f0] bg-white shadow-2xs overflow-hidden">
        <div class="px-5 py-3.5 border-b border-[#e2e8f0] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-sm font-bold text-[#0f172a]">
            Servidores Subordinados ({{ subordinadosFiltrados().length }})
          </h2>
          <input
            type="text"
            [ngModel]="buscaSignal()"
            (ngModelChange)="buscaSignal.set($event)"
            placeholder="Filtrar por nome, matrícula ou unidade..."
            class="h-8 w-full sm:w-72 rounded-xl border border-[#cbd5e1] bg-white px-3 text-xs outline-none focus:border-[#003b80]"
          />
        </div>

        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse text-xs">
            <thead>
              <tr class="border-b border-[#e2e8f0] bg-[#f8fafc] text-[10px] font-bold uppercase tracking-wider text-[#64748b]">
                <th class="py-2.5 px-4">Matrícula</th>
                <th class="py-2.5 px-4">Servidor</th>
                <th class="py-2.5 px-4">Unidade</th>
                <th class="py-2.5 px-4">Cargo</th>
                <th class="py-2.5 px-4">Situação</th>
                <th class="py-2.5 px-4 text-right">Consultar Ponto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#f1f5f9]">
              @for (sub of subordinadosFiltrados(); track sub.id) {
                <tr class="hover:bg-slate-50">
                  <td class="py-3 px-4 font-mono font-bold text-[#003b80]">{{ sub.matricula }}</td>
                  <td class="py-3 px-4 font-semibold text-[#0f172a]">{{ sub.nomeFuncional }}</td>
                  <td class="py-3 px-4 text-[#475569]">
                    <span class="font-semibold">{{ sub.unidadeSigla }}</span> — {{ sub.unidadeNome }}
                  </td>
                  <td class="py-3 px-4 text-[#64748b]">{{ sub.cargoNome }}</td>
                  <td class="py-3 px-4">
                    <span class="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      {{ sub.situacao }}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right whitespace-nowrap">
                    <button
                      type="button"
                      (click)="abrirEspelhoSubordinado(sub.matricula)"
                      class="rounded-lg bg-[#003b80] hover:bg-[#002a5c] px-2.5 py-1 text-[11px] font-bold text-white transition mr-1.5"
                    >
                      Espelho
                    </button>
                    <button
                      type="button"
                      (click)="abrirDashboardSubordinado(sub.matricula)"
                      class="rounded-lg border border-[#cbd5e1] bg-white hover:bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-[#334155] transition"
                    >
                      Dashboard
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6" class="py-8 text-center text-xs text-[#64748b]">
                    Nenhum servidor subordinado encontrado para este filtro.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `,
})
export class ChefiaEquipeComponent implements OnInit {
  readonly state = inject(SecpPontoStateService);
  private readonly router = inject(Router);

  readonly buscaSignal = signal<string>('');

  readonly unidades = computed(() => this.state.chefiaEscopo()?.unidades ?? []);
  readonly subordinados = computed(() => this.state.chefiaEscopo()?.subordinados ?? []);
  readonly solicitacoesEquipe = computed(() => this.state.chefiaEscopo()?.solicitacoesEquipe ?? []);

  readonly subordinadosFiltrados = computed(() => {
    const q = this.buscaSignal().trim().toLowerCase();
    const list = this.subordinados();
    if (!q) return list;
    return list.filter(
      (s) =>
        s.matricula.toLowerCase().includes(q) ||
        s.nomeFuncional.toLowerCase().includes(q) ||
        s.unidadeSigla.toLowerCase().includes(q) ||
        s.unidadeNome.toLowerCase().includes(q)
    );
  });

  ngOnInit(): void {
    this.recarregar();
  }

  recarregar(): void {
    this.state.loadChefiaEscopo(this.state.loggedInMatricula());
  }

  voltarParaMeuPonto(): void {
    this.state.switchRealServidor(this.state.loggedInMatricula());
  }

  abrirEspelhoSubordinado(matricula: string): void {
    this.state.switchRealServidor(matricula);
    this.router.navigateByUrl('/espelho-ponto');
  }

  abrirDashboardSubordinado(matricula: string): void {
    this.state.switchRealServidor(matricula);
    this.router.navigateByUrl('/dashboard');
  }
}
