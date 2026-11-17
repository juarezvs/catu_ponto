import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
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

/**
 * Outbound Port (Driven Port) da Arquitetura Hexagonal no Frontend Angular.
 */
export interface NavigationGatewayPort {
  loginSso(userId: string, orgaoId?: string, password?: string): Observable<SsoSessionResponse>;
  changeInitialPassword(userId: string, newPassword: string): Observable<{ updated: boolean; requirePasswordChange: boolean }>;
  getAuthorizedHubModules(userId: string, orgaoId?: string): Observable<HubModulesResponse>;
  getModuleWorkspace(
    userId: string,
    moduleSlug: string,
    orgaoId?: string
  ): Observable<ModuleWorkspaceResponse>;
  getSubitemResource(
    userId: string,
    moduleSlug: string,
    subitemSlug: string
  ): Observable<CadastroModuleContent>;
  querySragCopilot(
    userId: string,
    orgaoId: string,
    question: string,
    moduleSlug?: string
  ): Observable<SragQueryResponse>;

  // Portas específicas do módulo SECP Ponto
  getPontoDashboard(userId: string): Observable<PontoDashboard>;
  registrarPonto(userId: string, fonte: string, observacao?: string): Observable<MarcacaoPonto>;
  getEspelhoPonto(userId: string, ano?: number, mes?: number): Observable<readonly EspelhoDia[]>;
  getBancoHoras(userId: string): Observable<BancoHorasResumo>;
  listHomologacaoQueue(ano?: number, mes?: number): Observable<readonly HomologacaoItem[]>;
  homologarServidor(homologacaoId: string, chefiaId: string): Observable<HomologacaoItem>;

  // Portas CRUD genéricas do módulo SECP Ponto
  listCrudResource(resource: string, search?: string): Observable<CrudListResponse>;
  createCrudResource(resource: string, payload: Record<string, string>): Observable<Record<string, string>>;
  updateCrudResource(resource: string, itemId: string, payload: Record<string, string>): Observable<Record<string, string>>;
  deleteCrudResource(resource: string, itemId: string): Observable<{ deleted: boolean }>;

  // Portas do motor RBAC central (SECP Identidade)
  getRbacMatrix(): Observable<RbacMatrixResponse>;
  createRbacPerfil(payload: { codigo: string; nome: string; descricao: string; administrativo: boolean; globalScope: boolean }): Observable<RbacPerfil>;
  deleteRbacPerfil(perfilId: string): Observable<{ deleted: boolean }>;
  toggleRbacPerfilPermissao(perfilId: string, permissaoCodigo: string): Observable<RbacPerfil>;
  setRbacOrgaoOverride(perfilId: string, orgaoId: string, permissaoCodigo: string, permitida: boolean | null): Observable<{ status: string }>;
  assignRbacUsuarioPerfil(usuarioId: string, perfilId: string, orgaoId?: string): Observable<RbacUsuarioPerfil>;
  removeRbacUsuarioPerfil(vinculoId: string): Observable<{ deleted: boolean }>;
  toggleRbacRotina(rotinaId: string): Observable<RbacLiberacaoRotina>;
}

export const NAVIGATION_GATEWAY_PORT = new InjectionToken<NavigationGatewayPort>(
  'NAVIGATION_GATEWAY_PORT'
);
