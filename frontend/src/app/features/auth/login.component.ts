import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CodigoPerfilRbac } from '../../core/models/ponto.models';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import { PasswordInputComponent } from '../../shared/components/password-input.component';
import { SearchableSelectComponent } from '../../shared/components/searchable-select.component';

const STORAGE_KEY_MATRICULA = 'secp_login_matricula';
const STORAGE_KEY_ORGAO = 'secp_login_orgao';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, PasswordInputComponent],
  template: `
    <div class="min-h-screen w-full flex flex-col lg:flex-row bg-[#f4f8fc]">
      <!-- PAINEL ESQUERDO: HERO INSTITUCIONAL -->
      <section class="relative lg:w-[54%] bg-[#07162b] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between overflow-hidden">
        <!-- Camadas de textura e iluminação premium -->
        <div
          class="absolute inset-0 pointer-events-none opacity-90"
          style="background: radial-gradient(circle at 20% 25%, rgba(0, 74, 153, 0.45), transparent 55%), radial-gradient(circle at 85% 80%, rgba(0, 122, 51, 0.25), transparent 50%), linear-gradient(135deg, #061326 0%, #0b2242 52%, #091a32 100%);"
        ></div>
        <div
          class="absolute inset-0 pointer-events-none opacity-[0.06]"
          style="background-image: linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px); background-size: 40px 40px;"
        ></div>

        <!-- Topo: Botão Apresentação + Identidade -->
        <div class="relative z-10 flex flex-col gap-10">
          <div>
            <button
              type="button"
              (click)="mostrarApresentacao.set(!mostrarApresentacao())"
              class="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-sm transition hover:bg-white/20"
            >
              <span>{{ mostrarApresentacao() ? '↓ Ocultar detalhes' : '← Apresentação' }}</span>
            </button>
          </div>

          <!-- Brand Logo -->
          <div class="flex items-center gap-4">
            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg ring-4 ring-white/10">
              <svg class="h-10 w-10 text-[#002f6c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3l7 3v5c0 4.97-3.05 9.19-7 10.5C8.05 20.19 5 15.97 5 11V6l7-3z"
                />
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4" stroke="#007a33" stroke-width="2.2" />
              </svg>
            </div>
            <div>
              <h2 class="text-3xl font-extrabold tracking-tight text-white">SECP</h2>
              <p class="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-200/90 mt-0.5">
                Sistema Eletrônico de Controle de Ponto
              </p>
            </div>
          </div>

          <!-- Mensagem Principal -->
          <div class="max-w-xl">
            <span class="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold text-blue-100 backdrop-blur-sm">
              <svg class="h-3.5 w-3.5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
              </svg>
              Justiça Federal - SECP
            </span>

            <h1 class="mt-5 text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] text-white">
              Frequência funcional com governança.
            </h1>

            <p class="mt-5 text-sm sm:text-base text-slate-200/90 leading-relaxed max-w-lg">
              Acesso seguro ao controle eletrônico de ponto, espelho, solicitações, homologação e banco de horas em ambiente multi-órgãos.
            </p>

            @if (mostrarApresentacao()) {
              <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
                  <strong class="block text-emerald-300 font-bold">Biometria Facial &amp; Auditoria</strong>
                  <span class="text-blue-100/85 mt-1 block">Registro imutável com liveness check e trilha SHA-256.</span>
                </div>
                <div class="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm">
                  <strong class="block text-emerald-300 font-bold">Portaria SJAM-DIREF 135/2025</strong>
                  <span class="text-blue-100/85 mt-1 block">Conformidade integral com regras de jornada e banco de horas.</span>
                </div>
              </div>
            }
          </div>
        </div>

        <!-- Rodapé Hero: 3 Pilares -->
        <div class="relative z-10 mt-10 pt-6 border-t border-white/15 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-200">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="font-medium">Autenticação institucional</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="font-medium">Perfil carregado em tempo real</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300">
              <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="font-medium">Fuso e regras por órgão</span>
          </div>
        </div>
      </section>

      <!-- PAINEL DIREITO: FORMULÁRIO DE ACESSO INSTITUCIONAL -->
      <section class="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-gradient-to-br from-[#eaf3fb] via-[#f5f9fd] to-white">
        <div class="w-full max-w-[440px]">
          <div class="rounded-3xl border border-[#e2e8f0] bg-white p-7 sm:p-8 shadow-[0_24px_60px_-15px_rgba(0,47,108,0.12)]">
            @if (state.requirePasswordChange()) {
              <div class="mb-5">
                <span class="text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  Primeiro Acesso Obrigatório
                </span>
                <h2 class="text-xl font-bold text-[#002f6c] mt-3">
                  Alterar Senha Inicial (SECP.MASTER)
                </h2>
                <p class="text-xs text-slate-600 mt-1">
                  Por segurança institucional, defina uma nova senha antes de acessar o painel administrativo.
                </p>
              </div>

              <form (submit)="onChangePassword($event)" class="flex flex-col gap-4">
                <div>
                  <label class="text-xs font-semibold text-slate-700 block mb-1">Nova Senha (mín. 8 caracteres)</label>
                  <app-password-input
                    [(ngModel)]="novaSenha"
                    name="novaSenha"
                    [required]="true"
                    placeholder="Mínimo 8 caracteres"
                    inputClass="h-11 px-3.5 rounded-xl border border-slate-300 text-xs focus:border-[#002f6c]"
                  />
                </div>
                @if (state.authError()) {
                  <div class="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-semibold">
                    {{ state.authError() }}
                  </div>
                }
                <button
                  type="submit"
                  class="h-11 rounded-xl bg-[#002f6c] hover:bg-[#00224f] text-white text-sm font-bold shadow-sm transition"
                >
                  Confirmar Nova Senha e Acessar →
                </button>
              </form>
            } @else {
              <!-- Cabeçalho do Card -->
              <div class="flex items-start justify-between gap-4">
                <div class="flex items-center gap-2.5">
                  <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eef4fb] border border-[#d6e4f5]">
                    <svg class="h-5 w-5 text-[#002f6c]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M12 3l7 3v5c0 4.97-3.05 9.19-7 10.5C8.05 20.19 5 15.97 5 11V6l7-3z"
                      />
                    </svg>
                  </div>
                  <div>
                    <strong class="block text-sm font-extrabold tracking-tight text-[#0f172a]">SECP</strong>
                    <span class="block text-[10px] font-bold uppercase tracking-widest text-[#64748b]">
                      Justiça Federal
                    </span>
                  </div>
                </div>

                <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b2a52] text-white shadow-sm">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
              </div>

              <div class="mt-5">
                <span class="text-[11px] font-bold uppercase tracking-[0.12em] text-[#1d4ed8]">
                  Acesso Institucional
                </span>
                <h2 class="mt-1 text-2xl font-extrabold tracking-tight text-[#0f172a]">
                  Entrar no SECP
                </h2>
                <p class="mt-1.5 text-xs leading-relaxed text-[#64748b]">
                  Use sua matrícula e senha da rede para carregar os perfis e permissões atualizados.
                </p>
              </div>

              <form (submit)="onSubmitLogin($event)" class="mt-5 flex flex-col gap-4">
                <div>
                  <label class="text-xs font-semibold text-[#334155] block mb-1.5">
                    Órgão / Seccional
                  </label>
                  <app-searchable-select
                    [options]="orgaoOptions"
                    [(ngModel)]="selectedOrgaoId"
                    name="orgao"
                    placeholder="Selecione o órgão / seccional..."
                  />
                </div>

                <div>
                  <label for="login-matricula" class="text-xs font-semibold text-[#334155] block mb-1.5">
                    Matrícula
                  </label>
                  <div class="relative">
                    <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94a3b8]">
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </span>
                    <input
                      id="login-matricula"
                      type="text"
                      [(ngModel)]="matricula"
                      name="matricula"
                      required
                      placeholder="Ex: AM200385 ou SECP.MASTER"
                      class="h-11 w-full rounded-xl border border-[#cbd5e1] bg-white pl-10 pr-3.5 text-sm font-medium text-[#0f172a] outline-none transition focus:border-[#002f6c] focus:ring-2 focus:ring-[#002f6c]/15"
                    />
                  </div>
                  <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span class="text-[10px] text-slate-400">Servidores (SJAM):</span>
                    <button type="button" (click)="matricula = 'AM200385'" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-[#002f6c]">AM200385</button>
                    <button type="button" (click)="matricula = 'AM2703'" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-[#002f6c]">AM2703</button>
                    <button type="button" (click)="matricula = 'AM200218'" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-[#002f6c]">AM200218</button>
                  </div>
                </div>

                <div>
                  <label for="login-senha" class="text-xs font-semibold text-[#334155] block mb-1.5">
                    Senha da rede
                  </label>
                  <app-password-input
                    inputId="login-senha"
                    [(ngModel)]="senha"
                    name="senha"
                    [required]="true"
                    placeholder="••••••••••••"
                    inputClass="h-11 px-3.5 rounded-xl border border-[#cbd5e1] text-sm focus:border-[#002f6c]"
                  />
                </div>

                <label class="inline-flex items-center gap-2 text-xs font-medium text-[#334155] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    [(ngModel)]="lembrarCredenciais"
                    name="lembrar"
                    class="h-4 w-4 rounded border-[#cbd5e1] text-[#002f6c] focus:ring-[#002f6c]"
                  />
                  <span>Lembrar matrícula e senha</span>
                </label>

                @if (state.authError()) {
                  <div class="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-700 font-semibold">
                    {{ state.authError() }}
                  </div>
                }

                <button
                  type="submit"
                  [disabled]="state.authenticating()"
                  class="h-11 rounded-xl bg-[#003b80] hover:bg-[#002a5c] disabled:opacity-50 text-white text-sm font-bold shadow-sm transition flex items-center justify-center gap-2"
                >
                  <span>{{ state.authenticating() ? 'Autenticando...' : 'Entrar no SECP' }}</span>
                  @if (!state.authenticating()) {
                    <span>→</span>
                  }
                </button>

                <button
                  type="button"
                  (click)="suporteAberto.set(true)"
                  class="h-10 rounded-xl border border-[#cbd5e1] bg-white hover:bg-[#f8fafc] text-[#1e293b] text-xs font-bold transition"
                >
                  Solicitar Suporte
                </button>
              </form>
            }
          </div>

          <!-- Nota de vínculo funcional -->
          <div class="mt-4 rounded-2xl border border-[#dbe6f3] bg-white/80 px-4 py-3 flex items-start gap-2.5 text-xs text-[#475569] shadow-sm">
            <svg class="h-4 w-4 shrink-0 text-[#002f6c] mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>O órgão é identificado pelo vínculo funcional do servidor e pelas lotações cadastradas no SECP.</span>
          </div>

          <!-- Acesso rápido de homologação (colapsável para manter visual limpo) -->
          <div class="mt-3 text-center">
            <button
              type="button"
              (click)="mostrarHomologacao.set(!mostrarHomologacao())"
              class="text-[11px] font-semibold text-[#64748b] hover:text-[#002f6c] transition"
            >
              {{ mostrarHomologacao() ? 'Ocultar perfis de homologação ▲' : 'Acesso rápido de homologação por perfil ▼' }}
            </button>

            @if (mostrarHomologacao()) {
              <div class="mt-2.5 grid grid-cols-2 gap-2 text-left rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                @for (perfil of state.perfisRbac; track perfil.codigo) {
                  <button
                    type="button"
                    (click)="entrarRapido(perfil.codigo)"
                    class="px-3 py-2 rounded-xl border border-slate-200 hover:border-[#002f6c] hover:bg-blue-50/40 transition"
                  >
                    <strong class="block text-xs text-[#002f6c]">{{ perfil.codigo }}</strong>
                    <span class="text-[10px] text-slate-500">{{ perfil.nome }}</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>
      </section>
    </div>

    <!-- Modal de Suporte Institucional -->
    @if (suporteAberto()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
          <div class="flex items-start justify-between">
            <div>
              <span class="text-[10px] font-bold uppercase tracking-widest text-[#002f6c]">Central de Atendimento</span>
              <h3 class="text-lg font-bold text-slate-900 mt-0.5">Suporte Técnico SECP</h3>
            </div>
            <button
              type="button"
              (click)="suporteAberto.set(false)"
              class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div class="mt-4 space-y-3 text-xs text-slate-600">
            <div class="rounded-xl bg-slate-50 p-3 border border-slate-200">
              <strong class="block text-slate-800">Núcleo de Tecnologia da Informação (NUTEC / SJAM)</strong>
              <p class="mt-1">Problemas com matrícula, senha institucional ou vinculação de lotação devem ser reportados ao Helpdesk da Seccional.</p>
            </div>
            <div class="flex justify-between text-xs border-b border-slate-100 pb-2">
              <span class="text-slate-500">E-mail de Atendimento</span>
              <span class="font-semibold text-[#002f6c]">suporte.secp&#64;trf1.jus.br</span>
            </div>
            <div class="flex justify-between text-xs">
              <span class="text-slate-500">Horário</span>
              <span class="font-semibold text-slate-800">Segunda a Sexta, 08:00 às 18:00</span>
            </div>
          </div>
          <div class="mt-5 flex justify-end">
            <button
              type="button"
              (click)="suporteAberto.set(false)"
              class="rounded-xl bg-[#002f6c] px-4 py-2 text-xs font-bold text-white hover:bg-[#00224f]"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class LoginComponent implements OnInit {
  readonly state = inject(SecpPontoStateService);
  private readonly router = inject(Router);

  readonly orgaoOptions = this.state.orgaosDisponiveis.map((o) => ({
    value: o.id,
    label: `${o.unidadeLabel} (${o.fusoHorario})`,
  }));

  readonly mostrarApresentacao = signal<boolean>(false);
  readonly mostrarHomologacao = signal<boolean>(false);
  readonly suporteAberto = signal<boolean>(false);

  selectedOrgaoId = 'sjam';
  matricula = 'AM200385';
  senha = '';
  novaSenha = '';
  lembrarCredenciais = true;

  ngOnInit(): void {
    try {
      const savedMatricula = localStorage.getItem(STORAGE_KEY_MATRICULA);
      const savedOrgao = localStorage.getItem(STORAGE_KEY_ORGAO);
      if (savedMatricula) {
        this.matricula = savedMatricula;
      }
      if (savedOrgao) {
        this.selectedOrgaoId = savedOrgao;
      }
    } catch {
      // ignore storage errors
    }
  }

  onSubmitLogin(event: Event): void {
    event.preventDefault();
    try {
      if (this.lembrarCredenciais) {
        localStorage.setItem(STORAGE_KEY_MATRICULA, this.matricula.trim());
        localStorage.setItem(STORAGE_KEY_ORGAO, this.selectedOrgaoId);
      } else {
        localStorage.removeItem(STORAGE_KEY_MATRICULA);
        localStorage.removeItem(STORAGE_KEY_ORGAO);
      }
    } catch {
      // ignore storage errors
    }

    this.state.loginWithBackend(this.matricula, this.senha, this.selectedOrgaoId, () => {
      this.router.navigateByUrl('/home');
    });
  }

  onChangePassword(event: Event): void {
    event.preventDefault();
    if (this.state.completePasswordChange(this.novaSenha)) {
      this.router.navigateByUrl('/home');
    }
  }

  entrarRapido(codigo: CodigoPerfilRbac): void {
    this.state.loginQuickProfile(codigo, this.selectedOrgaoId);
    this.router.navigateByUrl('/home');
  }
}
