import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CodigoPerfilRbac } from '../../core/models/ponto.models';
import { SecpPontoStateService } from '../../core/services/secp-ponto-state.service';
import { SearchableSelectComponent } from '../../shared/components/searchable-select.component';
import { PasswordInputComponent } from '../../shared/components/password-input.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, SearchableSelectComponent, PasswordInputComponent],
  template: `
    <div class="min-h-screen w-full flex flex-col lg:flex-row bg-slate-50">
      <!-- PAINEL ESQUERDO: IDENTIDADE INSTITUCIONAL PREMIUM (#002f6c) -->
      <section class="lg:w-[46%] bg-gradient-to-br from-[#00224f] via-[#002f6c] to-[#005f73] text-white p-8 sm:p-12 lg:p-14 flex flex-col justify-between relative overflow-hidden">
        <div class="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>
        <div class="absolute -left-24 -bottom-24 w-96 h-96 rounded-full bg-[#007a33]/20 blur-3xl pointer-events-none"></div>

        <div class="relative z-10">
          <div class="flex items-center gap-3">
            <div class="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <svg class="w-6 h-6 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"></path>
                <path d="M14 13.12c0 2.38 0 6.38-1 8.88"></path>
                <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"></path>
                <path d="M2 12a10 10 0 0 1 18-6"></path>
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"></path>
                <path d="M9 6.8a6 6 0 0 1 9 5.2v2"></path>
              </svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-lg font-bold tracking-tight">SECP</span>
                <span class="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/15 border border-white/20">
                  GOVPLATFORM
                </span>
              </div>
              <p class="text-xs text-blue-200">Justiça Federal • Tribunal Regional Federal da 1ª Região</p>
            </div>
          </div>

          <div class="mt-12 max-w-md">
            <span class="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              Portaria SJAM-DIREF 135/2025 &amp; Portaria MTP 671
            </span>
            <h1 class="text-3xl sm:text-4xl font-bold tracking-tight mt-4 leading-tight">
              Sistema Eletrônico de Controle de Ponto
            </h1>
            <p class="text-sm text-blue-100/90 mt-3 leading-relaxed">
              Plataforma unificada de registro biométrico, apuração diária imutável, gestão de banco de horas e homologação mensal com rastreabilidade integral.
            </p>
          </div>
        </div>

        <div class="relative z-10 mt-10 grid grid-cols-2 gap-3 text-xs">
          <div class="rounded-xl bg-white/10 border border-white/15 p-3.5">
            <strong class="block text-emerald-300 font-bold">Biometria Facial Web</strong>
            <span class="text-blue-100/80 text-[11px]">Liveness Check na 1ª marcação diária</span>
          </div>
          <div class="rounded-xl bg-white/10 border border-white/15 p-3.5">
            <strong class="block text-emerald-300 font-bold">Dados Brutos Imutáveis</strong>
            <span class="text-blue-100/80 text-[11px]">Auditoria criptográfica SHA-256</span>
          </div>
          <div class="rounded-xl bg-white/10 border border-white/15 p-3.5">
            <strong class="block text-emerald-300 font-bold">RBAC Multi-Órgão</strong>
            <span class="text-blue-100/80 text-[11px]">Perfis por seccional e unidade</span>
          </div>
          <div class="rounded-xl bg-white/10 border border-white/15 p-3.5">
            <strong class="block text-emerald-300 font-bold">Fuso Oficial</strong>
            <span class="text-blue-100/80 text-[11px]">America/Manaus • America/Sao_Paulo</span>
          </div>
        </div>
      </section>

      <!-- PAINEL DIREITO: FORMULÁRIO DE AUTENTICAÇÃO SSO -->
      <section class="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div class="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-7 sm:p-8">
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
                  autocomplete="new-password"
                  placeholder="Digite a nova senha institucional"
                  inputClass="h-10 px-3.5 rounded-xl border border-slate-300 text-xs focus:border-[#002f6c]"
                />
              </div>

              @if (state.authError()) {
                <p class="text-xs text-rose-600 font-semibold">{{ state.authError() }}</p>
              }

              <button
                type="submit"
                class="h-10 rounded-xl bg-[#007a33] hover:bg-[#005e27] text-white text-xs font-bold shadow-sm transition"
              >
                Salvar Nova Senha e Acessar Workspace
              </button>
            </form>
          } @else {
            <div class="mb-6">
              <h2 class="text-2xl font-bold text-[#002f6c] tracking-tight">
                Acesso Institucional
              </h2>
              <p class="text-xs text-[#97999b] mt-1">
                Entre com sua matrícula de rede ou conta raiz <code class="font-mono text-slate-700">SECP.MASTER</code>.
              </p>
            </div>

            <form (submit)="onSubmitLogin($event)" class="flex flex-col gap-4">
              <div>
                <label for="login-orgao" class="text-xs font-semibold text-slate-700 block mb-1">
                  Órgão / Seccional
                </label>
                <app-searchable-select
                  [(ngModel)]="selectedOrgaoId"
                  name="orgaoId"
                  [required]="true"
                  [options]="orgaoOptions"
                  searchPlaceholder="Pesquisar órgão..."
                />
              </div>

              <div>
                <label for="login-matricula" class="text-xs font-semibold text-slate-700 block mb-1">
                  Matrícula / Login
                </label>
                <input
                  id="login-matricula"
                  type="text"
                  [(ngModel)]="matricula"
                  name="matricula"
                  required
                  placeholder="Ex: AM200385 ou SECP.MASTER"
                  class="w-full h-10 px-3.5 rounded-xl border border-slate-300 text-xs font-mono outline-none focus:border-[#002f6c]"
                />
                <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span class="text-[10px] text-slate-400">Servidores reais (SJAM):</span>
                  <button type="button" (click)="matricula = 'AM200385'" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-[#002f6c]">AM200385</button>
                  <button type="button" (click)="matricula = 'AM2703'" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-[#002f6c]">AM2703</button>
                  <button type="button" (click)="matricula = 'AM200218'" class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 hover:bg-blue-50 text-[#002f6c]">AM200218</button>
                </div>
              </div>

              <div>
                <label for="login-senha" class="text-xs font-semibold text-slate-700 block mb-1">
                  Senha Institucional
                </label>
                <app-password-input
                  inputId="login-senha"
                  [(ngModel)]="senha"
                  name="senha"
                  [required]="true"
                  placeholder="••••••••••••"
                  inputClass="h-10 px-3.5 rounded-xl border border-slate-300 text-xs focus:border-[#002f6c]"
                />
              </div>

              @if (state.authError()) {
                <div class="rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 font-semibold">
                  {{ state.authError() }}
                </div>
              }

              <button
                type="submit"
                [disabled]="state.authenticating()"
                class="h-10 rounded-xl bg-[#002f6c] hover:bg-[#00224f] disabled:opacity-50 text-white text-xs font-bold shadow-sm transition"
              >
                {{ state.authenticating() ? 'Autenticando...' : 'Entrar no SECP Ponto' }}
              </button>
            </form>

            <!-- Acesso Rápido de Homologação por Perfil RBAC -->
            <div class="mt-6 pt-5 border-t border-slate-100">
              <span class="text-[11px] font-bold uppercase tracking-wider text-[#97999b] block mb-2.5">
                Homologação Rápida por Perfil RBAC:
              </span>
              <div class="grid grid-cols-2 gap-2">
                @for (perfil of state.perfisRbac; track perfil.codigo) {
                  <button
                    type="button"
                    (click)="entrarRapido(perfil.codigo)"
                    class="px-3 py-2 rounded-xl border border-slate-200 hover:border-[#002f6c] hover:bg-blue-50/40 text-left transition"
                  >
                    <strong class="block text-xs text-[#002f6c]">{{ perfil.codigo }}</strong>
                    <span class="text-[10px] text-slate-500">{{ perfil.nome }}</span>
                  </button>
                }
              </div>
            </div>
          }
        </div>
      </section>
    </div>
  `,
})
export class LoginComponent {
  readonly state = inject(SecpPontoStateService);
  private readonly router = inject(Router);
  readonly orgaoOptions = this.state.orgaosDisponiveis.map((o) => ({
    value: o.id,
    label: `${o.unidadeLabel} (${o.fusoHorario})`,
  }));

  selectedOrgaoId = 'sjam';
  matricula = 'AM200385';
  senha = '';
  novaSenha = '';

  onSubmitLogin(event: Event): void {
    event.preventDefault();
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
