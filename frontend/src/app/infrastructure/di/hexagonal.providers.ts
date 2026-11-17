import { Provider } from '@angular/core';
import { CatuPontoHttpAdapter } from '../../adapters/outbound/http/catuponto-http.adapter';
import { WORKSPACE_NAVIGATION_USE_CASE } from '../../application/ports/inbound/workspace-navigation.port';
import { NAVIGATION_GATEWAY_PORT } from '../../application/ports/outbound/navigation-gateway.port';
import { WorkspaceNavigationUseCase } from '../../application/use-cases/workspace-navigation.use-case';

/**
 * Container de Injeção de Dependência (Infrastructure Layer) aplicando DIP (SOLID):
 * Conecta as Portas de Entrada e Saída às suas respectivas implementações concretas.
 */
export function provideHexagonalArchitecture(): Provider[] {
  return [
    {
      provide: NAVIGATION_GATEWAY_PORT,
      useClass: CatuPontoHttpAdapter,
    },
    {
      provide: WORKSPACE_NAVIGATION_USE_CASE,
      useClass: WorkspaceNavigationUseCase,
    },
  ];
}
