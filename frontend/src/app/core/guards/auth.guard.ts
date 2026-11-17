import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SecpPontoStateService } from '../services/secp-ponto-state.service';

export const authGuard: CanActivateFn = () => {
  const state = inject(SecpPontoStateService);
  const router = inject(Router);
  if (state.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};
