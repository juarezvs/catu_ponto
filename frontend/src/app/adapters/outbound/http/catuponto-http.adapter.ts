import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NavigationGatewayPort } from '../../../application/ports/outbound/navigation-gateway.port';
import {
  BancoHorasResumo,
  CadastroModuleContent,
  CrudListResponse,
  EspelhoDia,
  HomologacaoItem,
  HubModulesResponse,
  MarcacaoPonto,
  ModuleWorkspaceResponse,
  PontoDashboard,
  RbacLiberacaoRotina,
  RbacMatrixResponse,
  RbacPerfil,
  RbacUsuarioPerfil,
  SragQueryResponse,
  SsoSessionResponse,
} from '../../../domain/models/navigation.model';

@Injectable()
export class CatuPontoHttpAdapter implements NavigationGatewayPort {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8000/api/v1/secp';

  loginSso(userId: string, orgaoId?: string, password?: string): Observable<SsoSessionResponse> {
    return this.http.post<SsoSessionResponse>(`${this.baseUrl}/auth/sso/login`, {
      user_id: userId,
      password: password ?? null,
      orgao_id: orgaoId ?? null,
    });
  }

  changeInitialPassword(
    userId: string,
    newPassword: string
  ): Observable<{ updated: boolean; requirePasswordChange: boolean }> {
    return this.http.post<{ updated: boolean; requirePasswordChange: boolean }>(
      `${this.baseUrl}/auth/sso/change-password`,
      { user_id: userId, new_password: newPassword }
    );
  }

  getAuthorizedHubModules(
    userId: string,
    orgaoId?: string
  ): Observable<HubModulesResponse> {
    const params: Record<string, string> = { user_id: userId };
    if (orgaoId) {
      params['orgao_id'] = orgaoId;
    }
    return this.http.get<HubModulesResponse>(`${this.baseUrl}/hub/modules`, {
      params,
    });
  }

  getModuleWorkspace(
    userId: string,
    moduleSlug: string,
    orgaoId?: string
  ): Observable<ModuleWorkspaceResponse> {
    const params: Record<string, string> = { user_id: userId };
    if (orgaoId) {
      params['orgao_id'] = orgaoId;
    }
    return this.http.get<ModuleWorkspaceResponse>(
      `${this.baseUrl}/modules/${encodeURIComponent(moduleSlug)}/workspace`,
      { params }
    );
  }

  getSubitemResource(
    userId: string,
    moduleSlug: string,
    subitemSlug: string
  ): Observable<CadastroModuleContent> {
    return this.http.get<CadastroModuleContent>(
      `${this.baseUrl}/modules/${encodeURIComponent(
        moduleSlug
      )}/subitems/${encodeURIComponent(subitemSlug)}`,
      {
        params: { user_id: userId },
      }
    );
  }

  querySragCopilot(
    userId: string,
    orgaoId: string,
    question: string,
    moduleSlug?: string
  ): Observable<SragQueryResponse> {
    return this.http.post<SragQueryResponse>(`${this.baseUrl}/srag/query`, {
      user_id: userId,
      orgao_id: orgaoId,
      question,
      module_slug: moduleSlug ?? null,
    });
  }

  getPontoDashboard(userId: string): Observable<PontoDashboard> {
    return this.http.get<PontoDashboard>(`${this.baseUrl}/ponto/dashboard`, {
      params: { user_id: userId },
    });
  }

  registrarPonto(
    userId: string,
    fonte: string,
    observacao?: string
  ): Observable<MarcacaoPonto> {
    return this.http.post<MarcacaoPonto>(`${this.baseUrl}/ponto/registrar`, {
      user_id: userId,
      fonte,
      observacao: observacao ?? null,
    });
  }

  getEspelhoPonto(
    userId: string,
    ano: number = 2026,
    mes: number = 11
  ): Observable<readonly EspelhoDia[]> {
    return this.http.get<readonly EspelhoDia[]>(`${this.baseUrl}/ponto/espelho`, {
      params: { user_id: userId, ano: String(ano), mes: String(mes) },
    });
  }

  getBancoHoras(userId: string): Observable<BancoHorasResumo> {
    return this.http.get<BancoHorasResumo>(`${this.baseUrl}/ponto/banco-horas`, {
      params: { user_id: userId },
    });
  }

