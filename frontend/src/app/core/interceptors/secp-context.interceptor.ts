import { HttpInterceptorFn } from '@angular/common/http';
import { Injector, inject } from '@angular/core';
import { SecpPontoStateService } from '../services/secp-ponto-state.service';

export const secpContextInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/v1/secp/')) {
    return next(req);
  }

  const injector = inject(Injector);
  const state = injector.get(SecpPontoStateService);
  const orgao = state.activeOrgao();
  const perfil = state.activePerfilCodigo();
  const matricula = state.servidorMatricula();

  const headers: Record<string, string> = {};
  if (orgao?.id) {
    headers['X-SECP-Orgao-Id'] = orgao.id;
  }
  if (orgao?.sigla) {
    headers['X-SECP-Orgao-Sigla'] = orgao.sigla;
  }
  if (perfil) {
    headers['X-SECP-Perfil'] = perfil;
  }
  if (matricula) {
    headers['X-SECP-Matricula'] = matricula;
  }

  return next(req.clone({ setHeaders: headers }));
};
