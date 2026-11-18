import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';

export type NormativeProfileCode =
  | 'SERVIDOR'
  | 'GESTOR'
  | 'DIRETOR_RH'
  | 'AUDITOR'
  | 'ADMIN_TI';

export interface AvailableProfileItem {
  profileId: string;
  profileCode: NormativeProfileCode;
  profileName: string;
  lotacaoCodigo: string;
}

export interface ComplianceSession {
  sessionId: string;
  userId: string;
  matricula: string;
  userName: string;
  activeProfileId: string;
  activeProfileCode: NormativeProfileCode;
  scope: string;
  lotacaoCodigo: string;
  provider: string;
  availableProfiles: AvailableProfileItem[];
}

export interface AuditLogItem {
  id: string;
  userId: string;
  activeProfile: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  integrityHash: string;
}

@Injectable({ providedIn: 'root' })
export class PortariaComplianceService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://127.0.0.1:8000/api/v1/secp/compliance';

  readonly session = signal<ComplianceSession | null>(null);

  private buildHeaders(): HttpHeaders {
    const s = this.session();
    let headers = new HttpHeaders();
    if (s) {
      headers = headers
        .set('X-Session-Token', s.sessionId)
        .set('X-Active-Profile', s.activeProfileCode);
    }
    return headers;
  }

  login(matricula: string, password: string, requestedProfile?: NormativeProfileCode): Observable<ComplianceSession> {
    return this.http
      .post<ComplianceSession>(`${this.baseUrl}/auth/login`, {
        matricula,
        password,
        requested_profile_code: requestedProfile ?? null,
      })
      .pipe(tap((res) => this.session.set(res)));
  }

  switchActiveProfile(targetProfileId: string): Observable<ComplianceSession> {
    return this.http
      .post<ComplianceSession>(
        `${this.baseUrl}/auth/switch-profile`,
        { target_profile_id: targetProfileId },
        { headers: this.buildHeaders() }
      )
      .pipe(tap((res) => this.session.set(res)));
  }

  registerClock(source = 'FACIAL_WEB', observation?: string): Observable<unknown> {
    return this.http.post(
      `${this.baseUrl}/clocking/register`,
      { source, observation: observation ?? null },
      { headers: this.buildHeaders() }
    );
  }

  listAuditLogs(): Observable<AuditLogItem[]> {
    return this.http.get<AuditLogItem[]>(`${this.baseUrl}/audit/logs`, {
      headers: this.buildHeaders(),
    });
  }
}
