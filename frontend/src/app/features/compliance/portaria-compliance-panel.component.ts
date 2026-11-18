import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AuditLogItem,
  PortariaComplianceService,
} from '../../core/services/portaria-compliance.service';

@Component({
  selector: 'app-portaria-compliance-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="p-6 max-w-5xl mx-auto space-y-6">
      <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 class="text-xl font-bold text-slate-900">
          Conformidade Portaria SJAM-DIREF 135/2025
        </h1>
        <p class="text-sm text-slate-600 mt-1">
          Sessão com Perfil Único Ativo, Antiduplicidade (5 min), LGPD e Auditoria Imutável SHA-256.
        </p>

        @if (!compliance.session()) {
          <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              [(ngModel)]="matricula"
              placeholder="Matrícula AD (ex: AM200385)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              [(ngModel)]="password"
              type="password"
              placeholder="Senha AD"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              (click)="autenticar()"
              class="rounded-lg bg-[#002f6c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#004094]"
            >
              Autenticar Sessão
            </button>
          </div>
        } @else {
          <div class="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-slate-50 p-4 border border-slate-200">
            <div>
              <div class="text-xs uppercase font-bold text-slate-500">Perfil Único Ativo</div>
              <div class="text-base font-bold text-slate-900">
                {{ compliance.session()!.activeProfileCode }} • {{ compliance.session()!.lotacaoCodigo }}
              </div>
              <div class="text-xs text-slate-600">
                Escopo: {{ compliance.session()!.scope }} | Provedor: {{ compliance.session()!.provider }}
              </div>
            </div>

            <div class="flex items-center gap-2">
              <label class="text-xs font-semibold text-slate-700">Trocar Perfil:</label>
              <select
                [ngModel]="compliance.session()!.activeProfileId"
                (ngModelChange)="trocarPerfil($event)"
                class="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
              >
                @for (prof of compliance.session()!.availableProfiles; track prof.profileId) {
                  <option [value]="prof.profileId">
                    {{ prof.profileCode }} — {{ prof.profileName }}
                  </option>
                }
              </select>
            </div>
          </div>

          <div class="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              (click)="baterPonto()"
              class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Registrar Ponto (RN-01 / RN-03)
            </button>
            <button
              type="button"
              (click)="carregarAuditoria()"
              class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            >
              Consultar Auditoria Read-Only
            </button>
          </div>
        }

        @if (feedback()) {
          <div class="mt-3 rounded-lg bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-900">
            {{ feedback() }}
          </div>
        }
      </div>

      @if (auditLogs().length > 0) {
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="text-base font-bold text-slate-900 mb-3">Trilha de Auditoria Imutável</h2>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="border-b border-slate-200 text-slate-500 uppercase">
                <tr>
                  <th class="py-2 pr-3">Ação</th>
                  <th class="py-2 pr-3">Perfil Ativo</th>
                  <th class="py-2 pr-3">Entidade</th>
                  <th class="py-2 pr-3">Hash SHA-256</th>
                </tr>
              </thead>
              <tbody>
                @for (log of auditLogs(); track log.id) {
                  <tr class="border-b border-slate-100">
                    <td class="py-2 pr-3 font-semibold text-slate-800">{{ log.action }}</td>
                    <td class="py-2 pr-3">{{ log.activeProfile }}</td>
                    <td class="py-2 pr-3">{{ log.entityType }}</td>
                    <td class="py-2 pr-3 font-mono text-[11px] text-slate-500">
                      {{ log.integrityHash.slice(0, 16) }}...
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </div>
  `,
})
export class PortariaCompliancePanelComponent {
  readonly compliance = inject(PortariaComplianceService);
  matricula = 'AM200385';
  password = '';
  readonly feedback = signal<string>('');
  readonly auditLogs = signal<AuditLogItem[]>([]);

  autenticar(): void {
    this.compliance.login(this.matricula, this.password).subscribe({
      next: (s) => this.feedback.set(`Sessão iniciada com perfil único: ${s.activeProfileCode}`),
      error: (err) => this.feedback.set(err?.error?.detail ?? 'Falha na autenticação.'),
    });
  }

  trocarPerfil(profileId: string): void {
    this.compliance.switchActiveProfile(profileId).subscribe({
      next: (s) => this.feedback.set(`Perfil ativo alterado para ${s.activeProfileCode}.`),
      error: (err) => this.feedback.set(err?.error?.detail ?? 'Falha ao trocar perfil.'),
    });
  }

  baterPonto(): void {
    this.compliance.registerClock().subscribe({
      next: () => this.feedback.set('Batida registrada com SHA-256 e recálculo automático concluído.'),
      error: (err) => this.feedback.set(err?.error?.detail ?? 'Bloqueio na batida.'),
    });
  }

  carregarAuditoria(): void {
    this.compliance.listAuditLogs().subscribe({
      next: (logs) => {
        this.auditLogs.set(logs);
        this.feedback.set(`${logs.length} registro(s) de auditoria carregados.`);
      },
      error: (err) => this.feedback.set(err?.error?.detail ?? 'Acesso negado à auditoria.'),
    });
  }
}
