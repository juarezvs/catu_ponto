import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { SecpPontoStateService } from '../services/secp-ponto-state.service';

const RBAC_CADASTRO_SLUGS = new Set([
  'usuarios',
  'perfis',
  'permissoes',
  'integracoes-sistemas',
  'configuracoes-globais',
]);

export const authGuard: CanActivateFn = () => {
  const state = inject(SecpPontoStateService);
  const router = inject(Router);
  if (state.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const cadastrosGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const state = inject(SecpPontoStateService);
  const router = inject(Router);
  const slug = route.paramMap.get('slug') || '';
  const requiredPerm = RBAC_CADASTRO_SLUGS.has(slug)
    ? 'perfis:gerenciar:seccional'
    : 'cadastros:gerenciar:seccional';

  if (state.hasPermission(requiredPerm)) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};

export const chefiaGuard: CanActivateFn = () => {
  const state = inject(SecpPontoStateService);
  const router = inject(Router);
  if (state.hasPermission('homologacao:gerenciar:subordinados')) {
    return true;
  }
  return router.createUrlTree(['/dashboard']);
};