  listHomologacaoQueue(
    ano: number = 2026,
    mes: number = 11
  ): Observable<readonly HomologacaoItem[]> {
    return this.http.get<readonly HomologacaoItem[]>(
      `${this.baseUrl}/ponto/homologacao`,
      {
        params: { ano: String(ano), mes: String(mes) },
      }
    );
  }

  homologarServidor(
    homologacaoId: string,
    chefiaId: string
  ): Observable<HomologacaoItem> {
    return this.http.post<HomologacaoItem>(
      `${this.baseUrl}/ponto/homologacao/${encodeURIComponent(
        homologacaoId
      )}/aprovar`,
      {},
      { params: { chefia_id: chefiaId } }
    );
  }

  listCrudResource(resource: string, search: string = ''): Observable<CrudListResponse> {
    return this.http.get<CrudListResponse>(
      `${this.baseUrl}/ponto/crud/${encodeURIComponent(resource)}`,
      { params: search ? { search } : {} }
    );
  }

  createCrudResource(
    resource: string,
    payload: Record<string, string>
  ): Observable<Record<string, string>> {
    return this.http.post<Record<string, string>>(
      `${this.baseUrl}/ponto/crud/${encodeURIComponent(resource)}`,
      payload
    );
  }

  updateCrudResource(
    resource: string,
    itemId: string,
    payload: Record<string, string>
  ): Observable<Record<string, string>> {
    return this.http.put<Record<string, string>>(
      `${this.baseUrl}/ponto/crud/${encodeURIComponent(resource)}/${encodeURIComponent(itemId)}`,
      payload
    );
  }

  deleteCrudResource(
    resource: string,
    itemId: string
  ): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/ponto/crud/${encodeURIComponent(resource)}/${encodeURIComponent(itemId)}`
    );
  }

  getRbacMatrix(): Observable<RbacMatrixResponse> {
    return this.http.get<RbacMatrixResponse>(`${this.baseUrl}/identidade/rbac/matrix`);
  }

  createRbacPerfil(payload: {
    codigo: string;
    nome: string;
    descricao: string;
    administrativo: boolean;
    globalScope: boolean;
  }): Observable<RbacPerfil> {
    return this.http.post<RbacPerfil>(`${this.baseUrl}/identidade/rbac/perfis`, payload);
  }

  deleteRbacPerfil(perfilId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/identidade/rbac/perfis/${encodeURIComponent(perfilId)}`
    );
  }

  toggleRbacPerfilPermissao(
    perfilId: string,
    permissaoCodigo: string
  ): Observable<RbacPerfil> {
    return this.http.post<RbacPerfil>(
      `${this.baseUrl}/identidade/rbac/perfis/${encodeURIComponent(perfilId)}/permissoes/toggle`,
      { permissao_codigo: permissaoCodigo }
    );
  }

  setRbacOrgaoOverride(
    perfilId: string,
    orgaoId: string,
    permissaoCodigo: string,
    permitida: boolean | null
  ): Observable<{ status: string }> {
    return this.http.post<{ status: string }>(
      `${this.baseUrl}/identidade/rbac/perfis/${encodeURIComponent(perfilId)}/overrides`,
      { orgao_id: orgaoId, permissao_codigo: permissaoCodigo, permitida }
    );
  }

  assignRbacUsuarioPerfil(
    usuarioId: string,
    perfilId: string,
    orgaoId?: string
  ): Observable<RbacUsuarioPerfil> {
    return this.http.post<RbacUsuarioPerfil>(
      `${this.baseUrl}/identidade/rbac/usuarios-perfis`,
      { usuario_id: usuarioId, perfil_id: perfilId, orgao_id: orgaoId ?? null }
    );
  }

  removeRbacUsuarioPerfil(vinculoId: string): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(
      `${this.baseUrl}/identidade/rbac/usuarios-perfis/${encodeURIComponent(vinculoId)}`
    );
  }

  toggleRbacRotina(rotinaId: string): Observable<RbacLiberacaoRotina> {
    return this.http.post<RbacLiberacaoRotina>(
      `${this.baseUrl}/identidade/rbac/rotinas/${encodeURIComponent(rotinaId)}/toggle`,
      {}
    );
  }
}
